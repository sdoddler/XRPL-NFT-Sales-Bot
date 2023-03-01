const readline = require('readline')
Object.assign(global, { WebSocket: require('ws') });
const { node,
    includeFee,
    includeMinted,
    discordWebhookEnabled,
    discordWebhookURL,
    twitterPostEnabled,
    consumer_key,
    consumer_secret,
    access_token,
    access_token_secret,
    mintingWallets,
    issuersToTrack,
    twitterSaleMessage } = require('./botConfig.json');
const xrpl = require('xrpl');

const Twit = require('twit');
const request = require('request').defaults({ encoding: null });

const issuerTwitters = {};

for (var i in issuersToTrack) {

    if (!issuersToTrack[i].consumer_key || issuersToTrack[i].consumer_key == "") continue;

    if (!issuersToTrack[i].consumer_secret || issuersToTrack[i].consumer_secret == "") continue;
    if (!issuersToTrack[i].access_token || issuersToTrack[i].access_token == "") continue;
    if (!issuersToTrack[i].access_token_secret || issuersToTrack[i].access_token_secret == "") continue;

    var T = new Twit({
        consumer_key: issuersToTrack[i].consumer_key,
        consumer_secret: issuersToTrack[i].consumer_secret,
        access_token: issuersToTrack[i].access_token,
        access_token_secret: issuersToTrack[i].access_token_secret,
        timeout_ms: 60 * 1000,
        strictSSL: true
    });
    issuerTwitters[i] = T;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

let socket;

let WS_HANDLERS;

function connect() {

    socket = new WebSocket(node)
   

    WS_HANDLERS = {
        "response": handleResponse
        // Fill this out with your handlers in the following format:
        // "type": function(event) { /* handle event of this type */ }
    }
    socket.addEventListener('message', (event) => {
        const parsed_data = JSON.parse(event.data)
        if (WS_HANDLERS.hasOwnProperty(parsed_data.type)) {
            // Call the mapped handler
            WS_HANDLERS[parsed_data.type](parsed_data)
        } else {
            console.log("Unhandled message from server", event)
        }
    })

    WS_HANDLERS["transaction"] = log_tx


    socket.addEventListener('open', (event) => {
        // This callback runs when the connection is open
        console.log("Connected!")
        const command = {
            "id": "nft_sales_bot",
            "command": "ping"
        }
        socket.send(JSON.stringify(command))

        do_subscribe()
    })

    socket.addEventListener('close', (event) => {
        // Use this event to detect when you have become disconnected
        // and respond appropriately.
        console.log('Disconnected...')
        setTimeout(connect, 5000);

    })


}


const AWAITING = {}
const handleResponse = function (data) {
    if (!data.hasOwnProperty("id")) {
        console.error("Got response event without ID:", data)
        return
    }
    if (AWAITING.hasOwnProperty(data.id)) {
        AWAITING[data.id].resolve(data)
    } else {
        console.warn("Response to un-awaited request w/ ID " + data.id)
    }
}

let autoid_n = 0
function api_request(options) {
    if (!options.hasOwnProperty("id")) {
        options.id = "autoid_" + (autoid_n++)
    }

    let resolveHolder;
    AWAITING[options.id] = new Promise((resolve, reject) => {
        // Save the resolve func to be called by the handleResponse function later
        resolveHolder = resolve
        try {
            // Use the socket opened in the previous example...
            socket.send(JSON.stringify(options))
        } catch (error) {
            reject(error)
        }
    })
    AWAITING[options.id].resolve = resolveHolder;
    return AWAITING[options.id]
}




async function do_subscribe() {

    var obj = {
        command: "subscribe",

    }

    obj.streams = ["transactions"]

    const sub_response = await api_request(obj)
    if (sub_response.status === "success") {
        console.log("Successfully subscribed!")
    } else {
        console.error("Error subscribing: ", sub_response)
    }
}
// Add do_subscribe() to the 'open' listener for socket

const log_tx = async function (tx) {

    if (tx.transaction.TransactionType) {
        if (tx.transaction.TransactionType == "NFTokenAcceptOffer" && tx.meta.TransactionResult == "tesSUCCESS" && tx.validated == true) {
            
            var fee = Number(tx.transaction.Fee)
            if (tx.meta.AffectedNodes) {
                var accounts = {};
                var nft = '';
                var uri = '';
                for (var an in tx.meta.AffectedNodes) {
                    var node = tx.meta.AffectedNodes[an]
                    if (node?.ModifiedNode) {
                      //  console.log(node.ModifiedNode);
                        if (node.ModifiedNode.LedgerEntryType == "AccountRoot") {
                            var previousBalance = node.ModifiedNode.PreviousFields.Balance;
                            var currentBalance = node.ModifiedNode.FinalFields.Balance;

                            //console.log(node.ModifiedNode.FinalFields.Account);
                            accounts[node.ModifiedNode.FinalFields.Account] = currentBalance - previousBalance;
                        }

                        
                    }

                    if (node?.DeletedNode) {
                        if (node.DeletedNode.LedgerEntryType == "NFTokenOffer") {
                            nft = node.DeletedNode.FinalFields.NFTokenID;
                        }
                    }
                }

                if (!issuersToTrack.hasOwnProperty(xrpl.parseNFTokenID(nft).Issuer)) {
                    console.log("Not tracking sales from this issuer: " + xrpl.parseNFTokenID(nft).Issuer);
                    return;
                }

                var issuer = xrpl.parseNFTokenID(nft).Issuer;
                var issuerDetails = issuersToTrack[issuer]

                //loop through nodes after we know the NFT to gather URI
                for (var an in tx.meta.AffectedNodes) {
                    var node = tx.meta.AffectedNodes[an]
                    if (node?.ModifiedNode) {
                        if (node.ModifiedNode.LedgerEntryType == "NFTokenPage") {
                            for (var nnn in node.ModifiedNode.FinalFields.NFTokens) {
                                if (node.ModifiedNode.FinalFields.NFTokens[nnn].NFToken.NFTokenID == nft) {
                                    try {
                                        uri = xrpl.convertHexToString(node.ModifiedNode.FinalFields.NFTokens[nnn].NFToken.URI);
                                    } catch {
                                        uri = null;
                                    }
                                }
                            }
                        }
                    }
                }
                

                var seller = "";
                var buyer = "";
                var sellerAmount = 0;
                var buyerAmount = 0;
                var action = "Sold";

                for (var acc in accounts) {
                    if (accounts[acc] > 0 && !isNaN(accounts[acc])) {
                        if (accounts[acc] > sellerAmount) {
                            seller = acc;
                            sellerAmount = accounts[acc];
                        }
                    }

                    if (isNaN(accounts[acc]) && (acc == xrpl.parseNFTokenID(nft).Issuer || issuerDetails.mintingWallets.includes(acc))) {
                        seller = acc;
                    }

                    if (accounts[acc] < 0) {
                        buyer = acc;
                        if (includeFee) {
                            buyerAmount = Math.abs((accounts[acc]) / 1000000)
                        } else {
                            buyerAmount = Math.abs((accounts[acc] + fee) / 1000000)
                        }
                    }
                }

                

                var fireNotification = false;

                //Debug Issuer
                //console.log(xrpl.parseNFTokenID(nft).Issuer);
                if (sellerAmount > 0) {
                    console.log(tx);
                    console.log(`${nft} Sold  for: ${buyerAmount} from ${seller} to ${buyer}\n${uri}`)
                    fireNotification = true;

                    
                    
                } else {
                    console.log(`${nft} Minted / Transferred to ${buyer}\n${uri}`)
                    if ((seller == xrpl.parseNFTokenID(nft).Issuer || issuerDetails.mintingWallets.includes(seller)) && issuerDetails.includeMinted) {
                        action = "Minted";
                        fireNotification = true;
                    }
                }

                if (issuerDetails.addressDisplay) {
                    if (issuerDetails.addressDisplay == "short") {
                        buyer = buyer.slice(0, 5) + "...";
                        seller = seller.slice(0, 5) + "...";
                    }
                    if (issuerDetails.addressDisplay == "nomiddle") {
                        buyer = buyer.slice(0, 5) + "..." + buyer.slice(buyer.length - 5, buyer.length);
                        seller = seller.slice(0, 5) + "..." + seller.slice(seller.length - 5, seller.length);
                    }
                }
                console.log(accounts);


                if (fireNotification) {
                    SendNotifications(issuer, issuerDetails, nft, uri, seller, buyer, buyerAmount, action);
                }
                
            }
        } 
    }
}

async function SendNotifications(issuer, issuerDetails, nft, uri, seller, buyer, buyerAmount, action) {

    var meta = await URLGet(uri);
    console.log(meta);
    if (meta != null) {
        try {

            var nftName = meta?.name ? meta.name : "NFT ";
            var nftImage = meta?.image ? meta.image : "";

            if (nftImage == "") {
                nftImage = meta?.image_url ? meta.image_url : "";
            }

            if (nftImage.startsWith('ipfs://')) {
                nftImage = nftImage.replace('ipfs://ipfs/', 'https://cloudflare-ipfs.com/ipfs/')
                nftImage = nftImage.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/')
            } else if (nftImage.startsWith("http")) {
            } else {
                nftImage = 'https://cloudflare-ipfs.com/ipfs/' + nftImage;
            }

            if (issuerDetails.discordWebhookEnabled) {
                if (issuerDetails.discordWebhookURL != null & issuerDetails.discordWebhookURL != undefined) {
                    if (issuerDetails.discordWebhookURL.startsWith("https://discord.com/api/webhooks/")) {
                        //var postPath = discordWebhookURL.replace("https://discord.com", "");

                        var username = issuerDetails.discordBotName ? issuerDetails.discordBotName : "Sales Bot";
                        var avatar_url = issuerDetails.avatarURL ? issuerDetails.avatarURL : "";
                        var discordColor = issuerDetails.discordColour ? issuerDetails.discordColor : 15258703;

                        var postJson = {
                            "username": username,
                            "avatar_url": avatar_url,
                            "content": ``,
                            "embeds": [
                                {
                                    "title": nftName + " " + action + "!",
                                    "color": discordColor,
                                    "thumbnail": {
                                        "url": nftImage
                                    },
                                    "fields": [
                                    ]
                                }
                            ]
                        }

                        if (action == "Sold") {
                            postJson.embeds[0].fields = [
                                {
                                    "name": "Sold for",
                                    "value": buyerAmount.toString(),
                                    "inline": false
                                }, {
                                    "name": "Seller",
                                    "value": seller.toString(),
                                    "inline": false
                                },
                                {
                                    "name": "Buyer",
                                    "value": buyer.toString(),
                                    "inline": false

                                }]
                        } else {
                            postJson.embeds[0].fields = [                               
                                {
                                    "name": "Minted by",
                                    "value": buyer.toString(),
                                    "inline": false

                                }]
                        }



                        WebhookPost(issuerDetails.discordWebhookURL, postJson);

                        
                    }
                }
            }

            var msg = action == "Minted" ? issuerDetails.twitterMint : issuerDetails.twitterSale;

            msg = msg
                .replace("%name%", nftName)
                .replace("%buyerAmount%", buyerAmount)
                .replace("%seller%", seller)
                .replace("%buyer%", buyer)
                .replace("%nft%", nft);
            console.log(msg);
            if (issuerDetails.twitterPostEnabled) {
                

                tweetWithImageFromWeb(issuer, msg, nftImage)
            }

        } catch {
            console.log("Error parsing meta");
        }
    }
}


async function URLGet(url, retryCount = 0) {
    if (url == null || url == undefined) return null;
    if (typeof url !== 'string') return null;

    if (url.startsWith('ipfs://')) {
        url = url.replace('ipfs://ipfs/', 'https://cloudflare-ipfs.com/ipfs/')
        url = url.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/')
    } else if (url.startsWith("http")) {
    } else {
        url = 'https://cloudflare-ipfs.com/ipfs/' + url;
    }

    try {
        var testedURL = new URL(url);

        return new Promise((resolve, reject) => {
            request.get(url, function (error, response, body) {
                if (error) {
                    if (retryCount < 4) {
                        retryCount += 1;
                        console.log("Error hit - Retrying, Count:" + retryCount);
                        setTimeout(() => {
                            resolve(URLGet(url, retryCount));
                        }, 1000 * retryCount);
                    } else {
                        console.error(error);
                        resolve(null);
                    }
                } else {
                    if (response.statusCode === 200) {
                        try {
                            const json = JSON.parse(body);
                            resolve(json);
                        } catch (parseError) {
                            console.error(parseError.message);
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }
    catch {
        console.log("error parsing url")
        return null;
    }


}

async function WebhookPost(path, json, retryCount = 0) {
    const options = {
        url: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        json
    };

    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) {
                if (retryCount < 4) {
                    retryCount += 1;
                    console.log(`Error hit - Retrying, Count: ${retryCount}`);
                    setTimeout(() => {
                        resolve(WebhookPost(path, json, retryCount));
                    }, 1000 * retryCount);
                } else {
                    console.error(error);
                    resolve(null);
                }
            } else {
                if (response.statusCode === 200) {
                    resolve(200);
                } else {
                    resolve(null);
                }
            }
        });
    });
}


function tweet(i, msg) {



    const params = {
        status: msg
    };

    issuerTwitters[i].post('statuses/update', params, function (err, data, response) {
        if (err) {
            console.log('Error posting tweet:', err);
        } else {
            console.log('Tweet posted successfully!');
        }
    });


}

function tweetWithImageFromWeb(i, msg, imageUrl) {

    if (!issuerTwitters.hasOwnProperty(i)) {
        console.log("error with Twitter Auth for this issuer: " + i)
        return;
    }

    request.get(imageUrl, function (err, response, body) {
        if (err) {
            console.log('Error downloading image:', err);
            tweet(msg);
        } else {
            const b64content = Buffer.from(body).toString('base64');

            issuerTwitters[i].post('media/upload', { media_data: b64content }, function (err, data, response) {
                if (err) {
                    console.log('Error uploading image:', err);
                } else {
                    const mediaIdStr = data.media_id_string;
                    const params = {
                        status: msg,
                        media_ids: [mediaIdStr]
                    };

                    issuerTwitters[i].post('statuses/update', params, function (err, data, response) {
                        if (err) {
                            console.log('Error posting tweet:', err);
                        } else {
                            console.log('Tweet posted successfully!');
                        }
                    });
                }
            });
        }
    });
}


connect();