export const INTERNAL = Symbol('REATOM_FUTURE_INTERNAL')
export type INTERNAL = typeof INTERNAL

/**
 * Token to stop reactive update propagation.
 * (filtered to undefined for executors and subscribers)
 */
// string is prefers instead of symbol for better readability of debugging
export const STOP = 'REATOM_STOP_TOKEN' as const
export type STOP = typeof STOP

/** A unique key to get future instance from a context */
export type Key = /* unique */ string

export type CacheKind = 'payload' | 'async' | 'stop' | 'error'
