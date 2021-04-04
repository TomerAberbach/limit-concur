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
