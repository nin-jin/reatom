// FIXME: linter
/* eslint-disable */

import { Fn } from './type_utils'
import { callSafety, invalid, Queue, getKind, isFunction } from './utils'
import { Key, CacheKind } from './constants'
import { Observable } from './Observable'

/**
 * > https://en.wikipedia.org/wiki/Rollback_(data_management)
 */
export type Rollback = Fn

export function isEmpty(instance: Instance) {
  return instance.links.length === 0 && instance.listeners.length === 0
}

/** Observable instance */
export class Instance {
  /** Dependend futures */
  links: Observable[] = []

  /** Depended listeners (side-effects) */
  listeners: Fn<[unknown], void>[] = []

  /** Cache for storing data related to future instance in context  */
  cache: Record<string, unknown> = {}

  /** Collback for cleanuping, called when all depended listeners are unsubscribed  */
  cleanup?: Fn | void
}

/** Observable instance (executor result) during transaction */
export class TransactionCache<T = unknown> {
  /** Executor result */
  value: T

  /** Kind of executor result */
  kind: CacheKind

  /** Rollback */
  rollback?: Rollback

  constructor(opts: { value: T; kind?: CacheKind; rollback?: Rollback }) {
    const { value, kind = getKind(value), rollback } = opts

    this.value = value
    this.kind = kind
    this.rollback = rollback
  }
}

/** Transaction context */
export class TransactionContext {
  /** Observable queue */
  queue = new Queue<Observable>()

  /** KV storage of futures transaction cache */
  cache = new Map<Key, TransactionCache>()

  /** Current (processed) observable */
  current?: Observable

  isFailed = false

  /** Base context */
  constructor(public ctx: Context) {}

  /** Continue transaction */
  continue() {
    this.current = this.queue.extract()
    if (this.current) this.current._fn(this)
  }

  /** Resolve observable work */
  resolve<T>(o: Observable<any, T>, tCache: TransactionCache<T>) {
    this.cache.set(o._key, tCache)

    if (tCache.kind !== 'stop') {
      const instance = this.ctx.get(o._key)
      if (instance) {
        if (tCache.kind === 'error' && instance.listeners.length) {
          this.isFailed = true

          // try to not use a iterator for minify a transpiler output
          const rollbacks: Rollback[] = []
          this.cache.forEach(({ rollback }) => {
            if (rollback) rollbacks.unshift(rollback)
          })
          rollbacks.forEach((rollback) => callSafety(rollback))

          throw tCache.value
        }
        instance.links.forEach((l) => this.queue.insert(l._depth, l))
      }
    }

    this.continue()
  }
}

/** Context for store futures instances for controling it execution
 * (topological sorting, ACID)
 * and notify listeners (subscribers)
 * > https://en.wikipedia.org/wiki/ACID
 */
export class Context {
  protected _lifeCycleQueue: Fn[] = []

  protected _links = new Map<Key, Instance>()

  protected _listeners: Fn<[TransactionContext['cache']]>[] = []

  _link(target: Observable<any, any>, dependent?: Observable<any, any>) {
    const { _key, _deps, _init } = target

    let targetInstance = this.get(_key)

    if (targetInstance === undefined) {
      this._links.set(_key, (targetInstance = new Instance()))

      // _init life cycle method must be called starts from parent to child
      _deps.forEach((dep) => this._link(dep, target))

      if (_init !== undefined) {
        this._lifeCycleQueue.push(
          () =>
            (targetInstance!.cleanup = _init!(
              target,
              targetInstance!.cache,
              this,
            )),
        )
      }
    }

    if (dependent !== undefined) targetInstance.links.push(dependent)

    return targetInstance
  }

  _unlink(target: Observable<any, any>, dependent?: Observable<any, any>) {
    const { _key, _deps } = target

    const targetInstance = this.get(_key)

    if (targetInstance !== undefined) {
      if (dependent !== undefined) {
        targetInstance.links.splice(targetInstance.links.indexOf(dependent), 1)
      }

      if (isEmpty(targetInstance)) {
        this._links.delete(_key)

        // cleanup life cycle method must be called starts from child to parent
        if (targetInstance.cleanup) {
          this._lifeCycleQueue.push(targetInstance.cleanup)
        }

        _deps.forEach((dep) => this._unlink(dep, target))
      }
    }
  }

  _lifeCycle() {
    while (this._lifeCycleQueue.length !== 0)
      // it will be good to catch an errors and do rollback of the linking
      // but it not required for all users and implementation code is not tree-shackable
      // so it good for implementing in some extra package by Ctx extending
      callSafety(this._lifeCycleQueue.shift()!)
  }

  /** Subscribe to end of transaction */
  subscribe(cb: Fn<[TransactionContext]>): () => void

  /** Subscribe to future update */
  subscribe<T>(
    target: Observable<any, T>,
    cb: Fn<[TransactionCache<T>]>,
  ): () => void

  subscribe<T>(
    target: Observable<any, T> | Fn<[TransactionContext]>,
    cb?: Fn<[TransactionCache<T>]>,
  ): () => void {
    let isSubscribed = true

    if (!(target instanceof Observable)) {
      invalid(!isFunction(target), 'callback (must be a function)')
      this._listeners.push(cb as any)

      return () => {
        if (isSubscribed) {
          isSubscribed = false
          this._listeners.splice(this._listeners.indexOf(cb as any), 1)
        }
      }
    }

    invalid(!isFunction(cb), 'callback (must be a function)')

    const { listeners } = this._link(target)

    listeners.push(cb as any)

    this._lifeCycle()

    return () => {
      if (isSubscribed) {
        isSubscribed = false
        listeners.splice(listeners.indexOf(cb as any), 1)

        this._unlink(target)

        this._lifeCycle()
      }
    }
  }

  /** Get future instance
   * (returns undefined if future has no one subscriber)
   */
  get(targetKey: Key): Instance | undefined {
    return this._links.get(targetKey)
  }

  /** Control observables links execution and garant it ACID
   * > https://en.wikipedia.org/wiki/ACID
   */
  // TODO: `asyncTransaction` for `I` from `ACID`
  // TODO: `transactions` or `batch` for concatinating transactions
  transaction<I, O>(
    obs: Observable<I, O>,
    input: I,
  ): TransactionContext['cache'] {
    const tCtx = new TransactionContext(this)
    const { cache } = tCtx

    obs._lift(input, tCtx)

    let start = Symbol()
    let error = start
    while (true) {
      try {
        if (start === error) {
          tCtx.continue()
        } else {
          const current = tCtx.current!
          if (current)
            tCtx.resolve(
              current,
              new TransactionCache({
                value: error,
                kind: 'error',
              }),
            )
        }

        break
      } catch (_error) {
        if (tCtx.isFailed) throw error
        error = _error
      }
    }

    cache.forEach((tCache, _key) => {
      if (tCache.kind === 'stop') return

      const instance = this.get(_key)

      if (instance) instance.listeners.forEach((cb) => callSafety(cb, tCache))
    })

    this._listeners.forEach((cb) => callSafety(cb, tCtx.cache))

    return tCtx.cache
  }
}

export const defaultCtx = new Context()
