import { Client, VoiceChannel, VoiceConnection } from 'discord.js'
import path from 'path'

import { Bot } from '../src/discorb'

type OrEmpty<T> = T | Record<keyof T, undefined>
type BotState = OrEmpty<JoinedVoice>
interface JoinedVoice {
  voiceChannel: VoiceChannel
  voiceConnection: VoiceConnection
}

const bot = new Bot<BotState>({ prefix: ';;' })
  .register('ping', (request) => {
    request.message.reply(
      request.args.length > 0
        ? `Pong! (with args: ${request.args.map((a) => `\`${a}\``).join(' ')})`
        : 'Pong!'
    )
  })
  .help(
    'ping',
    `Responds with "Pong!" as well as returning any additional arguments.`
  )
  .register('join', async function (request) {
    const channel = request.message.member.voice.channel
    if (channel == undefined) {
      request.message.reply('Join what?')
      return
    }
    if (this.state != undefined && this.state.voiceChannel != undefined) {
      channel.leave()
    }
    try {
      const connection = await channel.join()
      this.setState({ voiceChannel: channel, voiceConnection: connection })
    } catch {
      request.message.reply(`Can't do that, boss.`)
    }
  })
  .help('join', 'Have me join you in your voice channel.')
  .register('ping sound', async function (request) {
    const connection = this.state.voiceConnection
    if (connection == undefined) {
      await request.message.reply(
        `Not in a channel. Call ${this.prefix}join to have me join you.`
      )
      return
    }
    connection.play(path.join(__dirname, './sound.wav'))
  })
  .help('ping sound', 'Plays sound in current voice channel')

if (process.env.DISCORD_LOGIN == undefined) {
  throw new Error('Please provide a DISCORD_LOGIN env variable')
} else {
  const client = new Client()
  client.login(process.env.DISCORD_LOGIN)
  bot.listen(client)
}
