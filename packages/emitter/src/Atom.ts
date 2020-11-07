import { Collection, F, invalid, Link, STOP } from './internal'

export class Atom<Input, State> extends Link<Input, State, { state?: State }> {
  private _defaultState: State
  private _reducer: (payload: Input, state: State) => STOP | State
  constructor(options: {
    defaultState: State
    reducer: (payload: Input, state: State) => STOP | State
    parent?: Link<any, Input, any>
    meta?: Collection
  }) {
    const { defaultState, reducer, parent, meta } = options

    super({
      parent,
      meta,
      // @ts-expect-error
      onNext(this: Atom<Input, State>, input, cache) {
        const state = this.get()
        const newState = reducer(input, state)

        // TODO: rollback
        return newState === STOP || Object.is(state, newState)
          ? STOP
          : (cache.state = newState)
      },
      onInit() {
        // TODO: update state based on deps if its atom to
      },
    })

    this._reducer = reducer
    this._defaultState = defaultState
  }

  // @ts-expect-error
  call(): never {
    invalid(true, `call of atom, use \`set\` instead`)
  }

  set(value: State) {
    invalid(this.up.length !== 0, `set of derived atom`)
    // FIXME:
    // @ts-ignore
    super.call(value)
  }

  get(): State {
    return 'state' in this.cache
      ? this.cache.state!
      : (this.cache.state = this._defaultState)
  }

  map<T>(map: (payload: State, prevState?: T) => T): Atom<never, T> {
    return this.atom(map(this._defaultState), map)
  }

  subscribe(callback: F<[State]>): () => void {
    const un = super.subscribe(callback)
    callback(this.get())
    return un
  }
}
