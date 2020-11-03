import { Emitter, link, join } from '../build'
;(function perfTest() {
  let or = link(() => Math.random())
  let r = or
  let i = 1000
  while (i--) {
    r = r.atom(0, (n) => n + 1) //?.
  }
  i = 1000
  while (i--) {
    const u = r.subscribe(() => {}) //?.
    u() //?.
  }
  const u = r.subscribe((v) => {
    v //?
  }) //?.
  i = 1000
  let tr
  while (i--) {
    tr = or.call() //?.
  }
  tr //?
})()

const a = new Emitter(() => console.log('a'))
const b = new Emitter(() => console.log('b'), [a])
const c = new Emitter(() => console.log('c'), [a])
const d = new Emitter(() => console.log('d'), [a, b, c])

d.subscribe(() => {})

a.dispatch()
// log: 'a', 'b', 'c', 'd'
console.log('---')

const n1 = new Emitter(() => 1)
const n5 = n1
  .chain((n) => n + 1)
  .chain((n) => n + 1)
  .chain((n) => n + 1)
  .chain((n) => n + 1)
// .chain((n, c, t) => t.stop())
// .chain((n) => n + 1)

n5.subscribe((n) => console.log(n))
n1.dispatch()
// log: 5
console.log('---')

export class EntryEmitter<T> extends Emitter<T> {
  constructor() {
    super((t, cache) => {
      const data = cache.data as T
      cache.data = null
      return data
    })
  }
  call(data: T) {
    this.cache.data = data
    this.dispatch()
  }
}

const someResource = new EntryEmitter<number>()

someResource
  .chain((resourceData) => ({ resourceData }))
  .subscribe((data) => console.log(data))

someResource.call(42)
// log: { resourceData: 42 }
console.log('---')
;(async () => {
  const a = link((n: number) => n)
  const b = join<number, { counter: number }>(
    a.link((n, c) => n + 1),
    // a.link((n, c, t) => t.stop()).link((n) => n + 2),
    a.link((n, c) => n + 3),
    a.link((n, c) => n + 3),
  )

  b.subscribe((v) => {
    v //?
  })

  a.call(1)
})()
