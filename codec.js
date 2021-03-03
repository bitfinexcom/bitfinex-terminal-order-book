const varint = require('varint')
const varintf = require('varint-fraction')

const SLAB_SIZE = 512 * 1024
const MAX_CHUNK = 64 * 1024

let slab = Buffer.allocUnsafe(SLAB_SIZE)

module.exports = { encode, decode }

function encode (entry) {
  if (slab.length < MAX_CHUNK) slab = Buffer.allocUnsafe(SLAB_SIZE)

  let ptr = 0

  slab[ptr++] = 0 // version

  varint.encode(toDate(entry.date), slab, ptr)
  ptr += varint.encode.bytes

  for (const d of entry.book) {
    varintf.encode(d[0], slab, ptr)
    ptr += varintf.encode.bytes
    varint.encode(d[1], slab, ptr)
    ptr += varint.encode.bytes
    varintf.encode(d[2], slab, ptr)
    ptr += varintf.encode.bytes
  }

  const res = slab.slice(0, ptr)
  slab = slab.slice(ptr)
  return res
}

function decode (buf) {
  const compat = buf[0] !== 0

  let prevPos = null
  let prevNeg = null
  let ptr = compat ? 0 : 1

  const entry = { date: null, book: [] }

  entry.date = new Date(varint.decode(buf, ptr))
  ptr += varint.decode.bytes

  while (ptr < buf.length) {
    const res = [0, 0, 0]

    if (compat) {
      res[0] = varint.decode(buf, ptr)
      ptr += varint.decode.bytes
    } else {
      res[0] = varintf.decode(buf, ptr)
      ptr += varintf.decode.bytes
    }

    res[1] = varint.decode(buf, ptr)
    ptr += varint.decode.bytes

    if (compat) {
      res[2] = buf.readDouble(ptr)
      ptr += 8
    } else {
      res[2] = varintf.decode(buf, ptr)
      ptr += varintf.decode.bytes
    }

    if (compat) {
      const pos = res[2] >= 0

      res[0] = pos
        ? prevPos ? prevPos[0] - res[0] : res[0]
        : prevNeg ? prevNeg[0] + res[0] : res[0]

      if (pos) prevPos = res
      else prevNeg = res
    }

    entry.book.push(res)
  }

  return entry
}

function toDate (d) {
  if (typeof d === 'number') return d
  if (typeof d === 'string') return (new Date(d)).getTime()
  return d.getTime()
}
