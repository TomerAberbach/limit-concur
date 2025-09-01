<h1 align="center">
  limit-concur
</h1>

<div align="center">
  <a href="https://npmjs.org/package/limit-concur">
    <img src="https://badgen.net/npm/v/limit-concur" alt="version" />
  </a>
  <a href="https://github.com/TomerAberbach/limit-concur/actions">
    <img src="https://github.com/TomerAberbach/limit-concur/workflows/CI/badge.svg" alt="CI" />
  </a>
  <a href="https://unpkg.com/limit-concur/dist/index.js">
    <img src="https://deno.bundlejs.com/?q=limit-concur&badge" alt="gzip size" />
  </a>
  <a href="https://unpkg.com/limit-concur/dist/index.js">
    <img src="https://deno.bundlejs.com/?q=limit-concur&config={%22compression%22:{%22type%22:%22brotli%22}}&badge" alt="brotli size" />
  </a>
  <a href="https://github.com/sponsors/TomerAberbach">
    <img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="Sponsor" />
  </a>
</div>

<div align="center">
  Limit an async function's concurrency with ease!
</div>

## Features

- **Tiny:** only ~300 B minzipped
- **Flexible:** works for any function that returns a `Promise`

## Install

```sh
$ npm i limit-concur
```

## Usage

```js
import limitConcur from 'limit-concur'

const categories = await (
  await fetch(`https://api.chucknorris.io/jokes/categories`)
).json()

let pendingRequests = 0
const getChuckNorrisJoke = async category => {
  console.log(`pending requests: ${++pendingRequests}`)
  const response = await fetch(
    `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(category)}`,
  )
  const { value } = await response.json()
  console.log(`pending requests: ${--pendingRequests}`)
  return value
}

const limitedGetChuckNorrisJoke = limitConcur(4, getChuckNorrisJoke)

// At most 4 requests are pending at any given time!
const jokes = await Promise.all(categories.map(limitedGetChuckNorrisJoke))
console.log(jokes)
//=> pending requests: 1
//=> pending requests: 2
//=> pending requests: 3
//=> pending requests: 4
//=> pending requests: 3
//=> pending requests: 4
//=> ...
//=> pending requests: 3
//=> pending requests: 2
//=> pending requests: 1
//=> pending requests: 0
//=> [
//     'Chuck Norris once rode a nine foot grizzly bear through an automatic car wash, instead of taking a shower.',
//     "Chuck Norris is actually the front man for Apple. He let's Steve Jobs run the show when he's on a mission. Chuck Norris is always on a mission.",
//     "Bill Gates thinks he's Chuck Norris. Chuck Norris actually laughed. Once.",
//     'Chuck Norris can install iTunes without installing Quicktime.',
//     ...
//   ]
```

### Recipes

#### Replacing [`p-map`](https://github.com/sindresorhus/p-map)

```js
import limitConcur from 'limit-concur'

const urls = [`https://tomeraberba.ch`, `https://lfi.dev`, `https://npmjs.com`]

const mapper = async url => {
  const { redirected } = await fetch(url, { method: `head` })
  return redirected
}

const results = await Promise.all(urls.map(limitConcur(2, mapper)))
console.log(results)
//=> [ false, false, true ]
```

#### Replacing [`p-all`](https://github.com/sindresorhus/p-all)

```js
import limitConcur from 'limit-concur'

const actions = [
  () => fetch(`https://tomeraberba.ch`),
  () => fetch(`https://lfi.dev`),
  () => checkSomething(),
  () => doSomethingElse(),
]

const results = await Promise.all(
  actions.map(limitConcur(2, action => action())),
)
console.log(results)
//=> [ ..., ..., ... ]
```

#### Replacing [`p-limit`](https://github.com/sindresorhus/p-limit)

```js
import limitConcur from 'limit-concur'

const limit = limitConcur(1, fn => fn())

const input = [
  limit(() => fetchSomething(`foo`)),
  limit(() => fetchSomething(`bar`)),
  limit(() => doSomething()),
]

const results = await Promise.all(input)
console.log(results)
//=> [ ..., ..., ... ]
```

#### Replacing [`p-filter`](https://github.com/sindresorhus/p-filter)

```js
import limitConcur from 'limit-concur'

const urls = [`https://tomeraberba.ch`, `https://lfi.dev`, `https://npmjs.com`]

const filterer = async url => {
  const { redirected } = await fetch(url, { method: `head` })
  return !redirected
}

const results = await Promise.all(
  urls.map(limitConcur(2, async url => ({ url, keep: await filterer(url) }))),
)
const filtered = results.flatMap(({ url, keep }) => (keep ? [url] : []))
console.log(filtered)
//=> [ 'https://tomeraberba.ch', 'https://lfi.dev' ]
```

#### Replacing [`p-props`](https://github.com/sindresorhus/p-props)

```js
import limitConcur from 'limit-concur'

const urls = {
  tomer: `https://tomeraberba.ch`,
  lfi: `https://lfi.dev`,
  npm: `https://npmjs.com`,
}

const mapper = async url => {
  const { redirected } = await fetch(url, { method: `head` })
  return redirected
}

const results = Object.fromEntries(
  await Promise.all(
    Object.entries(urls).map(
      limitConcur(2, async ([name, url]) => [name, await mapper(url)]),
    ),
  ),
)
console.log(results)
//=> { tomer: false, lfi: false, npm: true }
```

## Contributing

Stars are always welcome!

For bugs and feature requests,
[please create an issue](https://github.com/TomerAberbach/limit-concur/issues/new).

## License

[MIT](https://github.com/TomerAberbach/limit-concur/blob/main/license-mit) ©
[Tomer Aberbach](https://github.com/TomerAberbach) \
[Apache 2.0](https://github.com/TomerAberbach/limit-concur/blob/main/license-apache) ©
[Google](https://github.com/TomerAberbach/limit-concur/blob/main/notice-apache)
