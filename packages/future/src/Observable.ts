// FIXME: linter
/* eslint-disable */

import { Fn } from './type_utils'
import {
  Instance,
  TransactionContext,
  TransactionCache,
  Context,
  defaultCtx,
} from './Context'
import { STOP, Key } from './constants'
import { invalid, isFunction, isString, assign } from './utils'

export type Options<I, O> = {
  /** Executor */
  fn: (
    input: TransactionCache<unknown>[],
    cache: Instance['cache'],
    tCtx: TransactionContext,
  ) => TransactionCache<O> | O

  /** Dependencies for receiving updates */
  deps: Observable[]

  /** Lift input to entry observable */
  lift: Fn<[I, TransactionContext, Observable<I, O>]>

  /** Descriptional name for better debugging */
  name?: string

  /** Unique key for access to an instance of a context */
  key?: Key

  /** Hook for react on adding a future instance to a context (by first subscription)
   * > useful for init producer
   */
  init?: (
    self: Observable<I, O>,
    cache: Instance['cache'],
    context: Context,
  ) => Fn | void

  /** Default context */
  ctx?: Context

  // TODO: add `meta?: Record<string, unknown>`
}

let _count = 0

/**
 * Context driven, ACID first, glitch-free observable
 */
export class Observable<I = unknown, O = I> {
  /**
   * user-space name
   */
  readonly _name: string

  /**
   * unique key for store and process instance data in Context / TransactionContext
   */
  readonly _key: Key

  /**
   * Depth of dependencies stack
   */
  readonly _depth: number

  /**
   * Shallow dependencies list
   */
  readonly _deps: Observable[]

  /**
   * Init hook
   */
  readonly _init?: Options<I, O>['init']

  /**
   * Wrapper for executor function from userspace
   */
  readonly _fn: (tCtx: TransactionContext) => void

  /**
   * Binded context
   */
  readonly _ctx: Context

  readonly _lift: Fn<[I, TransactionContext]>

  constructor(options: Options<I, O>) {
    const self = this as Observable
    const {
      lift,
      fn,
      deps: _deps,
      name: _name = 'Observable',
      key: _key = `[${++_count}] ${_name}`,
      init: _init,
      ctx: _ctx = defaultCtx,
    } = options

    invalid(!isFunction(fn), 'executor (fn)')

    invalid(!isString(_name), 'name')

    invalid(!isString(_key), 'key')

    invalid(!(_init === undefined || isFunction(_init)), 'init hook')

    invalid(!(_ctx === undefined || _ctx instanceof Context), 'default context')

    const _depth = _deps.reduce(
      (acc, o, i) => (
        invalid(o instanceof Observable === false, `dependency #${i + 1}`),
        Math.max(acc, o._depth + 1)
      ),
      0,
    )

    const _lift = (input: I, tCtx: TransactionContext) => {
      tCtx.queue.insert(_depth, this as Observable)

      lift(input, tCtx, this)
    }

    const _fn = {
      [_key](tCtx: TransactionContext) {
        invalid(
          tCtx instanceof TransactionContext === false,
          'transaction context',
        )

        const value = fn(
          _deps.map(
            (d) =>
              tCtx.cache.get(d._key) || new TransactionCache({ value: STOP }),
          ),
          (tCtx.ctx.get(_key) || new Instance()).cache,
          tCtx,
        )

        tCtx.resolve(
          self,
          value instanceof TransactionCache
            ? value
            : new TransactionCache({ value }),
        )
      },
    }[_key]

    this._name = _name
    this._key = _key
    this._depth = _depth
    this._deps = _deps
    this._init = _init
    this._fn = _fn
    this._ctx = _ctx
    this._lift = _lift
  }

  pipe<T1 extends TransactionCache<O>>(o1: Options<O, T1>): Observable<I, T1>

  pipe<T1 extends TransactionCache<I>, T2 extends TransactionCache<T1>>(
    o1: Options<O, T1>,
    o2: Options<T1, T2>,
  ): Observable<I, T2>

  pipe<
    T1 extends TransactionCache<I>,
    T2 extends TransactionCache<T1>,
    T3 extends TransactionCache<T2>
  >(
    o1: Options<O, T1>,
    o2: Options<T1, T2>,
    o3: Options<T2, T3>,
  ): Observable<I, T3>

  pipe<
    T1 extends TransactionCache<I>,
    T2 extends TransactionCache<T1>,
    T3 extends TransactionCache<T2>,
    T4 extends TransactionCache<T3>
  >(
    o1: Options<O, T1>,
    o2: Options<T1, T2>,
    o3: Options<T2, T3>,
    o4: Options<T3, T4>,
  ): Observable<I, T4>

  pipe<
    T1 extends TransactionCache<I>,
    T2 extends TransactionCache<T1>,
    T3 extends TransactionCache<T2>,
    T4 extends TransactionCache<T3>,
    T5 extends TransactionCache<T4>
  >(
    o1: Options<O, T1>,
    o2: Options<T1, T2>,
    o3: Options<T2, T3>,
    o4: Options<T3, T4>,
    o5: Options<T4, T5>,
  ): Observable<I, T5>

  pipe(...optionsList: Options<any, any>[]) {
    return optionsList.reduce(
      (acc, options) =>
        new Observable({
          ...options,
          deps: [acc as any],
        }) as any,
      this,
    )
  }

  /**
   * Clone observable with given context as a default
   */
  bind(_ctx: Context): Observable<I, O> {
    // FIXME: rewrite to recreation
    return assign(Object.create(this), { _ctx })
  }

  /**
   * Subscribe to result of observable calls
   */
  subscribe(cb: Fn<[TransactionCache<O>]>, ctx = this._ctx): Fn<[], void> {
    return ctx.subscribe(this, cb)
  }
}
