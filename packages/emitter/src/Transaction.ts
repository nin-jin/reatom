import { EmitterAny, Event, F, ReatomError, STOP } from './internal'

export class TransactionError extends ReatomError {
  constructor(public error: unknown) {
    super(`transaction step`)
  }
}

export class Transaction extends Event {
  rollbacks: Map<EmitterAny, F> = new Map()
  current?: EmitterAny

  protected processRollbacks(emitter: EmitterAny) {
    // TODO:
  }

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
        this.processRollbacks(this.current!)
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
