// eslint-disable-next-line ava/use-test
import normalTest from 'ava'
import { testProp as normalTestProp } from 'ava-fast-check'
import { clock } from './index.js'

export const enhanceImplementation = implementation => async (...args) => {
  implementation(...args)
  await clock.runAllAsync()
}

export const test = (title, implementation) =>
  normalTest(title, enhanceImplementation(implementation))

export const testProp = (title, arbs, implementation, params) =>
  normalTestProp(title, arbs, enhanceImplementation(implementation), params)
