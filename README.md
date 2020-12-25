# Discorb

A flexible framework for creating a Discord bot in Typescript.

## Installation

```bash
yarn add discorb discord.js
```

## What do I need to get started?

- To create a [Discord application](https://discord.com/developers/applications)
- To create a bot user attached to your application
- To have the bot's secret token (suggested to add to the environment and loaded via [dotenv](https://npm.im/dotenv))
- A vision for the future

## Simple example

```typescript
import { Bot } from 'discorb'
import { Client } from 'discord.js'

const bot = new Bot({ prefix: ';;' })
  // ;;ping
  // ;;ping This will also be returned
  .register('ping', (request) => {
    request.message.reply(
      request.args.length > 0
        ? `Pong! (with args: ${request.args.map((a) => `\`${a}\``).join(' ')})`
        : 'Pong!'
    )
  })
  // ;;ping --help
  .help(
    'ping',
    `Responds with "Pong!" as well as returning any additional arguments.`
  )
  // ;;ping pong
  .register('ping pong', (request) => {
    request.message.reply('Ping pong!')
  })
  // ;;ping pong --help
  .help('ping pong', 'Just says ping pong! Simple as that!')

if (process.env.DISCORD_LOGIN == undefined) {
  throw new Error('Please provide a DISCORD_LOGIN env variable')
} else {
  const client = new Client()
  client.login(process.env.DISCORD_LOGIN)
  bot.listen(client)
}

process.on('exit', () => {
  bot.close()
})
```

_For more, take a look at [the examples directory](/examples)._

## Documentation

[View documentation here.](https://czycha.github.io/discorb)

## License

This project uses the following license: [Hippocratic v2.1](/LICENSE.md).
