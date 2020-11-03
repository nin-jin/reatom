import { F, EmitterAny, Event, ReatomError, STOP } from './internal'

export class TransactionError extends ReatomError {
  constructor(public error: unknown) {
    super(`transaction step`)
  }
}

export class Transaction extends Event {
  rollbacks: Map<EmitterAny, F> = new Map()
  current?: EmitterAny
  next() {
    return (this.current = super.next())
  }
  walk(emitter: EmitterAny): this {
    while (emitter) {
      try {
        super.walk(emitter)
      } catch (e) {
        this.set(this.current!, new TransactionError(e))
        this.schedule(emitter.to)
        processRollbacks(this, this.current!)
      }
      emitter = this.next()!
    }

    return this
  }

  notify() {
    this.data.forEach(
      (value, emitter) =>
        value !== STOP &&
        value instanceof TransactionError === false &&
        emitter.emit(value),
    )
  }
}

export function processRollbacks(
  transaction: Transaction,
  emitter: EmitterAny,
) {
  // TODO:
}
