const util = require('util')
const { URL } = require('url')
const _ = require('lodash')
const mime = require('mime-types')
const debug = require('debug')('botium-connector-chatlayer')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const CoreCapabilities = require('botium-core/src/Capabilities')

const Capabilities = {
  CHATLAYER_URL: 'CHATLAYER_URL',
  CHATLAYER_VERIFY_TOKEN: 'CHATLAYER_VERIFY_TOKEN',
  CHATLAYER_ACCESS_TOKEN: 'CHATLAYER_ACCESS_TOKEN',
  CHATLAYER_SESSION_DATA: 'CHATLAYER_SESSION_DATA',
  CHATLAYER_WELCOME_MESSAGE: 'CHATLAYER_WELCOME_MESSAGE',
  CHATLAYER_BOT_ID: 'CHATLAYER_BOT_ID',
  CHATLAYER_VERSION: 'CHATLAYER_VERSION',
  CHATLAYER_LANGUAGE: 'CHATLAYER_LANGUAGE'
}

const Defaults = {
  [Capabilities.CHATLAYER_VERSION]: 'DRAFT',
  [Capabilities.CHATLAYER_LANGUAGE]: 'en'
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
    if (!this.caps[Capabilities.CHATLAYER_ACCESS_TOKEN]) throw new Error('CHATLAYER_ACCESS_TOKEN capability required')
    if (!this.caps[Capabilities.CHATLAYER_VERIFY_TOKEN]) throw new Error('CHATLAYER_VERIFY_TOKEN capability required')

    this.delegateCaps = Object.assign({}, this.caps)

    if (!this.delegateContainer) {
      Object.assign(this.delegateCaps, {
        [CoreCapabilities.SIMPLEREST_URL]: this.caps[Capabilities.CHATLAYER_URL],
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
        [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: async ({ botMsg, msg }) => {
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

            if (botMsg.sourceData.nlp && _.get(botMsg.sourceData.nlp, 'intent.name')) {
              botMsg.nlp = await this._extractNlp(botMsg, msg)
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
    if (this.caps[Capabilities.CHATLAYER_WELCOME_MESSAGE]) {
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

  async _extractNlp (botMsg, msg) {
    const nlp = {
      intent: {
        name: botMsg.sourceData.nlp.intent.name,
        confidence: botMsg.sourceData.nlp.intent.score
      }
    }

    if (this.caps[Capabilities.CHATLAYER_BOT_ID] && msg.messageText) {
      const body = {
        language: this.caps[Capabilities.CHATLAYER_LANGUAGE],
        expression: msg.messageText
      }
      try {
        const baseUrl = new URL(this.caps[Capabilities.CHATLAYER_URL]).origin
        const requestOptions = {
          method: 'POST',
          url: `${baseUrl}/v1/bots/${this.caps[Capabilities.CHATLAYER_BOT_ID]}/nlp/extract?version=${this.caps[Capabilities.CHATLAYER_VERSION]}`,
          headers: {
            Authorization: `Bearer ${this.caps[Capabilities.CHATLAYER_ACCESS_TOKEN]}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
        const response = await fetch(requestOptions.url, {
          method: requestOptions.method,
          headers: requestOptions.headers,
          body: requestOptions.body
        })
        if (!response.ok) {
          const errorDetails = await response.text()
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorDetails}`)
        }
        const extractNlpResult = await response.json()
        if (_.get(extractNlpResult, 'extract.intents') && extractNlpResult.extract.intents.length > 0) {
          nlp.intent.intents = extractNlpResult.extract.intents.map(i => ({ name: i.intent, confidence: i.score }))
        }
        if (_.get(extractNlpResult, 'extract.entities') && extractNlpResult.extract.entities.length > 0) {
          nlp.entities = extractNlpResult.extract.entities.map(e => ({ name: e.name, value: e.value, confidence: e.score }))
        }
      } catch (err) {
        debug(`Cannot process detailed nlp data: ${err}`)
      }
    }

    return nlp
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorChatlayer,
  PluginDesc: {
    name: 'Chatlayer',
    provider: 'Chatlayer',
    features: {
      intentResolution: true,
      intentConfidenceScore: true,
      alternateIntents: true,
      entityResolution: true,
      entityConfidenceScore: true
    }
  }

}
