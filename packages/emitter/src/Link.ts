import {
  Collection,
  Emitter,
  F,
  invalid,
  STOP,
  Transaction,
  TransactionError,
  Atom,
} from './internal'

/* Trick for TS structural type system */
declare const LINK_TAG: unique symbol
export const PAYLOAD = Symbol(`@@Reatom: link payload`)

export class Link<
  Input,
  Output,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
> extends Emitter<Output> {
  /* Trick for TS structural type system */
  private [LINK_TAG]: true
  private _options: LinkConstructorOptions<any, any, any, any>
  private _onInit?: OnInit<Input, Output, Cache, Meta>
  private _onCleanup?: ReturnType<
    Exclude<OnInit<Input, Output, Cache, Meta>, undefined>
  >
  public cache!: Cache
  public meta: Meta
  constructor(options: LinkConstructorOptions<Input, Output, Cache, Meta>) {
    const {
      onNext,
      onFail,
      onInit,
      getMeta = () => ({} as Meta),
      parent,
    } = options

    function fn(
      this: Link<Input, Output, Cache, Meta>,
      t: Transaction,
      cache: any,
    ): any {
      invalid(t instanceof Transaction === false, 'transaction type')

      let input: any

      if (cache[PAYLOAD]) {
        const payload = cache[PAYLOAD]
        cache[PAYLOAD] = null
        input = payload.value
        if (payload.kind === 'async') return input
      } else if (!parent || (input = t.get(parent)) === STOP) return STOP

      const result =
        input instanceof TransactionError
          ? onFail
            ? onFail.call(this, input.error, cache, t)
            : input
          : onNext.call(this, input, cache, t)

      if (result instanceof Promise) {
        result.then(
          (value) => {
            if (value !== STOP) {
              cache[PAYLOAD] = { value, kind: 'async' }
              ;(t as Transaction).walk(this)
            }
          },
          (error) => {
            cache[PAYLOAD] = {
              value: new TransactionError(error),
              kind: 'async',
            }
            ;(t as Transaction).walk(this)
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
    this.meta = getMeta(this)
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

  clone(): Link<Input, Output, Cache, Meta> {
    return new Link(this._options)
  }

  link<T, C extends Collection = Collection>(
    onNext: Executor<Output, T, C>,
  ): Link<Output, T, C>
  link<T, C extends Collection = Collection, M extends Collection = Collection>(
    options: LinkOptions<Output, T, C, M>,
  ): Link<Output, T, C, M>
  link<T, C extends Collection = Collection, M extends Collection = Collection>(
    onNextOrOptions: Executor<Output, T> | LinkOptions<Output, T, C, M>,
  ): Link<Output, T, C, M> {
    const parent = this
    const options: LinkConstructorOptions<Output, T, C, M> =
      typeof onNextOrOptions === 'function'
        ? ({ onNext: onNextOrOptions, parent } as any)
        : { ...onNextOrOptions, parent }
    return new Link(options)
  }

  atom<State, _Meta extends Collection = Collection>(
    defaultState: State,
  ): Atom<Output, Output | State, _Meta>
  atom<State, _Meta extends Collection = Collection>(
    defaultState: State,
    reducer: (payload: Output, state: State) => STOP | State,
    options?: {
      getMeta?: ($atom: Atom<Output, State>) => _Meta
    },
  ): Atom<Output, State, _Meta>
  atom(
    defaultState: any,
    reducer: F = (v) => v,
    options?: {
      getMeta?: GetMeta<any, any, any, any>
    },
  ): any {
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
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
>(
  onNext: Executor<Input, Output, Cache, Meta>,
): Link<Input, Output, Cache, Meta>
export function link<
  Input = undefined,
  Output = unknown,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
>(options: {
  onNext: Executor<Input, Output, Cache, Meta>
  onInit?: OnInit<Input, Output, Cache, Meta>
  meta?: Meta
}): Link<Input, Output, Cache, Meta>
export function link(onNextOrOptions: any = (v: any) => v) {
  const options =
    typeof onNextOrOptions === 'function'
      ? { onNext: onNextOrOptions }
      : onNextOrOptions
  return new Link({
    ...options,
    onNext(input, cache, transaction) {
      return options.onNext.call(this, input, cache, transaction)
    },
  }) as any
}

export type LinkOptions<
  Input,
  Output,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
> = {
  onNext: Executor<Input, Output, Cache, Meta>
  onFail?: Executor<unknown, Output, Cache, Meta>
  onInit?: OnInit<Input, Output, Cache, Meta>
  getMeta?: GetMeta<Input, Output, Cache, Meta>
}
export type LinkConstructorOptions<
  Input,
  Output,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
> = LinkOptions<Input, Output, Cache, Meta> & { parent?: Emitter<Input> }

export type Executor<
  Input,
  Output,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
> = (
  this: Link<Input, any, Cache, Meta>,
  input: Input,
  cache: Cache,
  transaction: Transaction,
) => STOP | Promise<STOP | Output> | Output

export type OnInit<
  Input,
  Output,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
> = (this: Link<Input, Output, Cache, Meta>) => void | (() => void)

export type GetMeta<
  Input,
  Output,
  Cache extends Collection = Collection,
  Meta extends Collection = Collection
> = ($link: Link<Input, Output, Cache, Meta>) => Meta
