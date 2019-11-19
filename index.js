const util = require('util')
const debug = require('debug')('botium-connector-chatlayer')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const CoreCapabilities = require('botium-core/src/Capabilities')

const Capabilities = {
  CHATLAYER_URL: 'CHATLAYER_URL',
  CHATLAYER_BOTID: 'CHATLAYER_BOTID',
  CHATLAYER_VERIFYTOKEN: 'CHATLAYER_VERIFYTOKEN'
}

const Defaults = {
  [Capabilities.CHATLAYER_URL]: 'https://api-staging.chatlayer.ai',
  [CoreCapabilities.SIMPLEREST_INBOUND_ENDPOINT]: '/chatlayer'
}

class BotiumConnectorChatlayer {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.delegateContainer = null
    this.delegateCaps = null
  }

  Validate () {
    debug('Validate called')

    Object.assign(this.caps, Defaults)

    if (!this.caps[Capabilities.CHATLAYER_URL]) throw new Error('CHATLAYER_URL capability required')
    if (!this.caps[Capabilities.CHATLAYER_BOTID]) throw new Error('CHATLAYER_BOTID capability required')

    this.delegateCaps = Object.assign({}, this.caps)

    if (!this.delegateContainer) {
      Object.assign(this.delegateCaps, {
        [CoreCapabilities.SIMPLEREST_URL]: `${this.caps[Capabilities.CHATLAYER_URL]}/api/webhookMessage/${this.caps[Capabilities.CHATLAYER_BOTID]}`,
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: `{
            "sender": {
              "id": "{{botium.conversationId}}"
            },
            "text": "{{msg.messageText}}",
            "verifyToken": "${this.caps[Capabilities.CHATLAYER_VERIFYTOKEN]}"
          }`,
        [CoreCapabilities.SIMPLEREST_REQUEST_HOOK]: ({ requestOptions, msg, context }) => {
          debug(`Request Body: ${JSON.stringify(requestOptions.body)}`)
        },
        [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: '$.message.text',
        [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg }) => {
          debug(`Response Body: ${JSON.stringify(botMsg.sourceData)}`)
        },
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_VALUE]: '{{botium.conversationId}}',
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_JSONPATH]: '$.body.senderId'
      })

      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
      this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
    }

    debug('Validate delegate')
    return this.delegateContainer.Validate()
  }

  Build () {
    return this.delegateContainer.Build()
  }

  Start () {
    return this.delegateContainer.Start()
  }

  UserSays (msg) {
    return this.delegateContainer.UserSays(msg)
  }

  Stop () {
    return this.delegateContainer.Stop()
  }

  Clean () {
    return this.delegateContainer.Clean()
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorChatlayer
}
