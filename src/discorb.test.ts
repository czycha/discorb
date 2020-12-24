import { Message } from 'discord.js'

import { Bot, Request } from './discorb'

const empty = jest.fn()

/** Creates a minimally viable mock for discorb's purposes **/
const mockMessage = (content: string, bot = false) =>
  (({
    reply: jest.fn((r) => Promise.resolve(r)),
    author: {
      bot
    },
    content
  } as unknown) as Message)

describe('parsing', () => {
  const bot = new Bot({ prefix: ';;' })
  it('fails when no prefix at start', () => {
    expect(bot.parse('test')).toEqual([])
    expect(bot.parse('test ;;me')).toEqual([])
    expect(bot.parse('  ;;test')).toEqual([])
  })

  it('succeeds with no arguments', () => {
    expect(bot.parse(';;test')).toEqual(['test'])
  })

  it('succeeds with multiple arguments', () => {
    expect(bot.parse(';;test my script')).toEqual(['test', 'my', 'script'])
    expect(bot.parse(';;test my script ;;')).toEqual([
      'test',
      'my',
      'script',
      ';;'
    ])
  })
})

describe('state', () => {
  let bot: Bot<{ value1: string; value2: string }>
  beforeEach(() => {
    bot = new Bot({ prefix: ';;' })
  })

  it('is empty initially', () => {
    expect(bot.state).toBeUndefined()
  })

  it('can be changed', () => {
    bot.setState({ value1: 'a' })
    expect(bot.state).toEqual({ value1: 'a' })

    bot.setState({ value2: 'b' })
    expect(bot.state).toEqual({ value1: 'a', value2: 'b' })

    bot.setState({ value2: 'B', value1: 'A' })
    expect(bot.state).toEqual({ value1: 'A', value2: 'B' })
  })

  it('setState returns Bot', () => {
    expect(bot.setState({})).toBe(bot)
  })

  it('can listen to changes', () => {
    const stateAction = jest.fn()
    bot.onStateUpdate(stateAction)

    bot.setState({ value1: 'a' })
    expect(stateAction).toHaveBeenCalled()
    expect(stateAction).toHaveBeenLastCalledWith(undefined, { value1: 'a' })

    bot.setState({ value2: 'b' })
    expect(stateAction).toHaveBeenCalled()
    expect(stateAction).toHaveBeenLastCalledWith(
      { value1: 'a' },
      { value1: 'a', value2: 'b' }
    )
  })

  it('can have multiple listeners on changes', () => {
    const stateAction1 = jest.fn()
    const stateAction2 = jest.fn()
    bot.onStateUpdate(stateAction1).onStateUpdate(stateAction2)

    bot.setState({ value1: 'a' })
    expect(stateAction1).toHaveBeenCalledTimes(1)
    expect(stateAction2).toHaveBeenCalledTimes(1)
  })
})

describe('commands', () => {
  describe('registering', () => {
    let bot: Bot
    beforeEach(() => {
      bot = new Bot({ prefix: ';;' })
    })

    it('returns Bot', () => {
      expect(bot.register('test', empty)).toBe(bot)
      expect(bot.help('test', 'Help!')).toBe(bot)
      expect(
        bot.register({
          command: 'test2',
          help: 'Help!',
          action: empty
        })
      ).toBe(bot)
    })

    it('can be defined at top level', () => {
      bot.register('test', empty)
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {}
        }
      })

      bot.register('anotherTest', empty)
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {}
        },
        anotherTest: {
          action: expect.any(Function),
          sub: {}
        }
      })

      bot.register({
        command: 'test2',
        action: empty
      })
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {}
        },
        anotherTest: {
          action: expect.any(Function),
          sub: {}
        },
        test2: {
          action: expect.any(Function),
          sub: {}
        }
      })
    })

    it('cannot define subcommands of commands that do not exist', () => {
      expect(() => {
        bot.register('test this', empty)
      }).toThrow()
    })

    it('can define subcommands', () => {
      bot.register('test', empty)

      bot.register('test this', empty)
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {
            this: {
              action: expect.any(Function),
              sub: {}
            }
          }
        }
      })

      bot.register('test this script', empty)
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {
            this: {
              action: expect.any(Function),
              sub: {
                script: {
                  action: expect.any(Function),
                  sub: {}
                }
              }
            }
          }
        }
      })
    })

    it('cannot set help messages for nonexistant commands', () => {
      expect(() => {
        bot.help('test', 'Help!')
      }).toThrow()
    })

    it('can set help messages', () => {
      bot.register('test', empty)
      bot.help('test', 'Help!')
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {},
          help: 'Help!'
        }
      })

      bot.register('test this', empty)
      bot.help('test this', 'Help!')
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {
            this: {
              action: expect.any(Function),
              sub: {},
              help: 'Help!'
            }
          },
          help: 'Help!'
        }
      })

      bot.register('test2', empty, 'Help!')
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {
            this: {
              action: expect.any(Function),
              sub: {},
              help: 'Help!'
            }
          },
          help: 'Help!'
        },
        test2: {
          action: expect.any(Function),
          sub: {},
          help: 'Help!'
        }
      })

      bot.register({
        command: 'test3',
        action: empty,
        help: 'Help!'
      })
      expect(bot.commands).toEqual({
        test: {
          action: expect.any(Function),
          sub: {
            this: {
              action: expect.any(Function),
              sub: {},
              help: 'Help!'
            }
          },
          help: 'Help!'
        },
        test2: {
          action: expect.any(Function),
          sub: {},
          help: 'Help!'
        },
        test3: {
          action: expect.any(Function),
          sub: {},
          help: 'Help!'
        }
      })
    })
  })

  describe('diving', () => {
    const bot = new Bot({ prefix: ';;' })
    bot
      .register('a', empty)
      .register('a aa', empty)
      .register('a aa aaa', empty)
      .register('b', empty)

    describe('strict', () => {
      it('top level', () => {
        expect(bot.strictDive(['a'])).toBe(bot.commands.a)
        expect(bot.strictDive(['b'])).toBe(bot.commands.b)
      })

      it('subcommands', () => {
        expect(bot.strictDive(['a', 'aa'])).toBe(bot.commands.a.sub.aa)
        expect(bot.strictDive(['a', 'aa', 'aaa'])).toBe(
          bot.commands.a.sub.aa.sub.aaa
        )
      })

      it('fails when no match found', () => {
        expect(() => {
          bot.strictDive(['z'])
        }).toThrow()

        expect(() => {
          bot.strictDive(['a', 'b'])
        }).toThrow()

        expect(() => {
          bot.strictDive(['a', 'aa', 'aaa', 'b'])
        }).toThrow()
      })
    })

    describe('weak', () => {
      it('top level, no args', () => {
        expect(bot.weakDive(['a'])).toEqual({
          through: ['a'],
          command: bot.commands.a
        })
      })

      it('subcommands, no args', () => {
        expect(bot.weakDive(['a', 'aa'])).toEqual({
          through: ['a', 'aa'],
          command: bot.commands.a.sub.aa
        })
        expect(bot.weakDive(['a', 'aa', 'aaa'])).toEqual({
          through: ['a', 'aa', 'aaa'],
          command: bot.commands.a.sub.aa.sub.aaa
        })
      })

      it('top level, with args', () => {
        expect(bot.weakDive(['a', 'b', 'c'])).toEqual({
          through: ['a'],
          command: bot.commands.a
        })
        expect(bot.weakDive(['b', 'c'])).toEqual({
          through: ['b'],
          command: bot.commands.b
        })
      })

      it('subcommands, with args', () => {
        expect(bot.weakDive(['a', 'aa', 'b', 'c'])).toEqual({
          through: ['a', 'aa'],
          command: bot.commands.a.sub.aa
        })
        expect(bot.weakDive(['a', 'aa', 'aaa', 'c'])).toEqual({
          through: ['a', 'aa', 'aaa'],
          command: bot.commands.a.sub.aa.sub.aaa
        })
      })

      it('returns empty when no top-level match', () => {
        expect(bot.weakDive(['z', 'a', 'aa'])).toEqual({
          through: [],
          command: undefined
        })
      })
    })
  })
})

