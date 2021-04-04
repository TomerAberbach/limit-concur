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

import { fc } from 'ava-fast-check'
import { promiseStateSync } from 'p-state'
import limitConcur from '../src/index.js'
import { delay } from './helpers/index.js'
import { test, testProp } from './helpers/macros.js'

const asyncFnArb = fc
  .tuple(fc.infiniteStream(fc.integer({ min: 1 })), fc.func(fc.anything()))
  .map(([delays, fn]) =>
    Object.assign(
      async (...args) => {
        await delay(delays.next())
        return fn(...args)
      },
      {
        toString: () =>
          `(...args) => delay().then(() => (${fc.stringify(fn)})(...args))`
      }
    )
  )

const maybeThrowingAsyncFnArb = fc
  .tuple(fc.func(fc.boolean()), asyncFnArb)
  .map(([shouldThrow, asyncFn]) =>
    Object.assign(
      async (...args) => {
        const output = await asyncFn(...args)

        if (shouldThrow(...args)) {
          throw new Error(`BOOM!`)
        }

        return output
      },
      {
        toString: () =>
          `(...args) => maybeThrow().then(() => (${fc.stringify(
            asyncFn
          )})(...args))`,
        shouldThrow
      }
    )
  )

testProp(
  `limitConcur throws for a non positive integer concurrency`,
  [
    fc.oneof(
      fc.double().filter(value => !Number.isSafeInteger(value)),
      fc.integer({ max: 0 })
    ),
    asyncFnArb
  ],
  (t, concurrency, fn) => {
    t.throws(() => limitConcur(concurrency, fn), {
      message: `Expected \`concurrency\` to be a positive integer: ${concurrency}`,
      instanceOf: TypeError
    })
  }
)

testProp(
  `limitConcur limits the given function's concurrency`,
  [
    fc.integer({ min: 1 }),
    asyncFnArb,
    fc.array(fc.array(fc.anything()), { minLength: 1 })
  ],
  async (t, concurrency, fn, inputs) => {
    let running = 0

    const limitedFn = limitConcur(concurrency, async (...args) => {
      running++

      t.true(running <= concurrency, `${running} !<= ${concurrency}`)

      const output = await fn(...args)

      running--

      return output
    })

    const outputs = await Promise.all(inputs.map(input => limitedFn(...input)))

    t.deepEqual(outputs, await Promise.all(inputs.map(input => fn(...input))))
  }
)

testProp(
  `limitConcur limits the given function's concurrency when errors are thrown`,
  [
    fc.integer({ min: 1 }),
    maybeThrowingAsyncFnArb,
    fc.array(fc.array(fc.anything()), { minLength: 1 })
  ],
  async (t, concurrency, fn, inputs) => {
    let running = 0

    const limitedFn = limitConcur(concurrency, async (...args) => {
      running++

      t.true(running <= concurrency, `${running} !<= ${concurrency}`)

      try {
        return await fn(...args)
      } finally {
        running--
      }
    })

    const outputs = inputs.map(input => ({
      shouldThrow: fn.shouldThrow(...input),
      output: limitedFn(...input)
    }))

    for (const { shouldThrow, output } of outputs) {
      await (shouldThrow
        ? t.throwsAsync(() => output, { message: `BOOM!`, instanceOf: Error })
        : t.notThrowsAsync(() => output))
    }
  }
)

test(`limitConcur concrete example`, async t => {
  let running = 0
  const limitedDelay = limitConcur(3, async timeout => {
    running++
    await delay(timeout)
    running--
  })

  const first = limitedDelay(4)

  t.is(promiseStateSync(first), `pending`)
  t.is(running, 1)

  await delay(1)

  t.is(promiseStateSync(first), `pending`)
  t.is(running, 1)

  const second = limitedDelay(2)

  t.is(promiseStateSync(first), `pending`)
  t.is(promiseStateSync(second), `pending`)
  t.is(running, 2)

  const third = limitedDelay(5)

  t.is(promiseStateSync(first), `pending`)
  t.is(promiseStateSync(second), `pending`)
  t.is(promiseStateSync(third), `pending`)
  t.is(running, 3)

  const fourth = limitedDelay(5)

  t.is(promiseStateSync(first), `pending`)
  t.is(promiseStateSync(second), `pending`)
  t.is(promiseStateSync(third), `pending`)
  t.is(promiseStateSync(fourth), `pending`)
  t.is(running, 3)

  await delay(2)

  t.is(promiseStateSync(first), `pending`)
  t.is(promiseStateSync(second), `fulfilled`)
  t.is(promiseStateSync(third), `pending`)
  t.is(promiseStateSync(fourth), `pending`)
  t.is(running, 3)

  await delay(2)

  t.is(promiseStateSync(first), `fulfilled`)
  t.is(promiseStateSync(second), `fulfilled`)
  t.is(promiseStateSync(third), `pending`)
  t.is(promiseStateSync(fourth), `pending`)
  t.is(running, 2)

  await delay(10)

  t.is(promiseStateSync(first), `fulfilled`)
  t.is(promiseStateSync(second), `fulfilled`)
  t.is(promiseStateSync(third), `fulfilled`)
  t.is(promiseStateSync(fourth), `fulfilled`)
  t.is(running, 0)
})
