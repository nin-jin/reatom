import { F, Collection, ReatomError, Link, STOP, invalid } from './internal'

export class Atom<
  Input,
  State,
  Meta extends Collection = Collection
> extends Link<Input, State, { state?: State }, Meta> {
  up!: [Link<any, Input, any, any>]
  protected _defaultState: State
  private _reducer: (payload: Input, state: State) => STOP | State
  constructor(options: {
    defaultState: State
    reducer: (payload: Input, state: State) => STOP | State
    parent: Link<any, Input, any, any>
    getMeta?: ($atom: Atom<Input, State>) => Meta
  }) {
    const { defaultState, reducer, parent, getMeta } = options

    super({
      parent,
      // @ts-expect-error
      getMeta,
      onNext(input, cache, t) {
        const state = (this as Atom<any, State>).get()
        const newState = reducer(input, state)

        // TODO: rollback
        return newState === STOP || Object.is(state, newState)
          ? STOP
          : (cache.state = newState)
      },
    })

    this._reducer = reducer
    this._defaultState = defaultState
  }

  // @ts-expect-error
  call(): never {
    invalid(true, `call of atom, use \`set\` instead`)
  }

  get(): State {
    return 'state' in this.cache
      ? this.cache.state!
      : (this.cache.state = this._defaultState)
  }

  map<T>(map: (payload: State, prevState?: T) => T): Atom<State, T> {
    return this.atom(map(this._defaultState), map)
  }

  subscribe(callback: F<[State]>): () => void {
    const un = super.subscribe(callback)
    callback(this.get())
    return un
  }
}
