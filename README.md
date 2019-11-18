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

Configure the webhook with the capabilities _SIMPLEREST_INBOUND_PORT_ and _SIMPLEREST_INBOUND_ENDPOINT_. When starting Botium, the webhook is available at _http://local-ip-address:inbound-port/input-endpoint_. If your workstation is not available from public internet, you can use a service like [ngrok](https://ngrok.com/) to make it public:

    > ngrok http 1234

The webhook is available at _https://something.ngrok.io/input-endpoint_ then.

Register the webhook URL together with the verify token at [Chatlayer.ai](https://docs.chatlayer.ai/channels/webhook-api).

Create a botium.json with this URL in your project directory: 

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "chatlayer",
      "CHATLAYER_BOTID": "...",
      "SIMPLEREST_INBOUND_PORT": 1234
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

* Adapt botium.json in the sample directory
* Install packages, run the test

```
> cd ./samples/simple
> npm install && npm test
```

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __chatlayer__ to activate this connector.

### CHATLAYER_URL
_Default: https://api-staging.chatlayer.ai_

Chatlayer API url

## CHATLAYER_BOTID *
Chatlayer Bot Identifier

## CHATLAYER_EMAIL
## CHATLAYER_PASSWORD
## CHATLAYER_TOKEN
## CHATLAYER_VERIFYTOKEN

## SIMPLEREST_INBOUND_PORT

## SIMPLEREST_INBOUND_ENDPOINT
_Default: /chatlayer_

### Roadmap
* Support for UI elements and rich text
* Support for intent/entity asserter
