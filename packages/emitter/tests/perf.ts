// FIXME: linter
/* eslint-disable */
import { performance } from 'perf_hooks'
import * as effector from 'effector'
import { chain, combine } from '../build'
import { Collection, Fn } from '../src/type_utils'

/* -------- */
/* - TEST - */
/* -------- */
;() => {
  // declare function assert(condition: boolean, description?: string): asserts condition
  function assert(condition: boolean, description = 'Assert error') {
    if (condition === false) throw new Error(description)
  }
  function isObject(thing: any): thing is Collection<unknown> {
    return typeof thing === 'object' && thing !== null
  }

  declare function isEqual<A, B extends A>(a: A, b: B): a is B
  declare function isEqual<B, A extends B>(a: A, b: B): b is A
  function isEqual(a: any, b: any): any {
    return (
      Object.is(a, b) ||
      (isObject(a) &&
        isObject(b) &&
        Object.keys(a).length === Object.keys(b).length &&
        Object.entries(a).every(([k, v]) => isEqual(v, b[k])))
    )
  }

  declare function createTrackedFn(): Fn & { _calls: unknown[][] }
  declare function createTrackedFn<T extends Fn>(
    executor: T,
  ): T & { _calls: unknown[][] }
  function createTrackedFn(executor = ((v) => v) as Fn): any {
    const _calls: unknown[][] = []

    return Object.assign(
      function fn(...a: any[]) {
        const result = executor(...a)
        _calls.push(a)
        return result
      },
      { _calls },
    )
  }

  ;(async () => {
    const f0Map = createTrackedFn((v: number) => v + 1)
    const f1Map = createTrackedFn((v) => v + 1)
    const f2Map = createTrackedFn(([_0, _1]) => {
      new Error().stack //?
      return { _0, _1 }
    })

    const f0 = chain(f0Map)
    const f1 = f0.chain(f1Map)
    const f2 = combine([f0, f1]).chain(f2Map)

    const track = createTrackedFn()
    const uns = f2.subscribe(track)

    const result = f2([1, 2])
    const expected = { _0: 2, _1: 3 }

    assert(isEqual(result, expected))

    assert(f0Map._calls.length === 1)
    assert(f1Map._calls.length === 1)
    assert(f2Map._calls.length === 1)

    assert(track._calls.length === 1 && isEqual(track._calls[0][0], expected))

    uns()
    f2([2, 3])
    assert(track._calls.length === 1)
  })()
  ;(async () => {
    const track = createTrackedFn((v: string) => v)

    const f3 = chain((v: number) => Promise.resolve(`_${v}`)).chainAsync(track)
    const result = await f3(42)
    const expected = '_42'

    assert(isEqual(result, expected))
    assert(isEqual(track._calls[0][0], expected))
  })()
  ;(async () => {
    const a1 = atomOf(0)
    const a2 = atomOf('0', {
      reducers: [
        a1.reduce((a, b) => {
          return a + b
        }),
      ],
    })

    a2.subscribe((v) => {
      v //?
    })

    a1(1) //?
    a1(1) //?
  })()
  ;(async () => {
    const atom = atomOf(0, {
      reducers: [atomOf('').reduce((state, payload) => state)],
      actions: {
        update(state, payload: number) {
          return payload
        },
      },
    })

    atom.subscribe((v) => {
      v //?
    })

    atom.actions.update(1) //?
    atom.actions.update(2) //?
  })()
}

// const myAtom = atom({
//   name: 'myAtom', // or 'key' (optional)
//   initState: '...',
//   domain: '...', // (optional)
//   reducers: [
//     doSome.reduce((state, payload) => state),
//     dataAtom.reduce((state, data) => state),
//   ],
//   actions: {
//     update: (state, payload) => payload
//   }
// })

// myAtom.update(42)
// // { type: 'update "myAtom [1]"', payload: 42 }

/* --------- */
/* PERF TEST */
/* --------- */
;(() => {
  // return
  const entry = chain<number>()
  const a = entry.atom(0, (v, s) => s + 1)
  const b = a.meta.atom((a) => a + 1)
  const c = a.meta.atom((a) => a + 1)
  const d = combine(b, c).meta.atom(([b, c]) => +b + +c)
  const e = d.meta.atom((d) => d + 1)
  const f = d.meta.atom((d) => d + 1)
  const g = combine(e, f).meta.atom(([e, f]) => +e + +f)
  const h1 = combine(d, e, f, g).meta.atom(([d, e, f, g]) => +d + +e + +f + +g)
  const h2 = combine(d, e, f, g).meta.atom(([d, e, f, g]) => +d + +e + +f + +g)
  const h = combine(h1, h2).meta.atom(([h1, h2]) => +h1 + +h2)
  let res = 0
  h.subscribe((v) => {
    res += v
  })

  const eEntry = effector.createEvent()
  const eA = effector.createStore(0).on(eEntry, (s) => s + 1)
  const eB = eA.map((a) => a + 1)
  const eC = eA.map((a) => a + 1)
  const eD = effector.combine(eB, eC, (b, c) => b + c)
  const eE = eD.map((d) => d + 1)
  const eF = eD.map((d) => d + 1)
  const eG = effector.combine(eE, eF, (e, f) => e + f)
  const eH1 = effector.combine(eD, eE, eF, eG, (d, e, f, g) => d + e + f + g)
  const eH2 = effector.combine(eD, eE, eF, eG, (d, e, f, g) => d + e + f + g)
  const eH = effector.combine(eH1, eH2, (h1, h2) => h1 + h2)
  let eRes = 0
  eH.subscribe((v) => {
    eRes += v
  })
  eRes = 0

  console.log({ res, eRes })

  const reatomLogs = []
  const effectorLogs = []

  var i = 100
  while (i--) {
    const startReatom = performance.now()
    /* REATOM   */ entry.call(i)
    reatomLogs.push(performance.now() - startReatom)
    const startEffector = performance.now()
    /* EFFECTOR */ eEntry()
    effectorLogs.push(performance.now() - startEffector)

    if (false && !(i % 10)) {
      const startReatom = performance.now()
      const future = combine(e, f).chain(([e, f]) => e + f)
      future.subscribe((v) => (res += v))
      future.subscribe((v) => (res += v))
      performance.now() - startReatom //?.

      let _eRes = eRes
      const startEffector = performance.now()
      const store = effector.combine(eE, eF, (e, f) => e + f)
      store.subscribe((v) => (eRes += v))
      store.subscribe((v) => (eRes += v))
      performance.now() - startEffector //?.
      eRes = _eRes
    }
  }

  console.log({ res, eRes })

  console.log('reatom', median(reatomLogs).toFixed(3))
  console.log('effector', median(effectorLogs).toFixed(3))
})()

function median(values: number[]) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}
