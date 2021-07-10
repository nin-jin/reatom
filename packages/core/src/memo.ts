import {
  AC,
  ActionPayload,
  Atom,
  Cache,
  Effect,
  Fn,
  isActionCreator,
  isAtom,
  isFunction,
  pushUnique,
  Rec,
  Transaction,
} from './internal'
import { invalid } from './shared'

export type Computer<State = any, Ctx extends Rec = Rec> = {
  ($: Track<State, Ctx>, state: State): State
}

export type Track<State, Ctx extends Rec> = {
  <T>(atom: Atom<T>): T
  <T>(atom: Atom<T>, cb: Fn<[T], Effect<Ctx>>): void
  <T>(atom: Atom<T>, cb: Fn<[T], any>): void
  <T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionPayload<T>, ReturnType<T>], Effect<Ctx>>,
  ): void
  <T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionPayload<T>, ReturnType<T>], any>,
  ): void
}

export function memo<State, Ctx extends Rec = Rec>(
  transaction: Transaction,
  cache: Cache<State>,
  computer: Computer<State, Ctx>,
): Cache<State> {
  let depAtoms = [] as typeof cache.depAtoms
  let depStates = [] as typeof cache.depStates
  let depTypes = [] as typeof cache.depTypes
  let depTypesSelfIndex = cache.depTypesSelfIndex
  let depActions = [] as typeof cache.depTypes
  let state: State
  let nesting = 0

  const shouldSkipComputer =
    cache.depAtoms.length > 0 &&
    transaction.actions.every(({ type }) => cache.depTypes.indexOf(type, depTypesSelfIndex) === -1) &&
    cache.depAtoms.every((depAtom, i) => {
      const depPatch = transaction.process(depAtom)

      if (!Object.is(depPatch.state, depStates[i])) return false

      // depTypes.push.apply(depTypes, depPatch.depTypes)
      pushUnique(depTypes, depPatch.depTypes)

      return true
    })

  if (shouldSkipComputer) {
    depTypesSelfIndex = depTypes.length
    depTypes.push.apply(depTypes, cache.depTypes.slice(depTypesSelfIndex))

    return {
      ctx: cache.ctx,
      depAtoms: cache.depAtoms,
      depStates: cache.depStates,
      depTypes,
      depTypesSelfIndex,
      state: cache.state,
    }
  }

  function scheduleEffect(effect: any) {
    if (isFunction(effect)) {
      transaction.effects.push((store) => effect(store, cache.ctx))
    }
  }

  function trackAtom(depAtom: Atom, cb?: Fn) {
    const depPatch = transaction.process(depAtom)

    if (nesting == 1) {
      const depIdx = depAtoms.length

      depAtoms.push(depAtom)
      depStates.push(depPatch.state)
      // depTypes.push.apply(depTypes, depPatch.depTypes)
      pushUnique(depTypes, depPatch.depTypes)

      if (cb !== undefined) {
        const isChanged = cache.depAtoms.length <= depIdx
          || cache.depAtoms[depIdx] != depAtom
          || !Object.is(cache.depStates[depIdx], depPatch.state)

        if (isChanged) scheduleEffect(cb(depPatch.state))

        return
      }


    } else {
      invalid(cb, `callback in nested track`)
    }

    return depPatch.state
  }

  function trackAction(ac: AC, cb?: Fn) {
    invalid(!isActionCreator(ac), `track arguments`)

    invalid(!cb, `action track without callback`)

    const { type } = ac

    if (nesting == 1) depActions.push(type)

    transaction.actions.forEach((action) =>
      action.type == type && scheduleEffect(cb!(action.payload, action))
    )
  }

  const track: Track<State, Ctx> = (atomOrAction: Atom | AC, cb?: Fn) => {
    // TODO: how to pass the `id` of atom here?
    invalid(Number.isNaN(nesting), `outdated track call`)

    nesting++

    try {
      return isAtom(atomOrAction) ? trackAtom(atomOrAction, cb) : trackAction(atomOrAction, cb)
    } finally {
      nesting--
    }
  }

  state = computer(track, cache.state)

  depTypesSelfIndex = depTypes.length
  depTypes.push.apply(depTypes, depActions)
  nesting = NaN

  return {
    ctx: cache.ctx,
    depAtoms,
    depStates,
    depTypes,
    depTypesSelfIndex,
    state,
  }
}
