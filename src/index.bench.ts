import { setTimeout } from 'node:timers/promises'
import { bench } from 'vitest'
import limitConcur from './index.ts'

bench(`limitConcur`, async () => {
  const limited = limitConcur(4, () => setTimeout(20))

  await Promise.all(Array.from({ length: 12 }, () => limited()))
})
