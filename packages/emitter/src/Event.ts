import { callSafety, Emitter, EmitterAny } from './internal'

export const STOP: unique symbol = Symbol(`@@Reatom: STOP token`)
export type STOP = typeof STOP

/** Emitter event is a temporal context for walking of emitter links */
export class Event {
  /** Topological sorted queue */
  protected queue: Array<EmitterAny> = []
  /** Results of emitter functions calls */
  protected data: Map<EmitterAny, any> = new Map()

  /** Schedule emitter for it call after topological sorting */
  protected schedule(emitters: Array<EmitterAny>) {
    emitters.forEach((emitter) => {
      // tiny implementation of topological sorting,
      // pretty effective, but O(n^2) for `Emitter.to` (bad for a lot of children)
      for (let i = 0; i < this.queue.length; i++) {
        const nextEmitter = this.queue[i]
        if (emitter === nextEmitter) return
        if (emitter.n >= nextEmitter.n) {
          this.queue[i] = emitter
          emitter = nextEmitter
        }
      }
      this.queue.push(emitter)
    })
  }
  /** Get next emitter from topological sorted queue */
  protected next() {
    return this.queue.pop()
  }

  /** Set result of emitter function call */
  set<T>(emitter: Emitter<T>, data: T): void {
    this.data.set(emitter, data)
  }
  /** Get result of emitter function call */
  get<T>(emitter: Emitter<T>): T | STOP {
    const data = this.data.get(emitter)
    return data === undefined && !this.data.has(emitter) ? STOP : data
  }

  /** Start walking of an emitter links */
  walk(emitter: EmitterAny): this {
    do {
      const result = emitter.fn(this, emitter.cache)
      this.set(emitter, result)
      if (result !== STOP) this.schedule(emitter.to)
    } while ((emitter = this.next()!))

    this.notify()

    return this
  }

  notify() {
    this.data.forEach((value, emitter) => value !== STOP && emitter.emit(value))
  }

  /** Return a special token that describe of preventing of walking of emitter children (`to`)
   * @example ```ts
   * const $oddNumbers = $numbers.chain((n, event) => n % 2 ? n : event.stop())
   * ```
   */
  stop(...a: Array<any>): STOP
  stop(): STOP {
    return STOP
  }
}
