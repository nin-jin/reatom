import {
  Atom,
  Collection,
  Emitter,
  F,
  invalid,
  STOP,
  Transaction,
  TransactionError,
} from './internal'

/* Trick for TS structural type system */
declare const LINK_TAG: unique symbol
const PAYLOAD = Symbol(`@@Reatom: link payload`)

export class Link<Input, Output, Cache extends Collection = {}> extends Emitter<
  Output
> {
  /* Trick for TS structural type system */
  private [LINK_TAG]: true
  private [PAYLOAD]:
    | null
    | { value: Input; kind: 'sync' }
    | { value: Output; kind: 'async' }
  // FIXME: any
  private _options: LinkConstructorOptions<any, any, any>
  private _onInit?: OnInit<Input, Output, Cache>
  private _onCleanup?: ReturnType<
    Exclude<OnInit<Input, Output, Cache>, undefined>
  >
  public cache!: Cache
  public meta: Collection
  constructor(options: LinkConstructorOptions<Input, Output, Cache>) {
    const { onNext, onFail, onInit, meta, parent } = options

    function fn(
      this: Link<Input, unknown, Cache>,
      t: Transaction,
      cache: Cache,
    ) {
      invalid(t instanceof Transaction === false, 'transaction type')

      let input: any

      if (this[PAYLOAD]) {
        const payload = this[PAYLOAD]
        this[PAYLOAD] = null
        if (payload!.kind === 'async') return input
        /* else if (payload!.kind === 'sync')*/ input = payload!.value
      } else if (!parent || (input = t.get(parent)) === STOP) return STOP

      const result =
        input instanceof TransactionError
          ? onFail
            ? onFail.call(this, input.error, cache, t)
            : input
          : onNext.call(this, input, cache, t)

      if (result instanceof Promise) {
        result.then(
          value => {
            this[PAYLOAD] = { value, kind: 'async' }
            t.walk(this)
          },
          error => {
            this[PAYLOAD] = {
              value: new TransactionError(error),
              kind: 'async',
            }
            t.walk(this)
          },
        )
        return t.stop()
      }
      return result
    }

    // @ts-expect-error
    super(fn, parent ? [parent] : [])

    this._options = options
    this._onInit = onInit
    this.meta = meta || {}
  }

  protected _init() {
    super._init()
    this._onCleanup = this._onInit?.()
  }
  protected _cleanup() {
    super._cleanup()
    // @ts-expect-error
    this._onCleanup?.()
  }

  call(...a: Input extends undefined ? [] | [Input] : [Input]): Transaction
  call(value?: Input): Transaction {
    invalid(this.up.length !== 0, 'call of derived link')

    // @ts-expect-error
    this.cache[PAYLOAD] = { value, kind: 'sync' }
    return this.dispatch(new Transaction()) as Transaction
  }

  clone(): Link<Input, Output, Cache> {
    return new Link(this._options)
  }

  link<T, _Cache extends Collection = {}>(
    onNext: LinkFn<Output, T, _Cache>,
  ): Link<Output, T, _Cache>
  link<T, _Cache extends Collection = {}>(
    options: LinkOptions<Output, T, _Cache>,
  ): Link<Output, T, _Cache>
  link<T, _Cache extends Collection = {}>(
    onNextOrOptions: LinkFn<Output, T, _Cache> | LinkOptions<Output, T, _Cache>,
  ): Link<Output, T, _Cache> {
    const parent = this
    const options =
      typeof onNextOrOptions === 'function'
        ? { onNext: onNextOrOptions, parent }
        : { ...onNextOrOptions, parent }
    return new Link(options)
  }

  atom<State>(defaultState: State): Atom<never, Output | State>
  atom<State>(
    defaultState: State,
    reducer: (payload: Output, state: State) => State,
    options?: {
      meta?: Collection
    },
  ): Atom<never, State>
  atom<State>(
    defaultState: State,
    reducer: (payload: Output, state: State) => State = (v: any) => v,
    options?: {
      meta?: Collection
    },
  ): Atom<never, Output | State> {
    // FIXME:
    // @ts-ignore
    return new Atom({
      ...options,
      defaultState,
      reducer,
      parent: this,
    })
  }
}

export function link<T = undefined>(): Link<T, T>
export function link<
  Input = undefined,
  Output = unknown,
  Cache extends Collection = {}
>(onNext: LinkFn<Input, Output, Cache>): Link<Input, Output, Cache>
export function link<
  Input = undefined,
  Output = unknown,
  Cache extends Collection = {}
>(
  options: Omit<LinkOptions<Input, Output, Cache>, 'onFail'>,
): Link<Input, Output, Cache>
export function link<
  Input = undefined,
  Output = unknown,
  Cache extends Collection = {}
>(
  onNextOrOptions:
    | LinkFn<Input, Output, Cache>
    | Omit<LinkOptions<Input, Output, Cache>, 'onFail'> = (v: any) => v,
): Link<Input, Output, Cache> {
  const options =
    typeof onNextOrOptions === 'function'
      ? { onNext: onNextOrOptions }
      : onNextOrOptions
  return new Link({
    ...options,
    onNext(input, cache, transaction) {
      return options.onNext.call(this, input, cache, transaction)
    },
  })
}

export type LinkOptions<Input, Output, Cache extends Collection = {}> = {
  onNext: LinkFn<Input, Output, Cache>
  onFail?: LinkFn<unknown, Output, Cache>
  onInit?: OnInit<Input, Output, Cache>
  meta?: Collection
}
export type LinkConstructorOptions<
  Input,
  Output,
  Cache extends Collection = {}
> = LinkOptions<Input, Output, Cache> & { parent?: Emitter<Input> }

export type LinkFn<Input, Output, Cache extends Collection = {}> = (
  this: Link<Input, unknown, Cache>,
  input: Input,
  cache: Cache,
  transaction: Transaction,
) => STOP | Promise<STOP | Output> | Output

export type OnInit<Input, Output, Cache extends Collection = {}> = (
  this: Link<Input, Output, Cache>,
) => void | (() => void)
