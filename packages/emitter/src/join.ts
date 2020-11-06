import {
  Atom,
  Collection,
  Emitter,
  invalid,
  link,
  Link,
  STOP,
  Transaction,
} from './internal'

/** join atoms handlers to work it with single state */
export function join<State>(
  ...links: Array<Atom<any, State, any>>
): Atom<any, State>
/** join links handlers to work it with single cache */
export function join<Output, Cache extends Collection = {}>(
  ...links: Array<Link<any, Output, Cache>>
): Link<any, Output, Cache>
export function join(
  ...links: Array<Link<any, any, any> | Atom<any, any, any>>
): Link<any, any, any> | Atom<any, any, any> {
  const up = links.map(link => {
    if (link instanceof Atom) atomsCount++
    return link.up[0]
  })
  let atomsCount = 0
  const parent = new Emitter(t => up.map(l => t.get(l)), up)

  invalid(
    atomsCount !== 0 && atomsCount !== links.length,
    `arguments, shout be only links or only atoms`,
  )

  function onNext(
    this: Link<any, any, any>,
    input: any,
    cache: any,
    t: Transaction,
  ) {
    return links.reduce((acc, link) => {
      const result = link.fn.call(this, t, cache)

      return result === STOP ? acc : result
    }, STOP as any)
  }

  function reducer(input: any[], state: any) {
    return links.reduce((acc, link, i) => {
      const payload = input[i]

      if (payload === STOP) return acc

      // @ts-ignore
      const result = link._reducer(payload, acc)

      return result === STOP ? acc : result
    }, state)
  }

  return atomsCount
    ? new Atom({
        // @ts-ignore
        parent,
        defaultState: undefined,
        reducer,
      })
    : new Link({
        onNext,
        parent,
      })
}

;(async () => {
  const a = link((n: number) => n)
  const b = join(
    a.atom(0, (n, c) => n + 1),
    a.atom(0, (n, c) => n + 3),
    a.atom(0, (n, c) => n + 3),
    // a.atom(0, (n, c) => n),
    // a.link((n, c) => n + 3),
    // a.link((n, c) => n + 3),
  )

  b.subscribe(v => {
    v //?
  })

  a.call(1)
})().catch(e => {
  console.log(e)
})
