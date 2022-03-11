const axios = require('axios');
const _ = require('lodash');
const moment = require('moment');
const { ethers } = require('ethers');
const tweet = require('./tweet');
const cache = require('./cache');

// Format tweet text
function formatAndSendTweet(event) {
    // Handle both individual items + bundle sales
    const assetName = _.get(event, ['asset', 'name'], _.get(event, ['asset_bundle', 'name']));
    const openseaLink = _.get(event, ['asset', 'permalink'], _.get(event, ['asset_bundle', 'permalink']));
    
    const buyer = _.get(event, ['winner_account', 'user', 'username'], 'Anonymous') || 'Anonymous';
    const seller = _.get(event, ['seller', 'user', 'username'], 'Anonymous') || 'Anonymous';

    const totalPrice = _.get(event, 'total_price');

    const tokenDecimals = _.get(event, ['payment_token', 'decimals']);
    const tokenUsdPrice = _.get(event, ['payment_token', 'usd_price']);
    const tokenEthPrice = _.get(event, ['payment_token', 'eth_price']);

    const formattedUnits = ethers.utils.formatUnits(totalPrice, tokenDecimals);
    const formattedEthPrice = formattedUnits * tokenEthPrice;
    const formattedUsdPrice = formattedUnits * tokenUsdPrice;

    const tweetText = `${assetName} was purchased for ${formattedEthPrice}${ethers.constants.EtherSymbol} ($${Number(formattedUsdPrice).toFixed(2)}) by ${buyer} from ${seller}. #GlueGang #GlueFactoryShow #NFTs ${openseaLink}`;

    // @GlueFactoryShow #??? was purchased for X Eth ($X USD) by X from Y.
// #GlueGang #GlueFactoryShow #NFTs
    
    console.log(tweetText);

    // OPTIONAL PREFERENCE - don't tweet out sales below X ETH (default is 1 ETH - change to what you prefer)
    // if (Number(formattedEthPrice) < 1) {
    //     console.log(`${assetName} sold below tweet price (${formattedEthPrice} ETH).`);
    //     return;
    // }

    // OPTIONAL PREFERENCE - if you want the tweet to include an attached image instead of just text
    // const imageUrl = _.get(event, ['asset', 'image_url']);
    // return tweet.tweetWithImage(tweetText, imageUrl);

    return tweet.tweet(tweetText);
}

// Poll OpenSea every 60 seconds & retrieve all sales for a given collection in either the time since the last sale OR in the last minute
setInterval(() => {
    const lastSaleTime = cache.get('lastSaleTime', null) || moment().startOf('minute').subtract(59, "seconds").unix();

    console.log(`Last sale (in seconds since Unix epoch): ${cache.get('previous_page', null)}`);

    axios.get('https://api.opensea.io/api/v1/events', {
        headers: {
            'X-API-KEY': process.env.X_API_KEY
        },
        params: {
            collection_slug: process.env.OPENSEA_COLLECTION_SLUG,
            event_type: 'successful',
            asset_events: [],
            next_page: "https://api.opensea.io/api/v1/events?cursor=cj0xJnA9MjAyMi0wMi0wMiswMiUzQTQ1JTNBMTIuNjQ3MDM2",
            previous_page: "https://api.opensea.io/api/v1/events?cursor=cD0yMDIyLTAyLTAyKzAxJTNBNDglM0EzNC4xMzE4Nzk%3D",
            only_opensea: 'false'
        }
    }).then((response) => {
        const events = _.get(response, ['data', 'asset_events']);

        const sortedEvents = _.sortBy(events, function(event) {
            const created = _.get(event, 'created_date');

            return new Date(created);
        })

        console.log(`${events.length} sales since the last one...`);

        _.each(sortedEvents, (event) => {
            const created = _.get(event, 'created_date');

            cache.set('lastSaleTime', moment(created).unix());

            return formatAndSendTweet(event);
        });
    }).catch((error) => {
        console.error(error);
    });
}, 60000);
