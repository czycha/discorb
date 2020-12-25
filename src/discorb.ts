import type {
  APIMessageContentResolvable,
  Client,
  Message,
  MessageAdditions,
  MessageOptions
} from 'discord.js'

/**
 * Message displayed when `<prefix><command> --help` or `<prefix>help` is called
 */
export type HelpMessage =
  | APIMessageContentResolvable
  | (MessageOptions & { split?: false })
  | MessageAdditions

type DefaultState = Record<string | number | symbol, unknown>

/**
 * Message or message generator to be displayed when `<prefix><command> --help` or `<prefix>help` is called
 * @typeParam S Bot state type
 */
export type Help<S = DefaultState> =
  | HelpMessage
  | ((this: Bot<S>) => HelpMessage | Promise<HelpMessage>)

/**
 * Registered command
 * @typeParam S Bot state type
 */
export interface Command<S = DefaultState> {
  action: Action<S>

  /**
   * Subcommands. For example `<prefix><command> <subcommand>`.
   */
  sub: Record<string, Command<S>>
  help?: Help<S>
}

/**
 * Interface for registering a command using just an object.
 */
export interface Plugin<S = DefaultState> {
  /**
   * Command path. For example, `<command>` or `<command> <subcommand>`
   */
  command: string
  action: Action<S>
  sub?: Record<string, Command<S>>
  help?: Help<S>
}

/**
 * Returned when searching for a command.
 * @typeParam S Bot state type
 */
export interface CommandsThrough<S = DefaultState> {
  /**
   * Commands and subcommand hierarchy to get to returned command. Inclusive of command.
   */
  through: string[]

  /**
   * Returned command, if found.
   */
  command?: Command<S>
}

/**
 * Discorb's custom request interface. Includes different interpretations of the incoming message and the message itself.
 * @typeParam S Bot state type
 */
export interface Request<S = DefaultState> {
  /**
   * The message that triggered the command.
   * @see {@link https://discord.js.org/#/docs/main/stable/class/Message | Discord's documentaton}
   */
  message: Message

  /**
   * The message contents, split by spaces and with the prefix removed.
   */
  components: string[]

  /**
   * The command path, including upper-level commands.
   */
  commands: string[]

  /**
   * The triggered command as registered in the bot.
   */
  command?: Command<S>

  /**
   * Message contents without the prefix and command.
   */
  rest: string

  /**
   * Everything after the command, split by spaces.
   */
  args: string[]
}

/**
 * Callback function for commands.
 *
 * @typeParam S Bot state type
 */
export type Action<S = DefaultState> =
  /**
   * @param this    Function is bound to the bot instance. **Not an actual param.**
   * @param request The request received that triggered the command.
   */
  (this: Bot<S>, request: Request<S>) => void | Promise<void>

/**
 * Options for constructing a new {@link Bot}.
 */
export interface ConstructorOptions {
  /** @see {@link Bot.prefix} **/
  prefix: string

  /** @see {@link Bot.invalidCommandError} **/
  invalidCommandError?: string

  /** @see {@link Bot.errorMessage} **/
  errorMessage?: string
}

/**
 * Listener for state changes.
 * @typeParam S Bot state type
 */
export type StateListener<S = DefaultState> =
  /**
   * @param this          Function is bound to the bot instance. **Not an actual param.**
   * @param previousState The previous state of the bot before the update.
   * @param nextState     The current, updated state of the bot.
   */
  (this: Bot<S>, previousState: S, nextState: S) => void | Promise<void>

/**
 * For use with {@link Bot.setState}. Either the entire state or a subset of it.
 * @typeParam S Bot state type
 * @typeParam K Keys of the bot state
 */
export type PartialState<S, K extends keyof S> = Pick<S, K> | S

/**
 * The main bot framework.
 * @typeParam S If you utilize the internal state for the bot, you can define the type and pass a generic type on initialization of the bot. Example:
 * ```typescript
 * interface BotState { ... }
 * const botWithState = new Bot<BotState>({ prefix: ';;' })
 * const botWithoutState = new Bot({ prefix: ';;' })
 * ```
 */
export class Bot<S = DefaultState> {
  /**
   * The prefix that marks a command for this bot. For example, `prefix: "!"` would mean that the bot would consider any message that starts with `!` to be intended for it.
   */
  prefix: string

  /**
   * The commands that are defined on the bot. **Not suggested to edit directly.**
   * @see {@link Bot.register}
   */
  commands: Record<string, Command<S>> = {}

  /**
   * The current state of the bot. **Do not edit this directly.**
   */
  state: S

  /**
   * Error given to user when they try an unregistered command.
   */
  invalidCommandError: string

  /**
   * Generic error given to user if an unexpected error occurs during command operation
   */
  errorMessage: string

  /**
   * Set of functions that will be called when the state is changed.
   */
  stateListeners: Set<StateListener<S>> = new Set()

  /**
   * Discord client to listen to messages on.
   * @see {@link https://discord.js.org/#/docs/main/stable/class/Client | Discord's documentation}
   */
  protected client: Client | undefined

  /**
   * Creates new bot instance.
   */
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

