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

/* eslint-disable typescript/no-explicit-any */

const wrapFunction = <Fn extends (...args: any[]) => any>(
  from: (...args: any[]) => any,
  to: Fn,
): Fn =>
  Object.defineProperties(to, {
    length: { value: from.length },
    name: { value: from.name },
  })

// eslint-disable-next-line typescript/no-empty-function
const noop = () => {}

/**
 * Return a function equivalent to `fn` except that at most `concurrency` calls
 * to `fn` can run at once at any given time.
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

    return promise
  }) as Fn)
}

export default limitConcur
