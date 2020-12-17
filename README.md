# bitfinex-terminal-order-book

Bitfinex Orderbook Query API

```
npm install bitfinex-terminal-order-book
```

## Usage

```js
const buyer = dazaar.buy(card)

// make sure to follow the payment guide
buyer.on('feed', function (feed) {
  const o = new Orderbook(feed)
})
```

See https://github.com/bitfinexcom/bitfinex-terminal for more.

## Orderbook API

#### `const o = new Orderbook(feed, [pair])`

Create a new orderbook. `feed` should be a Hypercore and `pair` is the string key identifying the order book pair.
You only need to pass in `pair` if you plan to append to the feed.

When using Dazaar, you'd get the feed from the `feed` event.

```js
buyer.on('feed', function (feed) {
  const o = new Orderbook(feed)
})
```

#### `const book = await o.get(timestamp)`

Will find the first orderbook snapshot `>=` than the timestamp.

#### `const stream = o.createReadStream([options])`

Make a stream of snapshots. Options include:

```js
{
  start: <timestamp> // start from this timestamp
  end: <timestamp>, // end before this timestamp
  limit: <number>, // how many to get at max?
  live: <bool> // keep the stream open?
}
```

The stream is also async iterable.

#### `const { pair } = await o.info()`

Get metadata about the orderbook. `pair` is the currency pair for it.

#### `const book = await o.latest()`

Get the latest entry added.
