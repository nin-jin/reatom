// FIXME: linter
/* eslint-disable */

import {
  noop,
  ReatomError,
  Collection,
  F,
  callSafety,
  invalid,
  isFunction,
  STOP,
  Event,
} from './internal'

export function spliceOne<T>(list: Array<T>, el: T) {
  list.splice(list.indexOf(el), 1)
}

/* Trick for TS structural type system */
declare const EMITTER_TAG: unique symbol

let n = 0
export type EmitterAny = Emitter<any>
/** Emitter may depends by other emitters.
 *
 * Dependent emitters are sort topologically that grant glitch free (it better for performance and calculation consistency).
 *
 * Also it works like warm observable and emit updates only when have a listeners.
 *
 * While a emitter have a listeners it store a cache thats may used for store temporal data. It clear when all listeners is unsubscribed.
 *
 * First subscription is initiate all dependencies - parents emitters (make it hot - store cache and propagate updates). Last unsubscribe is off dependencies.
 */
export class Emitter<T> {
  /* Trick for TS structural type system */
  private [EMITTER_TAG]: true
  /** creation sequence number */
  n: number
  /** userspace function */
  fn: (this: Emitter<T>, event: Event, cache: Cache) => STOP | T
  /** parents - dependencies */
  up: Array<EmitterAny>
  /** children - dependents */
  to: Array<EmitterAny>
  /** subscribers */
  su: Array<F>
  /** temporal cache for userspace data */
  cache: Cache

  constructor(fn: F<[Event, Cache], STOP | T>, up: Array<EmitterAny> = []) {
    invalid(!isFunction(fn), 'fn')
    invalid(
      up.some((l) => l instanceof Emitter === false),
      'dependency',
    )

    this.n = ++n
    this.fn = fn
    this.up = up
    this.to = []
    this.su = []
    this.cache = {}
  }

  private _isEmpty() {
    return this.to.length === 0 && this.su.length === 0
  }

  private _link(child: EmitterAny) {
    if (this._isEmpty()) this._init()
    this.to.push(child)
  }
  private _unlink(child: EmitterAny) {
    spliceOne(this.to, child)
    if (this._isEmpty()) this._cleanup()
  }

  /** Calls when get first subscription ot dependent link.
   * You may extend Emitter and rewrite it to make side-effects
   */
  protected _init() {
    this.up.forEach((parent) => parent._link(this))
  }
  /** Calls when leave last subscription and dependent link.
   * You may extend Emitter and rewrite it to make side-effects
   */
  protected _cleanup() {
    this.up.forEach((parent) => parent._unlink(this))
    this.cache = {}
  }

  /** Create dependent emitter */
  chain<_T>(fn: F<[Exclude<T, STOP>, Cache, Event], _T>): Emitter<_T> {
    invalid(!isFunction(fn), 'fn')
    return new Emitter((t, cache) => fn(t.get(this) as any, cache, t), [this])
  }

  /** Subscribe to result of emitter function call */
  subscribe(callback: F<[T]>): () => void {
    invalid(!isFunction(callback), 'callback')

    if (this._isEmpty()) this._init()

    let isSubscribed = true

    this.su.push(callback)

    return () => {
      if (isSubscribed) {
        isSubscribed = false
        spliceOne(this.su, callback)
        if (this._isEmpty()) this._cleanup()
      }
    }
  }

  /** Emit event to all dependent links and subscribers */
  dispatch(event = new Event()) {
    invalid(this.up.length !== 0, 'dispatch of derived emitter')
    return event.walk(this)
  }

  /** Emit value only to subscribers */
  emit<T>(value: T) {
    this.su.forEach((cb) => callSafety(cb, value))
  }

  pipe<T1 extends EmitterAny>(...operators: [F<[this], T1>]): T1
  pipe<T1 extends EmitterAny, T2 extends EmitterAny>(
    ...operators: [F<[this], T1>, F<[T1], T2>]
  ): T2
  pipe<T1 extends EmitterAny, T2 extends EmitterAny, T3 extends EmitterAny>(
    ...operators: [F<[this], T1>, F<[T1], T2>, F<[T2], T3>]
  ): T3
  pipe<
    T1 extends EmitterAny,
    T2 extends EmitterAny,
    T3 extends EmitterAny,
    T4 extends EmitterAny
  >(...operators: [F<[this], T1>, F<[T1], T2>, F<[T2], T3>, F<[T3], T4>]): T4
  pipe<
    T1 extends EmitterAny,
    T2 extends EmitterAny,
    T3 extends EmitterAny,
    T4 extends EmitterAny,
    T5 extends EmitterAny
  >(
    ...operators: [
      F<[this], T1>,
      F<[T1], T2>,
      F<[T2], T3>,
      F<[T3], T4>,
      F<[T4], T5>,
    ]
  ): T5
  pipe(
    ...operators: [F<[this], EmitterAny>, ...Array<F<[EmitterAny], EmitterAny>>]
  ): EmitterAny {
    // @ts-expect-error
    return operators.reduce((acc, operator) => operator(acc), this)
  }
}

export type Cache = Collection<unknown>
