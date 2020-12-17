const varint = require('varint')

const SLAB_SIZE = 512 * 1024
const MAX_CHUNK = 64 * 1024

let slab = Buffer.allocUnsafe(SLAB_SIZE)

module.exports = { encode, decode }

function encode (entry) {
  if (slab.length < MAX_CHUNK) slab = Buffer.allocUnsafe(SLAB_SIZE)

  let prevPos = null
  let prevNeg = null
  let ptr = 0

  varint.encode(toDate(entry.date), slab, ptr)
  ptr += varint.encode.bytes

  for (const d of entry.book) {
    const pos = d[2] >= 0
    const delta = pos
      ? prevPos ? prevPos[0] - d[0] : d[0]
      : prevNeg ? d[0] - prevNeg[0] : d[0]

    varint.encode(delta, slab, ptr)
    ptr += varint.encode.bytes
    varint.encode(d[1], slab, ptr)
    ptr += varint.encode.bytes
    slab.writeDoubleLE(d[2], ptr)
    ptr += 8

    if (pos) prevPos = d
    else prevNeg = d
  }

  const res = slab.slice(0, ptr)
  slab = slab.slice(ptr)
  return res
}

function decode (buf) {
  let prevPos = null
  let prevNeg = null
  let ptr = 0

  const entry = { date: null, book: [] }

  entry.date = new Date(varint.decode(buf, ptr))
  ptr += varint.decode.bytes

  while (ptr < buf.length) {
    const res = [0, 0, 0]

    res[0] = varint.decode(buf, ptr)
    ptr += varint.decode.bytes

    res[1] = varint.decode(buf, ptr)
    ptr += varint.decode.bytes

    res[2] = buf.readDoubleLE(ptr)
    ptr += 8

    const pos = res[2] >= 0

    res[0] = pos
      ? prevPos ? prevPos[0] - res[0] : res[0]
      : prevNeg ? prevNeg[0] + res[0] : res[0]

    if (pos) prevPos = res
    else prevNeg = res

    entry.book.push(res)
  }

  return entry
}

function toDate (d) {
  if (typeof d === 'number') return d
  if (typeof d === 'string') return (new Date(d)).getTime()
  return d.getTime()
}
