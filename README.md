# Discorb

A flexible framework for creating a Discord bot in Typescript.

## Installation

```bash
yarn add discorb discord.js
```

## What do I need?

- To create a [Discord application](https://discord.com/developers/applications)
- To create a bot user attached to your application
- To have the bot's secret token (suggested to add to the environment and loaded via [dotenv](https://npm.im/dotenv))

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
```

_For more, take a look at [the examples directory](/examples)._

## Documentation

### Initialization

```typescript
new Bot<S>(options: ConstructorOptions)
```

#### `options: ConstructorOptions`

```typescript
interface ConstructorOptions {
  prefix: string
  invalidCommandError?: string
  errorMessage?: string
}
```

| Property              | Description                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefix`              | The prefix that marks a command for this bot. For example, `prefix: "!"` would mean that the bot would consider any message that starts with `!` to be intended for it. |
| `invalidCommandError` | What is sent if the command doesn't exist.                                                                                                                              |
| `errorMessage`        | What is sent if an unexpect error is thrown.                                                                                                                            |

#### State generic type (`S`)

If you utilize the internal state for the bot, you can define the type and pass a generic type on initialization of the bot.

#### Example

```typescript
interface BotState { ... }

const botWithState = new Bot<BotState>({ prefix: ';;' })
const botWithoutState = new Bot({ prefix: ';;' })
```

### Registering commands

```typescript
bot.register(commandPath: string, action: CommandAction<S>) => bot
```

#### The command path

Commands can be top-level or nested. For example, a command path of `top` would be triggered on `<prefix>top`. A command path of `top sub` would be triggered on `<prefix>top sub`. This can continue to infinite lengths.

##### Caveat

Subcommands must be registered after the command that owns it. So `top sub` must be registered after `top sub` and `top sub sub` must be registered after `top sub sub`.

#### Action

```typescript
type Action<S> = (this: Bot<S>, request: Request<S>) => void | Promise<void>
```

Called when a command is sent to the bot. Bound to the bot instance.

##### `request: Request<S>`

```typescript
interface Request<S> {
  message: discord.Message
  components: string[]
  commands: string[]
  command?: Command<S>
  rest: string
  args: string[]
}
```

| Property   | Description                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| message    | The message received that triggered the command. [More on Discord.js docs.](https://discord.js.org/#/docs/main/stable/class/Message) |
| components | The message contents, split by spaces and with the prefix removed.                                                                   |
| commands   | The command path.                                                                                                                    |
| command    | The command as stored in the bot.                                                                                                    |
| rest       | Message contents without the prefix and command.                                                                                     |
| args       | Everything after the command, split by spaces.                                                                                       |

### Registering help messages

```typescript
bot.help(commandPath: string, help: Help) => bot
```

Help message displayed when `<prefix><commandPath> --help` or `<prefix>help` (for all commands) is called.

#### `help: Help`

```typescript
type Help =
  | discord.APIMessageContentResolvable
  | (discord.MessageOptions & { split?: false })
  | discord.MessageAdditions
```

Typically, this will either be a string for simple responses, or [`discord.MessageOptions`](https://discord.js.org/#/docs/main/stable/typedef/MessageOptions) or [`discord.MessageAdditions`](https://discord.js.org/#/docs/main/stable/typedef/MessageAdditions) to send richer responses.

#### Caveat

Help messages must be registered after the relevant command.

#### Example

```typescript
bot
  .register('echo', (request) => { ... })
  .help('echo', 'Repeats back what you say!')
```

### State

```typescript
bot.state: S
bot.setState<K extends keyof S>(state: Pick<S, K> | S | null) => bot
bot.onStateUpdate(action: StateListener<S>)
```

Discorb bots can maintain internal state using the `state` property and `setState` setter. `setState` is a convenience function for merging state. This is useful for storing voice connections, keeping track of channels, or for managing games. Listeners can be attached to state updates with `onStateUpdate`. This is useful for side-effects that don't need to be contained within the command action.

#### `action: StateListener<S>`

```typescript
type StateListener<S> = (
  this: Bot<S>,
  prevState: S,
  nextState: S
) => void | Promise<void>
```

**Note:** Equality is not checked before triggering state listeners. If you need to check if a property is changed, do so within the state listener.

#### Example

```typescript
bot
  .register('store', function (request) {
    this.setState({ store: request.rest })
    request.message.reply(`Stored \`${request.rest}\``)
  })
  .register('store --get', function (request) {
    request.message.reply(`\`${JSON.stringify(this.state.store)}\``)
  })
  .onStateUpdate((prevState, nextState) => {
    if (prevState != null && prevState.store !== nextState.store) {
      fs.writeFile(STORE_PATH, store)
    }
  })
```

### Client

#### Listening

```typescript
bot.listen(client: discord.Client) => bot
```

Listen to the Discord [client](https://discord.js.org/#/docs/main/stable/class/Client). This must be called to have the bot receive and parse messages.

##### Example

```typescript
import { Bot } from 'discord'
import { Client } from 'discord.js'

const client = new Client()
const bot = new Bot({ ... })
bot.listen(client)

client.login(DISCORD_LOGIN)
```

#### Disconnecting

```typescript
bot.close() => bot
```

[Destroys](https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=destroy) the Discord [client](https://discord.js.org/#/docs/main/stable/class/Client).

##### Example

```typescript
process.on('exit', () => bot.close())
```
