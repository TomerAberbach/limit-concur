/**
 * Return a function equivalent to `fn` except that at most `concurrency` calls
 * to `fn` can run at once at any given time.
 */
declare const limitConcur: <Fn extends (...args: any[]) => any>(
  concurrency: number,
  fn: Fn
) => ReturnType<Fn> extends PromiseLike<any> ? Fn : never

export default limitConcur
