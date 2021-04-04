import { expectType } from 'tsd'
import limitConcur from '../src'

function f<T>(value: T): T {
  return value
}

expectType<never>(limitConcur(4, f))

function g<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}

const limited = limitConcur(5, g)
expectType<typeof g>(limited)
expectType<Promise<number>>(limited(1))

expectType<Promise<string>>(
  limitConcur(
    1,
    (a: number, b: string): Promise<string> => Promise.resolve(b + a)
  )(1, '')
)
