import {
  declareAction,
  declareAtom,
  getState,
  map,
  combine,
  createStore,
  getTree,
  getIsAction,
  getIsAtom,
} from '../src/index'
import { initAction, getDepsShape } from '../src/declareAtom'

const add = declareAction<number>()
const counterAtom1 = declareAtom(0, (on) => [
  on(add, (state, payload) => state + payload),
])
const derivedAtom1 = map(counterAtom1, (counter) => `counts: ${counter}`)

const counterAtom2 = declareAtom(0, (on) => [
  on(add, (state, payload) => state + payload),
])
const derivedAtom2 = map(counterAtom2, (counter) => `counts: ${counter}`)

const store = createStore(counterAtom1)

console.log(store.getState(derivedAtom1))
console.log(store.getState(derivedAtom2))

store.dispatch(add(1))
console.log(store.getState(derivedAtom1))
console.log(store.getState(derivedAtom2))

store.subscribe(counterAtom2, () => null)
console.log(store.getState(derivedAtom1))
console.log(store.getState(derivedAtom2))

store.dispatch(add(1))
console.log(store.getState(derivedAtom1))
console.log(store.getState(derivedAtom2))
