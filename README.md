# Botium Connector for Chatlayer.ai

[![NPM](https://nodei.co/npm/botium-connector-chatlayer.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-chatlayer/)

[![Codeship Status for codeforequity-at/botium-connector-chatlayer](https://app.codeship.com/projects/272f0fc0-ec43-0137-f319-7ae2d5dde536/status?branch=master)](https://app.codeship.com/projects/374593)
[![npm version](https://badge.fury.io/js/botium-connector-chatlayer.svg)](https://badge.fury.io/js/botium-connector-chatlayer)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()


This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your [Chatlayer.ai](https://www.chatlayer.ai/) chatbot.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works
Botium automatically starts a webhook and connects to the [Chatlayer.ai REST API](https://docs.chatlayer.ai/channels/webhook-api) to receive chatbot responses.

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements
* **Node.js and NPM**
* a **Chatlayer.ai bot**
* a **project directory** on your workstation to hold test cases and Botium configuration

## Install Botium and Chatlayer.ai Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-chatlayer
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-chatlayer
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting Chatlayer.ai chatbot to Botium

Chatlayer.ai has an asynchronous communication model: the bot response is not part of the HTTP/JSON response, but it is sent to a webhook. This webhook is started automatically by Botium, and it has to be registered in Chatlayer first. You have to take care that this webhook is available from the public internet.

#### Confiure the webhook

There are two possibilities to set up the webhook endpoint.

###### Proxy server
Configure the webhook with the capabilities _SIMPLEREST_INBOUND_PORT_ and _SIMPLEREST_INBOUND_ENDPOINT_. When starting Botium, the webhook is available at _http://local-ip-address:inbound-port/input-endpoint_. If your workstation is not available from public internet, you can use a service like [ngrok](https://ngrok.com/) to make it public:

    > ngrok http 1234

The webhook is available at _https://something.ngrok.io/input-endpoint_ then.

###### Proxy server with redis
Configure the webhook with the capability SIMPLEREST_INBOUND_REDISURL. Then start and inbound proxy with `botium-cli`. 

    > botium-cli inbound-proxy
    
     redis://127.0.0.1:6379
     Botium Inbound Messages proxy is listening on port 45100
     Botium Inbound Messages endpoint available at http://127.0.0.1:45100/

To make it public you can use ngrok:
    
    > ngrok http 45100

The webhook is available at https://something.ngrok.io then.

If your proxy server is up and running, then you can register the webhook URL together with a verify token of your choice at [Chatlayer.ai](https://docs.chatlayer.ai/channels/webhook-api).

Create a botium.json in your project directory: 

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "chatlayer",
      "CHATLAYER_URL": "..."
      "CHATLAYER_VERIFY_TOKEN": "...",
      "CHATLAYER_ACCESS_TOKEN": "...",
      "SIMPLEREST_INBOUND_REDISURL": "redis://127.0.0.1:6379"
    }
  }
}
```

To check the configuration, run the emulator (Botium CLI required) to bring up a chat interface in your terminal window:

```
> botium-cli emulator
```

Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## How to start samples

* Adapt botium.json in the `sample/simple` directory
* Install packages, start inbound proxy and run the test.

_In this sample we use the webhook configuration which is written under **Proxy server with redis**_
```
> cd ./samples/simple
> npm install
> npm run inbound
> npm test
```

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __chatlayer__ to activate this connector.

### CHATLAYER_URL*
Chatlayer API url

### CHATLAYER_CHANNEL_ID *
Chatlayer Channel Identifier. You can find this information in the `Configure Webhook` dialog on chatlayer surface.

### CHATLAYER_VERIFYTOKEN *
Chatlayer Webhook verify token.

### CHATLAYER_ACCESS_TOKEN *
You generate one under the `Tokens` menu on chatlayer surface.

### CHATLAYER_SESSION_DATA
Optionally you can set session data as a json object.

### CHATLAYER_WELCOME_MESSAGE
Set it true if your bot has welcome/intro message.

### CHATLAYER_BOT_ID
For detailed nlp data the bot id has to be set up. You can copy this from the url of your chatbot on chatlayer surface.
E.g. my url is 'https://cms.staging.chatlayer.ai/bots/abcdabcd/DRAFT' then the bot id is: `abcdabcd`

### CHATLAYER_VERSION
Set which version you use. It can be `DRAFT` of `LIVE`. The default value is `DRAFT`.

### CHATLAYER_LANGUAGE
The language of your chatbot. The default value is `en`.


### SIMPLEREST_INBOUND_PORT

### SIMPLEREST_INBOUND_ENDPOINT
e.g. `/chatlayer`

### SIMPLEREST_INBOUND_REDISURL
e.g. `redis://127.0.0.1:6379`

### Roadmap
* Support for entity asserter
