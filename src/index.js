const wrapFunction = (from, to) => {
  const properties = [`length`, `name`].map(property => ({
    [property]: {
      enumerable: false,
      writable: false,
      value: from[property]
    }
  }))

  return Object.defineProperties(to, Object.assign(...properties))
}

const limitConcur = (concurrency, fn) => {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new TypeError(
      `Expected \`concurrency\` to be a positive integer: ${concurrency}`
    )
  }

  const pending = new Set()

  return wrapFunction(fn, async (...args) => {
    while (pending.size === concurrency) {
      await Promise.race(pending)
    }

    const promise = fn(...args)

    ;(async () => {
      // eslint-disable-next-line no-empty-function
      const nonThrowingPromise = promise.catch(() => {})
      pending.add(nonThrowingPromise)
      await nonThrowingPromise
      pending.delete(nonThrowingPromise)
    })()

    return promise
  })
}

export default limitConcur