describe('receiving messages', () => {
  let echo: jest.Mock<void, [request: Request<never>]>, bot: Bot
  beforeEach(() => {
    echo = jest.fn((request: Request<never>) => {
      request.message.reply(request.message.content)
    })
    bot = new Bot({ prefix: ';;' })
      .register('echo', echo)
      .help('echo', 'Echoes back what you say')
      .register('about', function (request) {
        request.message.reply(this.prefix)
      })
      .help('about', function () {
        return `More about this bot that has a prefix of ${this.prefix}`
      })
      .register('error', () => {
        throw new Error('Uh-oh')
      })
  })

  it('should ignore bots', async () => {
    const message = mockMessage(';;echo', true)
    const resp = await bot.receive(message)
    expect(resp).toEqual(false)
  })

  it('should respond with error on invalid commands', async () => {
    const message = mockMessage(';;yeet')
    await bot.receive(message)
    expect(message.reply).toHaveBeenCalledWith(bot.invalidCommandError)
  })

  it('should ignore non-prefixed messages', async () => {
    const message = mockMessage('echo is my favorite overwatch character')
    const resp = await bot.receive(message)
    expect(resp).toEqual(false)
  })

  it('should ignore empty prefixed messages', async () => {
    const message = mockMessage(';;')
    const resp = await bot.receive(message)
    expect(resp).toEqual(false)
  })

  it('should pass request to command action', async () => {
    const message = mockMessage(";;echo Hi! I'm a bot!")
    await bot.receive(message)
    expect(echo).toHaveBeenCalled()
    expect(echo).toHaveBeenLastCalledWith({
      message,
      args: ['Hi!', "I'm", 'a', 'bot!'],
      command: bot.commands.echo,
      commands: ['echo'],
      components: ['echo', 'Hi!', "I'm", 'a', 'bot!'],
      rest: "Hi! I'm a bot!"
    })
  })

  it('should reply with error message on error', async () => {
    const originalError = console.error
    console.error = jest.fn()

    const message = mockMessage(';;error')
    await bot.receive(message)
    expect(message.reply).toHaveBeenCalledWith(bot.errorMessage)

    console.error = originalError
  })

  it('should call registered command', async () => {
    const contents = ';;echo yeet'
    const message = mockMessage(contents)
    await bot.receive(message)
    expect(message.reply).toHaveBeenCalledWith(contents)
  })

  it('should respond with help message if help and command are given', async () => {
    const message = mockMessage(';;echo --help')
    await bot.receive(message)
    expect(message.reply).toHaveBeenCalledWith('Echoes back what you say')

    const message2 = mockMessage(';;about --help')
    await bot.receive(message2)
    expect(message2.reply).toHaveBeenCalledWith(
      'More about this bot that has a prefix of ;;'
    )
  })

  it('should bind actions to bot', async () => {
    const message = mockMessage(';;about')
    await bot.receive(message)
    expect(message.reply).toHaveBeenCalledWith(bot.prefix)
  })
})
