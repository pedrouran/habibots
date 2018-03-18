/* jslint bitwise: true */
/* jshint esversion: 6 */

'use strict'

const Defaults = {
  host:         '127.0.0.1',
  loglevel:     'debug',
  port:         1337,
  reconnect:    true,
  slackChannel: 'general',
}

const fs = require('fs')
var log = require('winston')
log.remove(log.transports.Console)
log.add(log.transports.Console, { 'timestamp': true })

const RtmClient = require('@slack/client').RtmClient
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const MemoryDataStore = require('@slack/client').MemoryDataStore

const constants = require('../constants')
const HabiBot = require('../habibot')

const Argv = require('yargs')
  .usage('Usage: $0 [options]')
  .help('help')
  .option('help', { alias: '?', describe: 'Get this usage/help information.' })
  .option('host', { alias: 'h', default: Defaults.host, describe: 'Host name or address of the Elko server.' })
  .option('loglevel',  { alias: ';', default: Defaults.loglevel, describe: 'Log level name. (see: npm winston)'})
  .option('port', { alias: 'p', default: Defaults.port, describe: 'Port number for the Elko server.' })
  .option('context', { alias: 'c', describe: 'Context to enter.' })
  .option('greetingFile', { alias: 'g', describe: 'File to be played as a greeting.' })
  .option('reconnect', { alias: 'r', default: Defaults.reconnect, describe: 'Whether the bot should reconnect on disconnection.' })
  .option('slackToken', { alias: 's', default: Defaults.slackToken, describe: 'Token for sending user notifications to Slack.' })
  .option('slackChannel', { alias: 'l', default: Defaults.slackChannel, describe: 'Default Slack channel to use for notifications.' })
  .option('username', { alias: 'u', describe: 'Username of this bot.' })
  .argv

log.level = Argv.loglevel

const HatcheryBot = HabiBot.newWithConfig(Argv.host, Argv.port, Argv.username)
const GreetingText = fs.readFileSync(Argv.greetingFile).toString().replace(/\r/g, "").split('\n')

const SlackEnabled = Argv.slackToken !== ''
const SlackClient = new RtmClient(Argv.slackToken, {
  logLevel: 'error', 
  dataStore: new MemoryDataStore(),
  autoReconnect: true,
  autoMark: true 
})

let SlackChannelId
SlackClient.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
    if (c.name === Argv.slackChannel) {
      SlackChannelId = c.id 
    }
  }
})

HatcheryBot.on('connected', (bot) => {
  log.debug('HatcheryBot connected.')
  bot.gotoContext(Argv.context)
})

HatcheryBot.on('enteredRegion', (bot, me) => {
  bot.ensureCorporated()
    .then(() => bot.walkTo(44, 137, 1))
    .then(() => HatcheryBot.wait(10000))
    .then(() => bot.faceDirection(constants.FORWARD))
    .then(() => SlackClient.sendMessage("HatcheryBot engaged.", SlackChannelId))
})

HatcheryBot.on('APPEARING_$', (bot, msg) => {
  var avatar = bot.getNoid(msg.appearing)
  if (avatar == null) {
    log.error('No avatar found at noid: %s', msg.appearing)
    return
  }
  
  bot.say("TO: " + avatar.name)
    .then(() => bot.wait(5000))
    .then(() => bot.ESPsayLines(GreetingText))
    .then(() => bot.wait(5000))
    .then(() => bot.ESPsay(""))
    .then(() => bot.wait(15000))
    .then(() => bot.say(avatar.name + ", your visa was approved. Please proceed through the door."))
})

HatcheryBot.on('SPEAK$', (bot, msg) => {
  var avatar = bot.getNoid(msg.noid)
  if (msg.noid === bot.getAvatarNoid()) {
    return
  }
  
  if (msg.text === "!help") {
    bot.say("TO: " + avatar.name)
      .then(() => bot.wait(5000))
      .then(() => bot.ESPsayLines(GreetingText))
      .then(() => bot.wait(3000))
      .then(() => bot.ESPsay(""))
   }
})

HatcheryBot.on('CLOSE$', (bot, msg) => {
  bot.openDoor(HatcheryBot.getNoid(msg.target).ref)
    .then(() => bot.say("Hmmm. People keep closing the door..."))
})

HatcheryBot.connect()

if (SlackEnabled) {
  SlackClient.start()
}
