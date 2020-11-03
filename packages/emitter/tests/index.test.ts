// FIXME: linter
/* eslint-disable */
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { STOP, futureFrom, futureCombine, Context, atom } from '../src'
import { Fn } from '../src/type_utils'
import { Instance } from '../src/Context'

function noop() {}

function log(...a: any[]) {
  // return
  console.log('TEST', ...a)
}

export function mockFn<I extends any[], O>(
  fn: Fn<I, O> = (...i: any) => void 0 as any,
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

test('source', () => {
  const f = futureFrom((v: number) => v)

  assert.is(f(1), 1)

  console.log('👍')
})

test('chain', () => {
  const f = futureFrom((v: number) => v).chain((v) => v ** 2)

  assert.is(f(2), 4)

  console.log('👍')
})

test('mapPayload', () => {
  const f = futureFrom((v: number) => v).chain({
    mapPayload: (v: string) => +v,
  })

  assert.is(f('2'), 2)

  console.log('👍')
})

test('chain async', async () => {
  const f = futureFrom({ name: 'first', map: (v: number) => v })
    .chain({ name: 'second', map: (v) => Promise.resolve(v) })
    .chain({ name: 'third', map: (v) => v * 2 })

  assert.instance(f(1), Promise)

  assert.is(await f(1), 2)

  assert.equal(await Promise.all([f(1), f(2)]), [2, 4])

  console.log('👍')
})

test('async concurrency', async () => {
  const fetchConcurrent = futureFrom(async (data: number, cache) => {
    const tag = (cache.tag = ((cache.tag as number) || 0) + 1)

    await new Promise((r) => setTimeout(r))

    if (tag !== cache.tag) return STOP
    return data
  })
  const cb = mockFn()

  fetchConcurrent.chain((v) => v).subscribe(cb)

  fetchConcurrent(1)
  fetchConcurrent(2)
  fetchConcurrent(3)

  await new Promise((r) => setTimeout(r))

  assert.is(cb.calls.length, 1)
  assert.is(cb.calls[0].i[0], 3)

  console.log('👍')
})

test('subscription', () => {
  const f = futureFrom((v: number) => v)
  const cb = mockFn()

  const unsubscribe = f.subscribe((v) => cb(v))
  assert.is(cb.calls.length, 0)

  f(1)
  assert.is(cb.calls[0].i[0], 1)

  unsubscribe()

  f(2)
  assert.is(cb.calls.length, 1)

  console.log('👍')
})

test('subscription filter', () => {
  const f = futureFrom((v: number = 0) => v).chain((v) => {
    if (v % 2) return v
    return STOP
  })
  const cb = mockFn()

  f.subscribe((v) => cb(v))
  assert.is(cb.calls.length, 0)

  f(1)
  assert.is(cb.calls.length, 1)

  f(2)
  assert.is(cb.calls.length, 1)

  f(3)
  assert.is(cb.calls.length, 2)

  console.log('👍')
})

test('subscription contexts', () => {
  const f = futureFrom((v: number = 0) => v)
  const ctx1 = new Context()
  const ctx2 = new Context()
  const cb1 = mockFn()
  const cb2 = mockFn()

  f.subscribe(cb1, ctx1)
  f.subscribe(cb2, ctx2)

  f(1)
  assert.is(cb1.calls.length, 0)
  assert.is(cb2.calls.length, 0)

  f(1, ctx1)
  assert.is(cb1.calls.length, 1)
  assert.is(cb2.calls.length, 0)

  f(1, ctx2)
  assert.is(cb1.calls.length, 1)
  assert.is(cb2.calls.length, 1)

  console.log('👍')
})

test('subscription contexts (bind)', () => {
  const f = futureFrom((v: number = 0) => v)
  const f1 = f.bind(new Context())
  const f2 = f.bind(new Context())
  const cb1 = mockFn()
  const cb2 = mockFn()

  f1.subscribe(cb1)
  f2.subscribe(cb2)

  f(1)
  assert.is(cb1.calls.length, 0)
  assert.is(cb2.calls.length, 0)

  f1(1)
  assert.is(cb1.calls.length, 1)
  assert.is(cb2.calls.length, 0)

  f2(1)
  assert.is(cb1.calls.length, 1)
  assert.is(cb2.calls.length, 1)

  console.log('👍')
})

test('combines', () => {
  const f = futureFrom((v: number) => v)
  const f1 = f.chain((v) => v + 1)
  const f2 = f.chain((v) => v + 2)
  const cb1 = mockFn()

  futureCombine([f1, f2]).subscribe((v) => cb1(v))

  f(3)
  assert.is(cb1.calls.length, 1)
  assert.equal(cb1.calls[0].i[0], [4, 5])

  console.log('👍')
})

test('all async stop', async () => {
  const f = futureFrom((v: number) => v)
  const f1 = f.chain((v) => v + 1)
  const f2 = f
    .chain((v) => v + 2)
    .chain((v) => Promise.resolve(v))
    .chain((v) => {
      if (v % 2) return STOP
      return v
    })

  const cb = mockFn()

  futureCombine([f1, f2])
    .chain((a) => (a.includes(STOP) ? STOP : a))
    .subscribe((v) => cb(v))

  f1(1)
  await new Promise((r) => setTimeout(r))

  assert.is(cb.calls.length, 0)

  f2(2)
  await new Promise((r) => setTimeout(r))
  assert.is(cb.calls.length, 1)
  assert.equal(cb.calls[0].i[0], [3, 4])

  console.log('👍')
})

test('fork all', () => {
  const f1 = futureFrom((v: number = 1) => v)
  const f2 = futureFrom((v: number = 2) => v) //.chain(v => Promise.resolve(v))

  const fArray = futureCombine([f1, f2])
  assert.equal(fArray([3, 4]), [3, 4])

  const fShape = futureCombine({ f1, f2 })
  assert.equal(fShape({ f1: 3, f2: 4 }), { f1: 3, f2: 4 })

  console.log('👍')
})

test('life cycle', async () => {
  const initState = 0
  const f = futureFrom({
    map: (v: number = initState) => v,
    onInit(me, cache, ctx) {
      let state = initState
      const timerId = setInterval(() => ctx.transaction(me, ++state))

      return () => cleanup(timerId)
    },
  })
  const cleanup = mockFn((id: number) => clearInterval(id))
  const cb = mockFn((v: number) => v === 2 && resolve())
  const unsubscribe = f.subscribe(cb)

  let resolve!: Function
  await new Promise((r) => (resolve = r))
  unsubscribe()

  assert.is(cb.calls.length, 2)
  assert.is(cleanup.calls.length, 1)

  console.log('👍')
})

test('atom', () => {
  const f1 = futureFrom<number>()

  const f2 = futureFrom((v: number, cache) => v)

  const cb = mockFn()

  const a = futureCombine({
    f1,
    f2,
  }).atom(0, ({ f1, f2 }, state) => {
    if (f1 !== STOP) state = f1
    if (f2 !== STOP) state = f2
    return state
  })

  const un = a.subscribe((v) => cb(v))

  f1(1)

  assert.is(cb.calls[0].i[0], 1)

  f2(2)
  assert.is(cb.calls[1].i[0], 2)
  assert.is(cb.calls.length, 2)

  f2(2)
  assert.is(cb.calls.length, 2)

  assert.is(a.bind(new Context())({ f1: 1 }), 1)
  assert.is(cb.calls.length, 2)

  console.log('👍')
})

test('error handling', () => {
  const f1 = futureFrom<number>()
  const f2 = futureCombine([
    f1,
    f1
      .chain((v) => {
        if (v > 0) throw v
        return v
      })
      .chain(
        (v) => v,
        (v) => {
          if ((v as number) % 2) throw new Error()
          return v
        },
      ),
  ])
  const cb = mockFn()

  f2.subscribe(cb)

  assert.equal(f2([, 2]), [2, 2])
  assert.equal(f2([2]), [2, 2])
  assert.throws(() => f2([3]))

  console.log('👍')
})

test('atom options', () => {
  const a1 = atom(0, { key: 'counter' })

  a1.onInit()

  const transaction = a1.transaction(1)

  assert.instance(transaction.context.get('counter'), Instance)
  assert.is(a1.getState(), 1)

  console.log('👍')
})

test('transaction rollback', async () => {
  const a = atom(0)
  const effect = a
    .chain((v) => {
      if (v % 2) throw new Error()
      return v
    })
    .chain(async (v) => {
      await new Promise((r) => setTimeout(r))
    })
  const fn = mockFn()
  const effectData = effect.chain(fn)

  effectData.onInit()

  assert.is(fn.calls.length, 0)

  a(2)
  assert.is(a.getState(), 2)

  await new Promise((r) => setTimeout(r))

  assert.is(fn.calls.length, 1)

  assert.throws(() => a(3))
  assert.is(a.getState(), 2)

  await new Promise((r) => setTimeout(r))

  assert.is(fn.calls.length, 1)

  console.log('👍')
})

test('atom async', async () => {
  const data = { data: true }
  const requestData = futureFrom(() => Promise.resolve(data))
  const cb = mockFn()

  const a = requestData.atom(null as null | { data: any }, (payload, state) => {
    return payload
  })

  const un = a.subscribe((v) => cb(v))

  requestData(1)

  assert.is(a.getState(), null)
  assert.is(cb.calls.length, 0)
  await new Promise((r) => setTimeout(r))

  assert.is(a.getState(), data)
  assert.is(cb.calls[0].i[0], data)

  console.log('👍')
})

test('atom call', () => {
  const a = atom(0)
  const cb = mockFn()
  const un = a.subscribe(cb)

  a(1)

  assert.is(a.getState(), 1)
  assert.is(cb.calls[0].i[0], 1)

  console.log('👍')
})

test('atom from atom', () => {
  const a1 = atom(0)
  const a2 = a1.atom((v) => v * 2)

  a2(1)
  assert.is(a1(1), 1)
  assert.is(a2(1), 2)

  console.log('👍')
})

test('combine input collision', () => {
  const a1 = futureFrom({
    key: 'a1',
    map: (v: number) => v,
  })
  const a2 = futureCombine([a1, a1])

  assert.equal(a2([1, 1]), [1, 1])
  assert.throws(
    () => a2([1, 2]),
    (e: Error) => e.message.endsWith(`input of "a1" (collision)`),
  )

  console.log('👍')
})

test('getInitialStoreState', () => {
  const setTitle = futureFrom((v: string) => v)
  const titleAtom = setTitle.atom('title', (payload) => payload)

  const setMode = futureFrom((v: string) => v)
  const modeAtom = setMode.atom('desktop', (payload) => payload)

  const appAtom = futureCombine({
    title: titleAtom,
    mode: modeAtom,
  })

  appAtom.subscribe(noop)

  assert.equal(titleAtom.getState(), 'title')
  assert.equal(modeAtom.getState(), 'desktop')

  assert.equal(
    appAtom({
      title: 'My App',
      mode: 'mobile',
    }),
    {
      title: 'My App',
      mode: 'mobile',
    },
  )

  assert.equal(titleAtom.getState(), 'My App')
  assert.equal(modeAtom.getState(), 'mobile')

  console.log('👍')
})

test('nested atom', () => {
  const a1 = atom(1)
  const a2 = a1.atom((v) => v * 2)

  assert.is(a2.getState(), 2)

  a1.subscribe(noop)

  a1(2)

  assert.is(a1.getState(), 2)
  assert.is(a2.getState(), 4)

  const a3 = futureCombine([
    futureFrom((v: number) => v),
    a1,
    a1.chain((v) => []),
  ]).atom(0, (shape, state) => {
    if (shape[0] !== STOP) return shape[0]
    if (shape[1] !== STOP) return shape[1]
    if (shape[2] !== STOP) return (shape[2] as any) as number

    return state
  })

  assert.is(a3.getState(), 2)

  console.log('👍')
})

test('atom methods', () => {
  const a = futureCombine({
    set: futureFrom<number>(),
    add: futureFrom<number>(),
  }).atom(0, ({ set, add }, state) => {
    if (set !== STOP) return set
    if (add !== STOP) return state + add
  })

  a.onInit()

  assert.is(a({ set: 1 }), 1)
  assert.is(a.getState(), 1)
  assert.is(a({ add: 0.5 }), 1.5)
  assert.is(a.getState(), 1.5)

  console.log('👍')
})

test('atom context', () => {
  const a = atom(0)
  const c1 = new Context()
  const c2 = new Context()

  a.onInit(c1)
  a.onInit(c2)

  a(1, c1)
  a(2, c2)

  assert.is(a.getState(c1), 1)
  assert.is(a.getState(c2), 2)

  console.log('👍')
})
// test.skip('ctx inherit', () => {

//   const globalCtx = new Context()
//   const localCtx1 = (InheritedCtx(globalCtx) as any) as Context
//   const localCtx2 = (InheritedCtx(globalCtx) as any) as Context
//   const priceViewInstance1 = mockFn()
//   const priceViewInstance2 = mockFn()

//   const taxAtom = atom(0.2)
//   const costAtom = atom(0)
//   const priceAtom = futureCombine([taxAtom, costAtom]).chain(
//     ([tax, payload]) => tax * payload,
//   )

//   taxAtom.subscribe(() => {}, globalCtx)
//   priceAtom.subscribe(priceViewInstance1, localCtx1)
//   priceAtom.subscribe(priceViewInstance2, localCtx2)

//   costAtom(10, localCtx1)
//   assert.is(priceViewInstance1.calls[0].i[0], 2)
//   assert.is(priceViewInstance2.calls.length, 0)

//   costAtom(100, localCtx2)
//   assert.is(priceViewInstance1.calls[0].i[0], 2)
//   assert.is(priceViewInstance2.calls[0].i[0], 20)

//   taxAtom(0.1, globalCtx)
//   assert.is(priceViewInstance1.calls[0].i[0], 1)
//   assert.is(priceViewInstance2.calls[0].i[0], 10)
// })

test('async subscribers collision', async () => {
  const f1 = futureFrom()
  const f2 = f1.chain(() => new Promise((r) => setTimeout(r)))

  const track = mockFn()

  f1.subscribe(track)

  assert.is(track.calls.length, 0)
  f2()
  assert.is(track.calls.length, 1)
  await new Promise((r) => setTimeout(r))
  assert.is(track.calls.length, 1)

  console.log('👍')
})

test.run()
