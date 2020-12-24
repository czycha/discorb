import type {
  APIMessageContentResolvable,
  Client,
  Message,
  MessageAdditions,
  MessageOptions
} from 'discord.js'

export type HelpMessage =
  | APIMessageContentResolvable
  | (MessageOptions & { split?: false })
  | MessageAdditions

export type Help<S> =
  | HelpMessage
  | ((this: Bot<S>) => HelpMessage | Promise<HelpMessage>)

export interface Command<S> {
  action: Action<S>
  sub: Record<string, Command<S>>
  help?: Help<S>
}

export interface RegisterCommand<S> {
  command: string
  action: Action<S>
  help?: Help<S>
}

export interface CommandsThrough<S> {
  through: string[]
  command?: Command<S>
}

export interface Request<S> {
  message: Message
  components: string[]
  commands: string[]
  command?: Command<S>
  rest: string
  args: string[]
}

export type Action<S> = (
  this: Bot<S>,
  request: Request<S>
) => void | Promise<void>

interface ConstructorOptions {
  prefix: string
  invalidCommandError?: string
  errorMessage?: string
}

export type StateListener<S> = (
  this: Bot<S>,
  previousState: S,
  nextState: S
) => void | Promise<void>

export class Bot<S = never> {
  prefix: string
  commands: Record<string, Command<S>> = {}
  state: S
  invalidCommandError: string
  errorMessage: string
  stateListeners: Set<StateListener<S>> = new Set()

  protected client: Client | undefined

  constructor(options: ConstructorOptions) {
    const {
      prefix,
      invalidCommandError = `I've checked my data banks and could not find record of that command. Maybe you should check yours?`,
      errorMessage = 'Unexpected error completing your request. Check console for error log.'
    } = options
    this.prefix = prefix
    this.invalidCommandError = invalidCommandError
    this.errorMessage = errorMessage
  }

  setState<K extends keyof S>(state: Pick<S, K> | S | null) {
    const previous = this.state
    const next = { ...previous, ...state }
    this.state = next
    this.dispatchStateUpdate(previous, next)

    return this
  }

  onStateUpdate(action: StateListener<S>) {
    this.stateListeners.add(action)
    return this
  }

  dispatchStateUpdate(previousState: S, newState: S) {
    this.stateListeners.forEach((action) => {
      action.call(this, previousState, newState)
    })
  }

  parse(message: string): string[] {
    if (message.startsWith(this.prefix)) {
      const splits = message.trim().replace(/\s+/g, ' ').split(' ')
      if (splits.length > 0 && splits[0] !== this.prefix) {
        splits[0] = splits[0].slice(this.prefix.length)
        return splits
      }
    }
    return []
  }

  register(options: RegisterCommand<S>): Bot<S>
  register(commandPath: string, action: Action<S>): Bot<S>
  register(commandPath: string, action: Action<S>, help: Help<S>): Bot<S>
  register(
    ...arguments_:
      | [RegisterCommand<S>]
      | [string, Action<S>]
      | [string, Action<S>, Help<S>]
  ): Bot<S> {
    let commandPath: string, action: Action<S>, help: Help<S>
    if (typeof arguments_[0] === 'string') {
      ;[commandPath, action, help] = arguments_
    } else {
      ;({ action, help, command: commandPath } = arguments_[0])
    }
    const commands: string[] = commandPath.split(' ')
    const cmd = this.weakDive(commands)
    const newCmd: Command<S> = { action, sub: {}, help }
    if (cmd.command == undefined && commands.length === 1) {
      this.commands[commands[commands.length - 1]] = newCmd
    } else if (
      cmd.command != undefined &&
      cmd.through.length === commands.length - 1
    ) {
      cmd.command.sub[commands[commands.length - 1]] = newCmd
    } else {
      throw new Error('Unable to follow commands')
    }
    return this
  }

  help(commandPath: string, help: Help<S>) {
    const commands: string[] = commandPath.split(' ')
    const cmd = this.strictDive(commands)
    cmd.help = help
    return this
  }

  onError(error: Error, request: Request<S>) {
    console.error(error)
    if (request && request.message) {
      return request.message.reply(this.errorMessage)
    }
  }

  onInvalidCommand(message: Message) {
    return message.reply(this.invalidCommandError)
  }

  async receive(message: Message) {
    if (message.author.bot) return false
    const components = this.parse(message.content)
    if (components.length === 0) return false
    const { through, command } = this.weakDive(components)
    const arguments_ = components.slice(through.length, components.length)
    const rest = message.content
      .replace(new RegExp(`^${this.prefix}${through.join('\\s+')}\\s*`), '')
      .trim()
    const request: Request<S> = {
      message,
      components,
      commands: through,
      args: arguments_,
      rest,
      command
    }
    if (
      arguments_.length === 1 &&
      ((command == undefined && arguments_[0] === 'help') ||
        (command != undefined &&
          arguments_[0] === '--help' &&
          command.help != undefined))
    ) {
      await this.onHelp(request)
    } else if (command == undefined) {
      await this.onInvalidCommand(message)
    } else {
      try {
        await command.action.call(this, request)
      } catch (error) {
        await this.onError(error, request)
      }
    }
  }

  async onHelp(request: Request<S>) {
    if (request.command == undefined) {
      request.message.reply({
        embed: {
          title: 'Help',
          fields: [
            {
              name: 'Commands',
              value: [...Object.keys(this.commands), 'help']
                .sort()
                .map((cmd) => `- \`${cmd}\``)
                .join('\n')
            },
            {
              name: 'Help with commands',
              value: `You can get help with commands and sub-commands by running \`${this.prefix}command --help\``
            }
          ]
        }
      })
    } else {
      let helpMessage: HelpMessage
      if (typeof request.command.help === 'function') {
        try {
          helpMessage = await request.command.help.call(this)
        } catch (error) {
          await this.onError(error, request)
          return
        }
      } else {
        helpMessage = request.command.help
      }
      request.message.reply(helpMessage)
    }
  }

  strictDive(commands: string[]): Command<S> {
    let current: undefined | Command<S>
    for (const command of commands) {
      current =
        current != undefined ? current.sub[command] : this.commands[command]
      if (current == undefined) {
        break
      }
    }
    if (current != undefined) {
      return current
    } else {
      throw new Error('Unable to follow commands')
    }
  }

  weakDive(commands: string[]): CommandsThrough<S> {
    let last: undefined | Command<S>
    let current: undefined | Command<S>
    const through = []
    for (const command of commands) {
      last = current
      current =
        current != undefined ? current.sub[command] : this.commands[command]
      if (current == undefined) {
        return { through, command: last }
      }
      through.push(command)
    }
    return { through, command: current }
  }

  listen(client: Client) {
    this.client = client
    client.on('message', (message) => {
      this.receive(message)
    })

    return this
  }

  close() {
    const { client } = this
    if (client != undefined) {
      client.destroy()
    }

    return this
  }
}
