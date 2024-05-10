<h1 align="center">
  limit-concur
</h1>

<div align="center">
  <a href="https://npmjs.org/package/limit-concur">
    <img src="https://badgen.now.sh/npm/v/limit-concur" alt="version" />
  </a>
  <a href="https://github.com/TomerAberbach/limit-concur/actions">
    <img src="https://github.com/TomerAberbach/limit-concur/workflows/CI/badge.svg" alt="CI" />
  </a>
  <a href="https://unpkg.com/limit-concur/dist/index.min.js">
    <img src="https://deno.bundlejs.com/?q=limit-concur&badge" alt="gzip size" />
  </a>
  <a href="https://unpkg.com/limit-concur/dist/index.min.js">
    <img src="https://deno.bundlejs.com/?q=limit-concur&config={%22compression%22:{%22type%22:%22brotli%22}}&badge" alt="brotli size" />
  </a>
</div>

<div align="center">
  Limit an async function's concurrency with ease!
</div>

## Features

- **Tiny:** only ~320 B minzipped
- **Flexible:** works for any function that returns a `Promise`

## Install

```sh
$ npm i limit-concur
```

## Usage

```js
import got from 'got'
import limitConcur from 'limit-concur'

const categories = await got(
  `https://api.chucknorris.io/jokes/categories`,
).json()

const getChuckNorrisJoke = async category => {
  const { value } = await got(`https://api.chucknorris.io/jokes/random`, {
    searchParams: {
      category,
    },
  }).json()
  return value
}

const limitedGetChuckNorrisJoke = limitConcur(4, getChuckNorrisJoke)

// At most 4 requests are pending at any given time!
const jokes = await Promise.all(categories.map(limitedGetChuckNorrisJoke))
console.log(jokes)
//=> [
//     'Chuck Norris once rode a nine foot grizzly bear through an automatic car wash, instead of taking a shower.',
//     "Chuck Norris is actually the front man for Apple. He let's Steve Jobs run the show when he's on a mission. Chuck Norris is always on a mission.",
//     "Bill Gates thinks he's Chuck Norris. Chuck Norris actually laughed. Once.",
//     'Chuck Norris can install iTunes without installing Quicktime.',
//     ...
//   ]
```

You can get an API equivalent to
[`p-limit`](https://github.com/sindresorhus/p-limit) like so:

```js
import limitConcur from 'limit-concur'

const limit = limitConcur(1, fn => fn())

const input = [
  limit(() => fetchSomething(`foo`)),
  limit(() => fetchSomething(`bar`)),
  limit(() => doSomething()),
]

const result = await Promise.all(input)
console.log(result)
//=> [ ..., ..., ... ]
```

## Contributing

Stars are always welcome!

For bugs and feature requests,
[please create an issue](https://github.com/TomerAberbach/limit-concur/issues/new).

For pull requests, please read the
[contributing guidelines](https://github.com/TomerAberbach/limit-concur/blob/main/contributing.md).

## License

[Apache License 2.0](https://github.com/TomerAberbach/limit-concur/blob/main/license)

This is not an official Google product.
