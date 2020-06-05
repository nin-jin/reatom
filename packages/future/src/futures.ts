// FIXME: linter
/* eslint-disable */

// TODO: JSDoc
import { INTERNAL, STOP } from './constants'
import { assign, filterStopUndef } from './utils'
import { Fn, FilterStopNever, FnI, FnO } from './type_utils'
import { Instance, TransactionCache, Context } from './Context'
import { Observable, Options } from './Observable'
import { inferOptions } from './inferOptions'

type AwaitChain<T> = FilterStopNever<T extends Promise<infer _T> ? _T : never>
type ContinueAsync<O, T> = O extends Promise<any> ? Promise<T> : T

class AsyncChainPayload<T> {
  constructor(public value: TransactionCache<T>) {}
}

export type Future<
  I,
  O
  // Meta extends { kind: CacheKind } = { kind: 'payload' }
> = {
  // FIXME: replace `unknown` to `O`
  (): I extends undefined ? unknown : never
  (input: I, context?: Context): unknown // O
  chain: <T>(fn: Fn<[FilterStopNever<O>, Instance['cache']], T>) => Future<I, T>
  chainAtom: <T>(
    defaultState: T,
    fn: Fn<[FilterStopNever<O>, T], T>,
  ) => Future<I, T>
  chainAsync: <T>(
    fn: Fn<[AwaitChain<O>, Instance['cache']], T>,
  ) => Future<I, Promise<T>>
  chainError: <T>(fn: Fn<[unknown, Instance['cache']], T>) => Future<I, T>
  subscribe: (cb: Fn<[FilterStopNever<O>]>, ctx?: Context) => Fn<[], void>
  bind(ctx: Context): Future<I, O>
  // TODO: pipe
  [INTERNAL]: Observable<I, O>
}

export function createFuture<I, O>(options: Options<I, O>): Future<I, O> {
  const o = new Observable(options)

  return assign(
    ((input: I, ctx = o._ctx) => {
      const cache = ctx.transaction(o, input)

      const myCache = cache.get(o._key)

      return myCache && filterStopUndef(myCache.value)
    }) as any,
    {
      chain: <T>(
        fn: Fn<[FilterStopNever<O>, Instance['cache']], T>,
      ): Future<I, T> => {
        const f = createFuture(
          inferOptions({
            name: `chain ${o._key}`,
            fn: (input, cache, tCtx): T => {
              const depCache = input[0]
              const { value, kind } = depCache

              if (kind === 'stop') return STOP as any
              if (kind === 'error') return depCache as any

              return fn(depCache.value as FilterStopNever<O>, cache)
            },
            deps: [o],
            lift: (value: I, tCtx) => o._lift(value, tCtx),
            ctx: o._ctx,
          }),
        )

        return f
      },

      chainAtom: <T>(
        defaultState: T,
        fn: Fn<[FilterStopNever<O>, T], T>,
      ): Future<I, T> => {
        const f = createFuture(
          inferOptions({
            name: `chainAtom ${o._key}`,
            fn: (input, cache: { state?: T }, tCtx): T => {
              const depCache = input[0]
              const { value, kind } = depCache

              if (kind === 'stop') return STOP as any
              if (kind === 'error') return depCache as any

              if ('state' in cache === false) cache.state = defaultState

              const newState = fn(
                depCache.value as FilterStopNever<O>,
                cache.state!,
              )

              if (newState === cache.state) return STOP as any

              return (cache.state = newState)
            },
            deps: [o],
            lift: (value: I, tCtx) => o._lift(value, tCtx),
            ctx: o._ctx,
          }),
        )

        return f
      },

      chainAsync: <T>(
        fn: Fn<[AwaitChain<O>, Instance['cache']], T>,
      ): Future<I, Promise<T>> => {
        const f = createFuture(
          inferOptions({
            name: `chainAsync ${o._key}`,
            fn: ([depCache], cache, tCtx): any => {
              const { value, kind } = depCache
              if (kind === 'stop') {
                const selfCache = tCtx.cache.get(self._key)
                if (!selfCache) {
                  return STOP
                }
                if (selfCache.kind === 'error') {
                  return selfCache
                }
                if (selfCache.kind === 'payload') {
                  return fn(selfCache.value as AwaitChain<O>, cache)
                }
              } else if (kind === 'error') {
                return depCache
              } else if (value instanceof Promise) {
                value
                  .then(
                    (value: AwaitChain<O>) =>
                      !tCtx.isFailed &&
                      tCtx.ctx.transaction(
                        self,
                        new AsyncChainPayload(
                          new TransactionCache({ value, kind: 'payload' }),
                        ) as any,
                      ),
                  )
                  .catch(
                    (value) =>
                      !tCtx.isFailed &&
                      tCtx.ctx.transaction(
                        self,
                        new AsyncChainPayload(
                          new TransactionCache({ value, kind: 'error' }),
                        ) as any,
                      ),
                  )
                return STOP
              }
            },
            deps: [o],
            lift: (value: I, tCtx) => {
              if (value instanceof AsyncChainPayload) {
                tCtx.cache.set(self._key, value.value)
              } else {
                o._lift(value, tCtx)
              }
            },
            ctx: o._ctx,
          }),
        )
        const self = f[INTERNAL]

        return f
      },

      // FIXME: implement
      chainError: <T>(
        fn: Fn<[unknown, Instance['cache']], T>,
      ): Future<I, T> => {
        throw new Error('`Future.chainError` is not implemented yet')
      },

      subscribe: (cb: Fn<[FilterStopNever<O>]>, ctx = o._ctx): Fn<[], void> =>
        ctx.subscribe(o, ({ value, kind }) => {
          if (kind !== 'error' && kind !== 'stop') cb(value as any)
        }),

      // FIXME: implement
      bind: (ctx: Context): Future<I, O> => {
        throw new Error('`Future.bind` is not implemented yet')
      },

      [INTERNAL]: o,
    },
  )
}

