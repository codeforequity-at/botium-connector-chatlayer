const util = require('util')
const _ = require('lodash')
const mime = require('mime-types')
const debug = require('debug')('botium-connector-chatlayer')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const CoreCapabilities = require('botium-core/src/Capabilities')

const Capabilities = {
  CHATLAYER_URL: 'CHATLAYER_URL',
  CHATLAYER_CHANNEL_ID: 'CHATLAYER_CHANNEL_ID',
  CHATLAYER_VERIFY_TOKEN: 'CHATLAYER_VERIFY_TOKEN',
  CHATLAYER_ACCESS_TOKEN: 'CHATLAYER_ACCESS_TOKEN',
  CHATLAYER_SESSION_DATA: 'CHATLAYER_SESSION_DATA',
  CHATLAYER_WELCOME_MESSAGE: 'CHATLAYER_WELCOME_MESSAGE'
}

const Defaults = {
  [Capabilities.CHATLAYER_URL]: 'https://api.chatlayer.ai'
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
    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.CHATLAYER_URL]) throw new Error('CHATLAYER_URL capability required')
    if (!this.caps[Capabilities.CHATLAYER_CHANNEL_ID]) throw new Error('CHATLAYER_CHANNEL_ID capability required')
    if (!this.caps[Capabilities.CHATLAYER_ACCESS_TOKEN]) throw new Error('CHATLAYER_ACCESS_TOKEN capability required')
    if (!this.caps[Capabilities.CHATLAYER_VERIFY_TOKEN]) throw new Error('CHATLAYER_VERIFY_TOKEN capability required')

    this.delegateCaps = Object.assign({}, this.caps)

    if (!this.delegateContainer) {
      Object.assign(this.delegateCaps, {
        [CoreCapabilities.SIMPLEREST_URL]: `${this.caps[Capabilities.CHATLAYER_URL]}/v1/channels/webhook/${this.caps[Capabilities.CHATLAYER_CHANNEL_ID]}/messages`,
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_HEADERS_TEMPLATE]: `{ "Authorization": "Bearer ${this.caps[Capabilities.CHATLAYER_ACCESS_TOKEN]}"}`,
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: `{
            "conversationId": "{{botium.conversationId}}",
            "message": {}
          }`,
        [CoreCapabilities.SIMPLEREST_REQUEST_HOOK]: ({ requestOptions, msg, context }) => {
          debug(`Request Body: ${JSON.stringify(requestOptions.body)}`)
          if (this.caps[Capabilities.CHATLAYER_SESSION_DATA]) {
            requestOptions.body.sessionData = this.caps[Capabilities.CHATLAYER_SESSION_DATA]
          }
          const message = requestOptions.body.message
          if (msg.introMessage) {
            message.introMessage = {}
          } else if (msg.buttons && msg.buttons.length > 0 && (msg.buttons[0].text || msg.buttons[0].payload)) {
            message.postbackMessage = {
              title: msg.buttons[0].text
            }
            if (msg.buttons[0].payload) {
              try {
                const payload = _.isObject(msg.buttons[0].payload) ? msg.buttons[0].payload : JSON.parse(msg.buttons[0].payload)
                message.postbackMessage.nextDialogstateId = payload.nextDialogstateId
                message.postbackMessage.sessionDataToSet = payload.parameters
              } catch (e) {
                debug(`The button payload can not be parsed: ${e}`)
              }
            }
          } else if (msg.media && msg.media.length > 0) {
            debug('The \'MEDIA\' message type is not supported yet.')
          } else {
            message.textMessage = {
              text: msg.messageText
            }
          }
        },
        [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg }) => {
          debug(`Response Body: ${util.inspect(botMsg.sourceData, false, null, true)}`)

          const mapButtonPayload = (p) => {
            let payload
            try {
              payload = JSON.parse(p)
            } catch (err) {
              payload = p
            }
            return payload
          }
          const mapButton = (b) => ({
            text: _.isString(b) ? b : b.title,
            payload: !_.isString(b) ? mapButtonPayload(b.payload || b.url) : null
          })
          const mapMedia = (m) => ({
            mediaUri: m.url,
            mimeType: mime.lookup(m.url) || 'application/unknown',
            altText: false
          })
          const mapCard = (c) => ({
            text: c.title,
            content: c.subtitle,
            media: c.image_url ? [mapMedia({ url: c.image_url })] : null
          })
          if (botMsg.sourceData.verifyToken === this.caps[Capabilities.CHATLAYER_VERIFY_TOKEN].toString() &&
            botMsg.sourceData.message && botMsg.sourceData.message.type !== 'event') {
            const message = botMsg.sourceData.message
            botMsg.buttons = botMsg.buttons || []
            botMsg.media = botMsg.media || []
            botMsg.cards = botMsg.cards || []

            botMsg.messageText = message.text

            if (message.quick_replies && message.quick_replies.length > 0) {
              for (const quickReply of message.quick_replies) {
                botMsg.buttons.push(mapButton(quickReply))
              }
            }

            if (message.attachment && message.attachment.payload) {
              const payload = message.attachment.payload
              if (message.attachment.type === 'image' || message.attachment.type === 'video') {
                botMsg.media.push(mapMedia(payload))
              } else if (message.attachment.type === 'template') {
                if (payload.template_type === 'button') {
                  botMsg.messageText = payload.text
                  for (const button of payload.buttons) {
                    botMsg.buttons.push(mapButton(button))
                  }
                } else if (payload.template_type === 'list' || payload.template_type === 'generic') {
                  for (const element of payload.elements) {
                    const botiumCard = mapCard(element)
                    if (element.buttons && element.buttons.length > 0) {
                      botiumCard.buttons = []
                      for (const button of element.buttons) {
                        botiumCard.buttons.push(mapButton(button))
                      }
                    }
                    botMsg.cards.push(botiumCard)
                  }
                } else {
                  debug(`The '${message.attachment.payload.template_type}' template type is not supported yet.`)
                }
              } else {
                debug(`The '${message.attachment.type}' attachment type is not supported yet.`)
              }
            }

            if (botMsg.sourceData.nlp) {
              botMsg.nlp = {
                intent: this._extractIntent(botMsg.sourceData.nlp),
                entities: this._extractEntities(botMsg.sourceData.nlp)
              }
            }
          }
        },
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_VALUE]: '{{botium.conversationId}}',
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_JSONPATH]: '$.body.senderId',
        [CoreCapabilities.SIMPLEREST_IGNORE_EMPTY]: true
      })

      for (const capKey of Object.keys(this.caps).filter(c => c.startsWith('SIMPLEREST'))) {
        if (!this.delegateCaps[capKey]) this.delegateCaps[capKey] = this.caps[capKey]
      }
      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
      this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
    }

    debug('Validate delegate')
    return this.delegateContainer.Validate()
  }

  Build () {
    return this.delegateContainer.Build()
  }

  async Start () {
    await this.delegateContainer.Start()
    if (!_.isNil(this.caps[Capabilities.CHATLAYER_WELCOME_MESSAGE])) {
      await this.UserSays({ introMessage: {} })
    }
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

  _extractIntent (npl) {
    if (npl.intent) {
      return {
        name: npl.intent.name,
        confidence: npl.intent.score
      }
    }
    return {}
  }

  _extractEntities (npl) {
    debug('Entities in nlp object not yet supported by Chatlayer.')
    return []
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorChatlayer,
  features: {
    intentResolution: true,
    intentConfidenceScore: true
  }
}
