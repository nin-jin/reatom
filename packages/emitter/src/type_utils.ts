// FIXME:
// store it here for handle _code empty_ file for build output
export const noop: F = () => {}

export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type FI<T> = T extends F<[infer T]> ? T : never

export type FO<T> = T extends F<any[], infer T> ? T : never

export type Values<T> = T[keyof T]

export type Collection<T = unknown> = Record<string, T>

export type Tuple<T> = [T] | T[]

export type Await<T> = T extends Promise<infer T> ? T : T
