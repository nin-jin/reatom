// FIXME: linter
/* eslint-disable */

import { Fn, FilterStopUndef } from './type_utils'
import { CacheKind, STOP } from './constants'

export const { assign } = Object

export function isString(thing: any): thing is string {
  return typeof thing === 'string'
}

export function isFunction(thing: any): thing is Fn {
  return typeof thing === 'function'
}

export function callSafety<Args extends any[]>(fn: Fn<Args>, ...args: Args) {
  try {
    fn(...args)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
  }
}

/**
 * Tiny priority set queue for dynamic topological sorting
 */
// FIXME: tests
export class Queue<T> {
  private parts = new Map<number, T[]>()

  private min = 0

  private max = 0

  insert(priority: number, el: T) {
    let part = this.parts.get(priority)

    if (!part) this.parts.set(priority, (part = []))

    if (!part.includes(el)) {
      part.push(el)

      this.min = Math.min(this.min, priority) // useful only for cycles
      this.max = Math.max(this.max, priority)
    }
  }

  extract() {
    while (true) {
      const next = (this.parts.get(this.min) || []).shift()

      if (next || this.min++ >= this.max) return next
    }
  }
}

export class ReatomError extends Error {
  constructor(msg: string) {
    super(`Reatom: ${msg}`)
  }
}

export function invalid<T extends boolean>(
  condition: T,
  msg: string,
): /* TODO: replace to `asserts` */ T extends true ? void : never
export function invalid(condition: boolean, msg: string): never | void {
  if (condition) throw new ReatomError(`invalid ${msg}`)
}

export function getKind(value: any): CacheKind {
  return value === STOP
    ? 'stop'
    : value instanceof Promise
    ? 'async'
    : 'payload'
}

export function filterStopUndef<T>(value: T): FilterStopUndef<T> {
  return value instanceof Promise
    ? value.then(filterStopUndef)
    : (value as any) === STOP
    ? undefined
    : (value as any)
}
