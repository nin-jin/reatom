// FIXME: linter
/* eslint-disable */

import { STOP, futureFrom, futureCombine, Context } from '../src'

function noop() {}

function log(...a: any[]) {
  return
  console.log('TEST', ...a)
}

describe('@reatom/future', () => {
  test('source', () => {
    log('source')
    const f = futureFrom((v: number) => v)

    expect(f(1)).toBe(1)
  })
  test('chain', () => {
    log('chain')
    const f = futureFrom((v: number) => v).chain((v) => v ** 2)

    expect(f(2)).toBe(4)
  })
  test.skip('chain async', async () => {
    log('chain async')
    const f = futureFrom((v: number = 0) => v)
      .chain((v) => Promise.resolve(v))
      .chainAsync((v) => v * 2)

    expect(f(1)).toBeInstanceOf(Promise)
    expect(await f(1)).toBe(2)
    expect(await Promise.all([f(1), f(2)])).toEqual([2, 4])
  })
  test('async concurrency', async () => {
    log('async concurrency')

    const fetchConcurrent = futureFrom(async (data: number, cache) => {
      const tag = (cache.tag = ((cache.tag as number) || 0) + 1)

      await new Promise((r) => setTimeout(r))

      if (tag !== cache.tag) return STOP
      return data
    })
    const cb = jest.fn()

    fetchConcurrent.chainAsync(v => v).subscribe(cb)

    fetchConcurrent(1)
    fetchConcurrent(2)
    fetchConcurrent(3)

    await new Promise((r) => setTimeout(r))

    expect(cb).toBeCalledTimes(1)
    expect(cb).toBeCalledWith(3)
  })
  test('subscription', () => {
    log('subscription')
    const f = futureFrom((v: number) => v)
    const cb = jest.fn()

    const unsubscribe = f.subscribe((v) => cb(v))
    expect(cb).toBeCalledTimes(0)

    f(1)
    expect(cb).toBeCalledWith(1)

    unsubscribe()

    f(2)
    expect(cb).toBeCalledTimes(1)
  })
  test('subscription filter', () => {
    log('subscription filter')
    const f = futureFrom((v: number = 0) => v).chain((v) => {
      if (v % 2) return v
      return STOP
    })
    const cb = jest.fn()

    f.subscribe((v) => cb(v))
    expect(cb).toBeCalledTimes(0)

    f(1)
    expect(cb).toBeCalledTimes(1)

    f(2)
    expect(cb).toBeCalledTimes(1)

    f(3)
    expect(cb).toBeCalledTimes(2)
  })
  test('subscription contexts', () => {
    log('subscription contexts')
    const f = futureFrom((v: number = 0) => v)
    const ctx1 = new Context()
    const ctx2 = new Context()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    f.subscribe(cb1, ctx1)
    f.subscribe(cb2, ctx2)

    f(1)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledTimes(0)

    f(1, ctx1)
    expect(cb1).toBeCalledTimes(1)
    expect(cb2).toBeCalledTimes(0)

    f(1, ctx2)
    expect(cb1).toBeCalledTimes(1)
    expect(cb2).toBeCalledTimes(1)
  })
  test.skip('subscription contexts (bind)', () => {
    log('subscription contexts (bind)')
    const f = futureFrom((v: number = 0) => v)
    const f1 = f.bind(new Context())
    const f2 = f.bind(new Context())
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    f1.subscribe(cb1)
    f2.subscribe(cb2)

    f(1)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledTimes(0)

    f1(1)
    expect(cb1).toBeCalledTimes(1)
    expect(cb2).toBeCalledTimes(0)

    f2(1)
    expect(cb1).toBeCalledTimes(1)
    expect(cb2).toBeCalledTimes(1)
  })
  test('combines', () => {
    log('combines')
    const f = futureFrom((v: number) => v)
    const f1 = f.chain((v) => v + 1)
    const f2 = f.chain((v) => v + 2)
    const cb1 = jest.fn()

    futureCombine([f1, f2]).subscribe((v) => cb1(v))

    f(3)
    expect(cb1).toBeCalledTimes(1)
    expect(cb1.mock.calls[0][0]).toEqual([4, 5])
  })
  test.skip('all async stop', async () => {
    log('all async stop')
    const f = futureFrom((v: number) => v)
    const f1 = f.chain((v) => v + 1)
    const f2 = f
      .chain((v) => v + 2)
      .chain((v) => Promise.resolve(v))
      .chain((v) => {
        if (v % 2) return STOP
        return v
      })

    const cb = jest.fn()

    futureCombine([f1, f2]).subscribe((v) => cb(v))

    f1(1)
    await new Promise((r) => setTimeout(r))
    expect(cb).toBeCalledTimes(0)

    f2(2)
    await new Promise((r) => setTimeout(r))
    expect(cb).toBeCalledTimes(1)
    expect(cb).toBeCalledWith([3, 4])

    f2(3)
    await new Promise((r) => setTimeout(r))
    expect(cb).toBeCalledTimes(1)

    f2(4)
    await new Promise((r) => setTimeout(r))
    expect(cb).toBeCalledTimes(2)
    expect(cb).toBeCalledWith([5, 6])
  })
  test('fork all', () => {
    log('all')
    const f1 = futureFrom((v: number = 1) => v)
    const f2 = futureFrom((v: number = 2) => v) //.chain(v => Promise.resolve(v))

    const fArray = futureCombine([f1, f2])
    expect(fArray([3, 4])).toEqual([3, 4])

    const fShape = futureCombine({ f1, f2 })
    expect(fShape({ f1: 3, f2: 4 })).toEqual({ f1: 3, f2: 4 })
  })
  test.skip('life cycle', async () => {
    log('life cycle')
    const initState = 0
    const f = futureFrom((v: number = initState) => v, {
      init(me, cache, ctx) {
        let state = initState
        const timerId = setInterval(() => ctx.transaction(me, ++state))

        return () => cleanup(timerId)
      },
    })
    const cleanup = jest.fn((id: number) => clearInterval(id))
    const cb = jest.fn((v: number) => v === 2 && resolve())
    const unsubscribe = f.subscribe(cb)

    let resolve!: Function
    await new Promise((r) => (resolve = r))
    unsubscribe()

    expect(cb).toBeCalledTimes(2)
    expect(cleanup).toBeCalledTimes(1)
  })
  test('atom', () => {
    log('atom')
    const f1 = futureFrom((v: number) => v)
    const f2 = futureFrom((v: number) => v)
    const cb = jest.fn()

    const atom = futureCombine({
      f1,
      f2,
    }).chainAtom(0, ({ f1, f2 }, state) => {
      if (f1 !== STOP) state = f1
      if (f2 !== STOP) state = f2
      return state
    })

    const un = atom.subscribe((v) => cb(v))

    f1(1)
    expect(cb).toBeCalledWith(1)

    f2(2)
    expect(cb).toBeCalledWith(2)
    expect(cb).toBeCalledTimes(2)

    f2(2)
    expect(cb).toBeCalledTimes(2)

    // expect(atom.bind(new Context())(1)).toBe(1)
    // expect(cb).toBeCalledTimes(2)
  })
  test.skip('atom async', async () => {
    log('atom async')
    const data = { data: true }
    const requestData = futureFrom(() => Promise.resolve(data))
    const cb = jest.fn()

    const atom = atomOf<null | { data: any }>(null, {
      reducers: [requestData.reduce((state, payload) => payload)],
    })

    const un = atom.subscribe((v) => cb(v))

    requestData(1)
    expect(atom.getState()).toBe(null)
    expect(cb).toBeCalledTimes(0)
    await new Promise((r) => setTimeout(r))
    expect(atom.getState()).toBe(data)
    expect(cb).toBeCalledWith(data)
  })
  test.skip('atom call', () => {
    log('atom call')

    const atom = atomOf(0)
    const cb = jest.fn()
    const un = atom.subscribe((v) => cb(v))

    atom(1)
    expect(atom.getState()).toBe(1)
    expect(cb).toBeCalledWith(1)
  })
  test.skip('getInitialStoreState', () => {
    log('getInitialStoreState')
    const setTitle = futureFrom((v: string) => v)
    const titleAtom = atomOf('title', {
      reducers: [setTitle.reduce((_, payload) => payload)],
    })

    const setMode = futureFrom<string>((v) => v)
    const modeAtom = atomOf('desktop', {
      reducers: [setMode.reduce((_, payload) => payload)],
    })

    const appAtom = futureCombine({
      title: titleAtom,
      mode: modeAtom,
    })

    appAtom.subscribe(noop)

    expect(titleAtom.getState()).toEqual('title')
    expect(modeAtom.getState()).toEqual('desktop')

    appAtom({
      title: 'My App',
      mode: 'mobile',
    })

    expect(titleAtom.getState()).toEqual('My App')
    expect(modeAtom.getState()).toEqual('mobile')
  })
  test.skip('ctx inherit', () => {
    log('ctx inherit')

    const globalCtx = new Context()
    const localCtx1 = (InheritedCtx(globalCtx) as any) as Context
    const localCtx2 = (InheritedCtx(globalCtx) as any) as Context
    const priceViewInstance1 = jest.fn()
    const priceViewInstance2 = jest.fn()

    const taxAtom = atomOf(0.2)
    const costAtom = atomOf(0)
    const priceAtom = futureCombine([taxAtom, costAtom]).chain(
      ([tax, payload]) => tax * payload,
    )

    taxAtom.subscribe(() => {}, globalCtx)
    priceAtom.subscribe(priceViewInstance1, localCtx1)
    priceAtom.subscribe(priceViewInstance2, localCtx2)

    costAtom(10, localCtx1)
    expect(priceViewInstance1).toBeCalledWith(2)
    expect(priceViewInstance2).not.toBeCalled()

    costAtom(100, localCtx2)
    expect(priceViewInstance1).toBeCalledWith(2)
    expect(priceViewInstance2).toBeCalledWith(20)

    taxAtom(0.1, globalCtx)
    expect(priceViewInstance1).toBeCalledWith(1)
    expect(priceViewInstance2).toBeCalledWith(10)
  })
})
