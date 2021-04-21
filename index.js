const codec = require('./codec')
const { Header } = require('./messages')
const { Readable } = require('streamx')

class OrderBookStream extends Readable {
  constructor (book, opts = {}) {
    super()

    this.book = book
    this.seq = 1
    this.start = toDate(opts.gte || opts.start) || null
    this.end = toDate(opts.lt || opts.end) || null
    this.tail = !!opts.tail
    this.live = !!opts.live || this.tail
    this.limit = opts.limit === undefined ? -1 : opts.limit
    this.range = null
  }

  _open (cb) {
    const self = this

    if (!this.start) return this.book.update().then(update, cb)
    this.book.getSeq(this.start).then(done, cb)

    function update () {
      done(1)
    }

    function done (seq) {
      self.seq = seq

      if (seq === -1) return cb(null)

      if (self.tail) {
        self.seq = Math.max(1, self.book.feed.length - 1)
      }

      if (!self.live) {
        const limit = self.book.feed.length - seq
        if (self.limit === -1) self.limit = limit
        else self.limit = Math.min(limit, self.limit)
      }

      self.range = self.book.feed.download({ start: self.seq, end: self.limit ? self.seq + self.limit : -1, linear: true })

      cb(null)
    }
  }

  _read (cb) {
    if (this.seq < 0 || this.limit === 0) {
      this.push(null)
      return cb(null)
    }

    if (this.limit > 0) this.limit--
    this.book.feed.get(this.seq++, { valueEncoding: codec }, (err, data) => {
      if (err) return cb(err)

      if (this.end && data.date >= this.end) {
        this.push(null)
        return cb(null)
      }

      this.push(data)
      cb(null)
    })
  }

  _predestroy () {
    if (!this.range) return
    const range = this.range
    this.range = null
    this.book.feed.undownload(range)
  }

  _destroy (cb) {
    this._predestroy()
    cb(null)
  }
}

module.exports = class BFXOrderBook {
  constructor (feed, pair) {
    this.feed = feed
    this._wroteHeader = false
    this._pair = pair
  }

  replicate (...args) {
    return this.feed.replicate(...args)
  }

  ready () {
    return new Promise((resolve, reject) => {
      this.feed.ready(function (err) {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  info () {
    return new Promise((resolve, reject) => {
      this.feed.get(0, { valueEncoding: Header }, function (err, header) {
        if (err) return reject(err)
        if (header.protocol !== 'bfx-terminal-order-book' && header.protocol !== 'bitfinex-terminal-order-book') return reject(new Error('Not an order book'))
        resolve(header.metadata)
      })
    })
  }

  update () {
    return new Promise((resolve) => {
      this.feed.update({ ifAvailable: true, hash: false }, function (err) {
        resolve(!err)
      })
    })
  }

  _get (seq) {
    return new Promise((resolve, reject) => {
      this.feed.get(seq, { valueEncoding: codec }, function (err, data) {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  async latest () {
    await this.update()
    if (!this.feed.length) return null
    return this._get(this.feed.length - 1)
  }

  async getSeq (target) {
    if (typeof target === 'string' || typeof target === 'number') target = new Date(target)

    await this.update()
    const len = this.feed.length

    if (!len) return null

    let lower = 1
    let upper = len

    while (lower < upper) {
      const mid = Math.floor((upper + lower) / 2)
      const entry = await this._get(mid)
      const date = new Date(entry.date)

      if (date < target) lower = mid + 1
      else upper = mid
    }

    return lower < len ? lower : -1
  }

  async get (target) {
    const seq = await this.getSeq(target)
    if (seq === -1) return null
    return this._get(seq)
  }

  createReadStream (opts) {
    return new OrderBookStream(this, opts)
  }

  async append (entry) {
    if (Array.isArray(entry)) entry = { date: new Date(), book: entry }
    await this.ready()

    const batch = []

    if (!this._wroteHeader && this.feed.length === 0) {
      this._wroteHeader = true
      batch.push(Header.encode({
        protocol: 'bitfinex-terminal-order-book',
        metadata: { pair: this._pair }
      }))
    }

    batch.push(codec.encode(entry))

    return new Promise((resolve, reject) => {
      this.feed.append(batch, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

function toDate (target) {
  if (typeof target === 'string' || typeof target === 'number') return new Date(target)
  return target
}
