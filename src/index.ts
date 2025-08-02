const wrapFunction = <Fn extends (...args: any[]) => any>(
  from: (...args: any[]) => any,
  to: Fn,
): Fn =>
  Object.defineProperties(to, {
    length: { value: from.length },
    name: { value: from.name },
  })

const noop = () => {}

/**
 * Return a function equivalent to {@link fn} except that at most
 * {@link concurrency} calls to {@link fn} can run at once at any given time.
 */
const limitConcur = <Fn extends (...args: any[]) => Promise<any>>(
  concurrency: number,
  fn: Fn,
): Fn => {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new TypeError(
      `Expected \`concurrency\` to be a positive integer: ${concurrency}`,
    )
  }

  const pending = new Set()

  return wrapFunction(fn, (async (...args) => {
    while (pending.size === concurrency) {
      await Promise.race(pending)
    }

    // eslint-disable-next-line typescript/no-unsafe-argument
    const promise = fn(...args)

    void (async () => {
      const nonThrowingPromise = promise.then(noop).catch(noop)
      pending.add(nonThrowingPromise)
      await nonThrowingPromise
      pending.delete(nonThrowingPromise)
    })()

    // eslint-disable-next-line typescript/no-unsafe-return
    return promise
  }) as Fn)
}

export default limitConcur