// @ts-ignore
export declare function futureFrom(): Future<undefined, undefined>
// @ts-ignore
export declare function futureFrom<T>(): Future<T, T>
// @ts-ignore
export declare function futureFrom<I, O>(
  fn: Fn<[I, Instance['cache']], TransactionCache<O> | O>,
): Future<I, O>
export function futureFrom<I, O>(
  fn: Fn<[I, Instance['cache']], TransactionCache<O> | O> = (v: any) => v,
): Future<I, O> {
  const f = createFuture(
    inferOptions({
      fn: (input, cache, tCtx) => fn(tCtx.cache.get(_key)!.value as I, cache),
      deps: [],
      lift: (value: I, tCtx) =>
        tCtx.cache.set(_key, new TransactionCache({ value })),
    }),
  )

  const _key: string = f[INTERNAL]._key as any

  return f
}

export type CombineDeps =
  | Record<string, Future<any, any>>
  | [Future<any, any>]
  | Future<any, any>[]

export type CombineDepsI<Deps extends CombineDeps> = {
  [K in keyof Deps]: STOP | (Deps[K] extends Future<infer T, any> ? T : never)
}

export type CombineDepsO<Deps extends CombineDeps> = {
  [K in keyof Deps /* STOP | */]: Deps[K] extends Future<any, infer T>
    ? T
    : never
}

export function futureCombine<Deps extends CombineDeps>(
  deps: Deps,
): Future<CombineDepsI<Deps>, CombineDepsO<Deps>> {
  const depsNames = Object.keys(deps)

  const depsCount = depsNames.length
  const isDepsAreArray = Array.isArray(deps)

  return createFuture(
    inferOptions({
      name: JSON.stringify(deps),

      fn: (inputs) => {
        const result: any = isDepsAreArray ? new Array(depsCount) : {}

        let isError = false
        depsNames.forEach((depName, i) => {
          const depCache = inputs[i]

          isError = isError || depCache.kind === 'error'

          result[depName] = depCache.value
        })

        return new TransactionCache({
          value: result,
          kind: isError ? 'error' : 'payload',
        })
      },

      deps: depsNames.map(
        (name) => ((deps as any)[name] as Future<unknown, unknown>)[INTERNAL],
      ),

      lift: (input, tCtx) => {
        depsNames.forEach((name) => {
          const payload = (input as any)[name]

          if (payload !== STOP)
            ((deps as any)[name] as Future<unknown, unknown>)[INTERNAL]._lift(
              payload,
              tCtx,
            )
        })
      },
    }),
  )
}
