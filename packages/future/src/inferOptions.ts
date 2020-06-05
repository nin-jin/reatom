// FIXME: linter
/* eslint-disable */

import { Instance, TransactionCache, TransactionContext } from './Context'
import { Options, Observable } from './Observable'

// @ts-ignore
export declare function inferOptions<I, O>(
  options: {
    /** Executor */
    fn: (
      input: [],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly []

    // FIXME: `Options<unknown, [O] extends [infer _O] ? _O : never>`
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
// @ts-ignore
export declare function inferOptions<I, O, Dep1>(
  options: {
    /** Executor */
    fn: (
      input: [TransactionCache<Dep1>],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly [Observable<any, Dep1>]
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
// @ts-ignore
export declare function inferOptions<I, O, Dep1, Dep2>(
  options: {
    /** Executor */
    fn: (
      input: [TransactionCache<Dep1>, TransactionCache<Dep2>],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly [Observable<any, Dep1>, Observable<any, Dep2>]
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
// @ts-ignore
export declare function inferOptions<I, O, Dep1, Dep2, Dep3>(
  options: {
    /** Executor */
    fn: (
      input: [
        TransactionCache<Dep1>,
        TransactionCache<Dep2>,
        TransactionCache<Dep3>,
      ],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly [
      Observable<any, Dep1>,
      Observable<any, Dep2>,
      Observable<any, Dep3>,
    ]
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
// @ts-ignore
export declare function inferOptions<I, O, Dep1, Dep2, Dep3, Dep4>(
  options: {
    /** Executor */
    fn: (
      input: [
        TransactionCache<Dep1>,
        TransactionCache<Dep2>,
        TransactionCache<Dep3>,
        TransactionCache<Dep4>,
      ],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly [
      Observable<any, Dep1>,
      Observable<any, Dep2>,
      Observable<any, Dep3>,
      Observable<any, Dep4>,
    ]
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
// @ts-ignore
export declare function inferOptions<I, O, Dep1, Dep2, Dep3, Dep4, Dep5>(
  options: {
    /** Executor */
    fn: (
      input: [
        TransactionCache<Dep1>,
        TransactionCache<Dep2>,
        TransactionCache<Dep3>,
        TransactionCache<Dep4>,
        TransactionCache<Dep5>,
      ],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly [
      Observable<any, Dep1>,
      Observable<any, Dep2>,
      Observable<any, Dep3>,
      Observable<any, Dep4>,
      Observable<any, Dep5>,
    ]
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
// @ts-ignore
export declare function inferOptions<I, O>(
  options: {
    /** Executor */
    fn: (
      input: TransactionCache<unknown>[],
      cache: Instance['cache'],
      tCtx: TransactionContext,
    ) => TransactionCache<O> | O

    /** Dependencies for receiving updates */
    deps: readonly Observable<any, any>[]
  } & Omit<Options<I, unknown>, 'fn' | 'deps'>,
): Options<I, O>
export function inferOptions(options: any) {
  return options
}
