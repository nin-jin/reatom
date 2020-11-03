// FIXME: linter
/* eslint-disable */

import { F } from './internal'

// export function isString(thing: any): thing is string {
//   return typeof thing === 'string'
// }

export function isFunction(thing: any): thing is F {
  return typeof thing === 'function'
}

export class ReatomError extends Error {
  constructor(msg: string) {
    super(`@@Reatom error: ${msg}`)
  }
}

/** Throw an error if condition is truly */
export function invalid<T extends boolean>(
  condition: T,
  msg: string,
): /* TODO: replace to `asserts` */ T extends true ? void : never
export function invalid<T extends boolean>(
  condition: T,
  msg: string,
): never | void {
  if (condition) throw new ReatomError(`invalid ${msg}`)
}

export function callSafety<I extends any[], O>(
  fn: F<I, O>,
  ...args: I
): O | undefined {
  try {
    return fn(...args)
  } catch (e) {
    setTimeout(() => {
      throw e
    })
  }
}

// export class EventEmitter<T extends Record<string, any>> {
//   map = new Map<keyof T, /* TODO: linked list? */ Array<F>>()
//   on<Type extends keyof T>(type: Type, cb: F<[T[Type]]>) {
//     let isSubscribed = true
//     let list = this.map.get(type)
//     if (list === undefined) this.map.set(type, (list = []))
//     list.push(cb)

//     return () => {
//       if (isSubscribed) {
//         isSubscribed = false
//         list.splice(list.indexOf(cb), 1)
//         if (list.length === 0) this.map.delete(type)
//       }
//     }
//   }
//   emit<Type extends keyof T>(type: Type, value: T[Type]) {
//     this.map.get(type)?.forEach((cb) => callSafety(cb, value))
//   }
// }