  /**
   * Updates state of the bot. Triggers a state update event. See {@link Bot.onStateUpdate}.
   * @param state Either whole or partial state to merge into the current state.
   * @return This bot instance.
   */
  setState<K extends keyof S>(state: PartialState<S, K>): Bot<S> {
    const previous = this.state
    const next = { ...previous, ...state }
    this.state = next
    this.dispatchStateUpdate(previous, next)

    return this
  }

  /**
   * Set a listener to trigger when the state updates.
   * @return This bot instance.
   */
  onStateUpdate(action: StateListener<S>): Bot<S> {
    this.stateListeners.add(action)
    return this
  }

  /**
   * Dispatches state update event.
   * @param previousState The previous state of the bot before the update.
   * @param newState     The current, updated state of the bot.
   */
  private dispatchStateUpdate(previousState: S, newState: S): void {
    this.stateListeners.forEach((action) => {
      action.call(this, previousState, newState)
    })
  }

  /**
   * Parse message if it starts with the bot prefix.
   * @return The message contents, split by spaces and with the prefix removed.
   */
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

  /**
   * Register a command all in one place. **Note: subcommands can only be defined after their parent commands are registered.**
   * @param options Command definition.
   * @return        The bot instance.
   */
  register(options: Plugin<S>): Bot<S>
  /**
   * Register a command. **Note: subcommands can only be defined after their parent commands are registered.**
   * @param commandPath What needs to be called to trigger a command. Example: `echo` or `roll advantage`.
   * @param action      What to do when the command is called.
   * @return            The bot instance.
   */
  register(commandPath: string, action: Action<S>): Bot<S>
  /**
   * Register a command with a help message. **Note: subcommands can only be defined after their parent commands are registered.**
   * @param commandPath What needs to be called to trigger a command. Example: `echo` or `roll advantage`.
   * @param action      What to do when the command is called.
   * @param help        The help message.
   * @return            The bot instance.
   */
  register(commandPath: string, action: Action<S>, help: Help<S>): Bot<S>
  register(
    ...arguments_:
      | [Plugin<S>]
      | [string, Action<S>]
      | [string, Action<S>, Help<S>]
  ): Bot<S> {
    let commandPath: string,
      action: Action<S>,
      help: Help<S>,
      sub: Record<string, Command<S>>
    if (typeof arguments_[0] === 'string') {
      ;[commandPath, action, help] = arguments_
    } else {
      ;({ action, help, command: commandPath, sub } = arguments_[0])
    }
    const commands: string[] = commandPath.split(' ')
    const cmd = this.weakDive(commands)
    const newCmd: Command<S> = { action, sub: sub ?? {}, help }
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

  /**
   * Register a help message for a command.
   * **Must be called _after_ the command is registered.**
   * @param commandPath The path to the command.
   * @param help        The help message.
   * @return            The bot instance
   */
  help(commandPath: string, help: Help<S>): Bot<S> {
    const commands: string[] = commandPath.split(' ')
    const cmd = this.strictDive(commands)
    cmd.help = help
    return this
  }

  /**
   * Called when an unexpected error occurs when running a command. Replies with {@link Bot.errorMessage}.
   * @param error   Error received. Printed to the console.
   * @param request Request received.
   */
  async onError(error: Error, request: Request<S>): Promise<void> {
    console.error(error)
    if (request && request.message) {
      await request.message.reply(this.errorMessage)
    }
  }

  /**
   * Called when a user attempts to run an unregistered command. Replies with {@link Bot.invalidCommandError}.
   * @param message The message received.
   */
  async onInvalidCommand(message: Message): Promise<void> {
    await message.reply(this.invalidCommandError)
  }

  /**
   * Called when a message is received. Interprets if it's intended for the bot and then calls the intended command (if registered).
   * @param message The received message.
   * @return        Returns `Promise<false>` if the message is clearly not intended for the bot.
   */
  async receive(message: Message): Promise<false | void> {
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

  /**
   * Called when the bot either receives the general `help` command or the command-level help command (`<prefix><command> --help`).
   * Responds with the defined help message.
   * @param request Request received.
   */
  async onHelp(request: Request<S>): Promise<void> {
    if (request.command == undefined) {
      await request.message.reply({
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
      await request.message.reply(helpMessage)
    }
  }

  /**
   * Find the command at this exact command path. Throws an error if not found.
   * @param commands  The command path to search for a command at.
   * @return          The command found at the command path.
   */
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

  /**
   * Try and find a command that matches a list of arguments. Dives deeper until it cannot recognize a registered command.
   * @param commands  The arguments which might contain a command path.
   * @return          The command (or not) and the path taken to get there.
   */
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

  /**
   * Listen to messages on this client.
   * @param client  The {@link https://discord.js.org/#/docs/main/stable/class/Client | Discord client} to listen on.
   * @return        The bot instance.
   */
  listen(client: Client): Bot<S> {
    this.client = client
    client.on('message', (message) => {
      this.receive(message)
    })

    return this
  }

  /**
   * Stop listening on current client and {@link https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=destroy | destroy it}.
   * @return The bot instance.
   */
  close(): Bot<S> {
    const { client } = this
    if (client != undefined) {
      client.destroy()
    }

    return this
  }
}
