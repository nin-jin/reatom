// FIXME: linter
/* eslint-disable */

import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
  Observable,
  ComputedObservable,
  atom,
  Context,
  combine,
  F,
  chainOperator,
  atomOperator,
  join,
  chain,
} from '../src'

export function mockFn<I extends any[], O>(
  fn: F<I, O> = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function (...i: I) {
      // @ts-ignore
      const o = fn.apply(this, i)

      _fn.calls.push({ i, o })

      return o
    },
    {
      calls: new Array<{ i: I; o: O }>(),
    },
  )

  return _fn
}

function inheritContext(context: Context): Context {
  const clones = new Map<
    Observable<any, any, any, any>,
    Observable<any, any, any, any>
  >()

  function clone<T extends Observable<any, any> | ComputedObservable<any, any>>(
    observable: T,
  ): T {
    if (context.get(observable)) return observable
    let clonedObservable = clones.get(observable)
    if (!clonedObservable)
      clones.set(
        observable,
        (clonedObservable =
          observable instanceof ComputedObservable
            ? new ComputedObservable({
                ...observable,
                deps: observable.deps.map(clone),
              })
            : new Observable(observable)),
      )

    return clonedObservable as any
  }

  return Object.assign(Object.create(context), {
    get(observable: any) {
      const clonedObservable = clones.get(observable)
      return context.get(clonedObservable || observable)
    },
    transaction(o: any, input: any) {
      return context.transaction(clones.get(o) || o, input)
    },
    subscribe(target: any, cb?: any) {
      if (!cb) return context.subscribe(target)

      return context.subscribe(clone(target), cb)
    },
  })
}

test('ctx inherit', () => {
  const globalCtx = new Context()
  const localCtx1 = inheritContext(globalCtx)
  const localCtx2 = inheritContext(globalCtx)
  const priceViewInstance1 = mockFn()
  const priceViewInstance2 = mockFn()

  const taxAtom = atom(0.2)
  const costAtom = atom(0)
  const priceAtom = combine(taxAtom, costAtom).meta.atom(
    ([tax, payload]) => tax * payload,
  )

  taxAtom.subscribe(() => {}, globalCtx)
  priceAtom.subscribe(priceViewInstance1, localCtx1)
  priceAtom.subscribe(priceViewInstance2, localCtx2)

  costAtom.transaction(10, localCtx1)
  assert.is(priceViewInstance1.calls[0].i[0], 2)
  assert.is(priceViewInstance2.calls.length, 0)

  costAtom.transaction(100, localCtx2)
  assert.is(priceViewInstance1.calls[0].i[0], 2)
  assert.is(priceViewInstance2.calls[0].i[0], 20)

  taxAtom.transaction(0.1, globalCtx)
  assert.is(priceViewInstance1.calls[1].i[0], 1)
  assert.is(priceViewInstance2.calls[1].i[0], 10)
})

test.run()

new Observable((id) => fetch(`/user/${id}`))
  .chain((v) => Promise.resolve(4))
  .subscribe((v) => v)

const userNameAtom = new Observable((id) => fetch(`/user/${id}`)).pipe(
  chainOperator((r): Promise<{ name: string }> => r.json()),
  chainOperator((v) => v),
  chainOperator((v) => v),

  atomOperator('', ({ name }) => name),
)

userNameAtom.subscribe((name) => name)

const ch1 = chain<1>()
const ch2 = chain<2>()
const j1 = join(
  [
    ch1,
    (v, cache: { count?: number }) => {
      cache.count = cache.count || 0
      return v
    },
  ],
  [
    ch2,
    (v, cache) => {
      cache //?
      return v
    },
  ],
)
j1.subscribe((v) => {
  v //?
})
ch1.call(1)
ch2.call(2)
