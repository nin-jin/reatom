import { STOP } from './constants'

export type Fn<I extends unknown[] = any[], O = any> = (...a: I) => O

export type FnI<F> = F extends Fn<[infer T]> ? T : never

export type FnO<F> = F extends Fn<any[], infer T> ? T : never

export type Values<T> = T[keyof T]

export type Collection<T = any> = Record<keyof any, T>

export type Await<T> = T extends Promise<infer T> ? T : T

export type FilterStopUndef<T> = T extends Promise<infer _T>
  ? Promise<FilterStopUndef<_T>>
  : T extends STOP
  ? undefined
  : T
export type FilterStopNever<T> = T extends Promise<infer _T>
  ? Promise<FilterStopNever<_T>>
  : T extends STOP
  ? undefined
  : T
