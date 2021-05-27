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

// eslint-disable-next-line ava/use-test
import normalTest from 'ava'
import { testProp as normalTestProp } from 'ava-fast-check'
import { clock } from './index.js'

export const enhanceImplementation =
  implementation =>
  async (...args) => {
    implementation(...args)
    await clock.runAllAsync()
  }

export const test = (title, implementation) =>
  normalTest(title, enhanceImplementation(implementation))

export const testProp = (title, arbs, implementation, params) =>
  normalTestProp(title, arbs, enhanceImplementation(implementation), params)
