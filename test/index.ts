/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { inspect } from 'node:util'
import { fc, test } from 'tomer'
import { createClock } from '@sinonjs/fake-timers'
import limitConcur from '../src/index.ts'

const clock = createClock(Date.now(), Infinity)

const delay = (timeout: number): Promise<void> =>
  new Promise(resolve => clock.setTimeout(resolve, timeout))

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

fc.configureGlobal({ numRuns: 500 })

const withAutoAdvancingTimers =
  <Args extends unknown[]>(
    fn: (...args: Args) => Promise<void>,
  ): ((...args: Args) => Promise<void>) =>
  async (...args) => {
    void fn(...args)
    await clock.runAllAsync()
  }

const asyncFnArb = fc
  .tuple(fc.infiniteStream(fc.integer({ min: 1 })), fc.func(fc.anything()))
  .map(([delays, fn]) =>
    Object.assign(
      async (...args: unknown[]) => {
        await delay(Number(delays.next().value))
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
  fc.oneof(
    fc.double().filter(value => !Number.isSafeInteger(value)),
    fc.integer({ max: 0 }),
  ),
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
      await delay(timeout)
      running--
    })

    const first = limitedDelay(4)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(running).toBe(1)

    await delay(1)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(running).toBe(1)

    const second = limitedDelay(2)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`pending`)
    expect(running).toBe(2)

    const third = limitedDelay(5)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`pending`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(running).toBe(3)

    const fourth = limitedDelay(5)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`pending`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(promiseStateSync(fourth)).toBe(`pending`)
    expect(running).toBe(3)

    await delay(2)

    expect(promiseStateSync(first)).toBe(`pending`)
    expect(promiseStateSync(second)).toBe(`fulfilled`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(promiseStateSync(fourth)).toBe(`pending`)
    expect(running).toBe(3)

    await delay(2)

    expect(promiseStateSync(first)).toBe(`fulfilled`)
    expect(promiseStateSync(second)).toBe(`fulfilled`)
    expect(promiseStateSync(third)).toBe(`pending`)
    expect(promiseStateSync(fourth)).toBe(`pending`)
    expect(running).toBe(2)

    await delay(10)

    expect(promiseStateSync(first)).toBe(`fulfilled`)
    expect(promiseStateSync(second)).toBe(`fulfilled`)
    expect(promiseStateSync(third)).toBe(`fulfilled`)
    expect(promiseStateSync(fourth)).toBe(`fulfilled`)
    expect(running).toBe(0)
  }),
)
