import { createClock } from '@sinonjs/fake-timers'

export const clock = createClock(Date.now(), Infinity)

export const delay = timeout =>
  new Promise(resolve => clock.setTimeout(resolve, timeout))
