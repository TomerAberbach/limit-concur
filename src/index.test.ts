import { inspect } from 'node:util'
import { setTimeout } from 'node:timers/promises'
import { fc, test } from '@fast-check/vitest'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import limitConcur from './index.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const promiseStateSync = (promise: Promise<unknown>): string => {
  const inspectedString = inspect(promise, {
    depth: 0,
    showProxy: false,
    maxStringLength: 0,
    breakLength: Number.POSITIVE_INFINITY,
  })

  if (inspectedString.startsWith(`Promise { <pending>`)) {
    return `pending`
  }

  if (inspectedString.startsWith(`Promise { <rejected>`)) {
    return `rejected`
  }

  return `fulfilled`
}

const withAutoAdvancingTimers =
  <Args extends unknown[]>(
    fn: (...args: Args) => Promise<void>,
  ): ((...args: Args) => Promise<void>) =>
  async (...args) => {
    void fn(...args)
    await vi.runAllTimersAsync()
  }

const asyncFnArb = fc
  .tuple(
    fc.infiniteStream(fc.integer({ min: 1, max: 50 }).map(i => i * 1000)),
    fc.func(fc.anything()),
  )
  .map(([delays, fn]) =>
    Object.assign(
      async (...args: unknown[]) => {
        await setTimeout(Number(delays.next().value))
        return fn(...args)
      },
      {
        toString: () =>
          `(...args) => delay().then(() => (${fc.stringify(fn)})(...args))`,
      },
    ),
  )

const maybeThrowingAsyncFnArb = fc
  .tuple(fc.func(fc.boolean()), asyncFnArb)
  .map(([shouldThrow, asyncFn]) =>
    Object.assign(
      async (...args: unknown[]) => {
        const output = await asyncFn(...args)

        if (shouldThrow(...args)) {
          throw new Error(`BOOM!`)
        }

        return output
      },
      {
        toString: () =>
          `(...args) => maybeThrow().then(() => (${fc.stringify(
            asyncFn,
          )})(...args))`,
        shouldThrow,
      },
    ),
  )

test.prop([
  fc.oneof(fc.double({ noInteger: true }), fc.integer({ max: 0 })),
  asyncFnArb,
])(
  `limitConcur throws for a non positive integer concurrency`,
  (concurrency, fn) => {
    expect(() => limitConcur(concurrency, fn)).toThrow(
      new TypeError(
        `Expected \`concurrency\` to be a positive integer: ${concurrency}`,
      ),
    )
  },
)

test.prop([
  fc.integer({ min: 1 }),
  asyncFnArb,
  fc.array(fc.array(fc.anything()), { minLength: 1 }),
])(
  `limitConcur limits the given function's concurrency`,
  withAutoAdvancingTimers(async (concurrency, fn, inputs) => {
    let running = 0

    const limitedFn = limitConcur(concurrency, async (...args: unknown[]) => {
      running++

      expect(running).toBeLessThanOrEqual(concurrency)

      const output = await fn(...args)

      running--

      return output
    })

    const outputs = await Promise.all(inputs.map(input => limitedFn(...input)))

    expect(await Promise.all(inputs.map(input => fn(...input)))).toStrictEqual(
      outputs,
    )
  }),
)

test.prop([
  fc.integer({ min: 1 }),
  maybeThrowingAsyncFnArb,
  fc.array(fc.array(fc.anything()), { minLength: 1 }),
])(
  `limitConcur limits the given function's concurrency when errors are thrown`,
  withAutoAdvancingTimers(async (concurrency, fn, inputs) => {
    let running = 0

    const limitedFn = limitConcur(concurrency, async (...args: unknown[]) => {
      running++

      expect(running).toBeLessThanOrEqual(concurrency)

      try {
        return await fn(...args)
      } finally {
        running--
      }
    })

    const outputs = inputs.map(input => ({
      shouldThrow: fn.shouldThrow(...input),
      didThrow: (async () => {
        try {
          await limitedFn(...input)
          return false
        } catch {
          return true
        }
      })(),
    }))

    for (const { shouldThrow, didThrow } of outputs) {
      expect(await didThrow).toBe(shouldThrow)
    }
  }),
)

test(
  `limitConcur concrete example`,
  withAutoAdvancingTimers(async () => {
    let running = 0
    const limitedDelay = limitConcur(3, async (timeout: number) => {
      running++
      await setTimeout(timeout)
      running--
    })

    const first = limitedDelay(4000)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(running).toBe(1)

    await setTimeout(1000)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(running).toBe(1)

    const second = limitedDelay(2000)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`pending`)
    expect(running).toBe(2)

    const third = limitedDelay(5000)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`pending`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(running).toBe(3)

    const fourth = limitedDelay(5000)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`pending`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(promiseStateSync(fourth)).toBe(`pending`)
    expect(running).toBe(3)

    await setTimeout(2000)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`fulfilled`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(promiseStateSync(fourth)).toBe(`pending`)
    expect(running).toBe(3)

    await setTimeout(2000)

    expect(promiseStateSync(first)).toBe(`fulfilled`)
    expect(promiseStateSync(second)).toBe(`fulfilled`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(promiseStateSync(fourth)).toBe(`pending`)
    expect(running).toBe(2)

    await setTimeout(1000)

    expect(promiseStateSync(first)).toBe(`fulfilled`)
    expect(promiseStateSync(second)).toBe(`fulfilled`)
    expect(promiseStateSync(third)).toBe(`fulfilled`)
    expect(promiseStateSync(fourth)).toBe(`fulfilled`)
    expect(running).toBe(0)
  }),
)
