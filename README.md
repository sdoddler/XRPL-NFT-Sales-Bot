# XRPL-NFT-Sales-Bot
An XRPL NFT Sales Bot, Twitter & Discord integrated with customisable options & able to watch multiple issuers.

This bot is intended for projects on the XRPL to run to track sales (and Mints) via their own discord & twitter. It uses a number of features from https://xrpl.org/subscribe.html to make it easy to read and modify as required. It allows you to track & customise options for multiple issuers, meaning that you can monitor multiple NFT collections within the same bot.

This is the first release of this, please let me know if you find any bugs <3

### Keys / Webhook
To get the keys for Twitter you can follow documentation here:
https://developer.twitter.com/en/docs/authentication/oauth-1-0a/api-key-and-secret

To create discord Webhooks you can follow the instructions here:
https://discordjs.guide/popular-topics/webhooks.html#creating-webhooks

### Install
Assuming you install this on a NodeJS machine or VPS such as digital ocean, you should then be able to do the following:
1. `git clone https://github.com/sdoddler/XRPL-NFT-Sales-Bot`
2. `cd XRPL-NFT-Sales-Bot`
3. `npm install`
4. `nano botConfig.json` - Configure settings as per the Config Section below
5. Ctrl+X and Y to save any changes to the config
6. `node SalesBot.js`
7. Your bot should now be running

### Configuration
Here you can see each of the switches/options available for each Issuer you include in the botConfig.json file:
- node - This is the XRPL Node to connect to e.g. `wss://xrplcluster.com`
- issuersToTrack - This object holds all the unique Issuers that are to be tracked for Sales and/or mints

- includeFee - true/false - whether to include the fee in the price of the NFT. Default would be false.
- includeMinted - true/false - whether to include minted NFTs in the notifications - these are transfers for 0 XRP, from the issuer or one of the "mintingWallets" defined below
- twitterSale - string - this is the string that will be sent to twitter on a sale - see below for details on % varialbes. 
- twitterMint - string - same as above but for mints
- avatarURL - string - URL to the Avatar for the discord post
- discordColor - int - discord colour for the embed
- addressDisplay - string - use "full", "short" or "nomiddle" to change the display of the address in posts
- discordWebhookEnabled - true/false - whether to post to the discord Webhook or not
- discordWebhookURL - string - valid discord webhook URL
- twitterPostEnabled - true/false - whether or not to post to twitter
- consumer_key - string - twitter_consumerKey
- consumer_secret - string - twitter_consumer_secret
- access_token - string - twitter_access_token
- access_token_secret - string - twitter_access_token_secret
- mintingWallets - array of strings - These should be addresses other than the issuer that could be considered a minting address, if you are wanting to post when NFTs are transferred from these addresses. These could include marketplace addresses 

###### Variables
Within the Twitter Sale & Twitter Mint strings you can use variables to customise your message - some of these rely on the Meta being available.
- %name% - the Name of the NFT
- %buyerAmount% - amount of XRP the sale occured for
- %seller% - Seller address - if minting this is empty
- %buyer% - Buyer address
- %nft% - NFTokenID - this can be used in conjunction with links to create links to NFTs!


#### Preview / Screenshots
![image](https://user-images.githubusercontent.com/14932966/222015373-90c58009-5a56-4f6a-bc20-492b06ced14f.png)![image](https://user-images.githubusercontent.com/14932966/222018437-2d0e24f5-db39-40b6-8f02-bd6a8ffd23e4.png)
![image](https://user-images.githubusercontent.com/14932966/222018553-ed7e73f7-ad80-4aa2-b033-6b3daaa203a9.png)


#### Donate
I am releasing this tool for free as I believe it benefits the XRPL and the projects on it. 
I don't expect anything in return however if you wish to send me an NFT or some spare XRP feel free to do so here: 

rGnBUCwMJSX57QDecdyT5drdG3gvsmVqxD

![image](https://user-images.githubusercontent.com/14932966/222018787-e420aa35-2e15-436d-a791-17fe6186b01d.png)
