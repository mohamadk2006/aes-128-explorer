import { describe, expect, it } from 'vitest'
import { avalanche, bitDifference, compareTraces, differingBytes, flipBit, popcount8, xorBlocks } from './avalanche'
import { encrypt, encryptTrace } from './cipher'
import { parseBlock, toHex } from './hex'

const block = (hex: string) => parseBlock(hex)!

// FIPS-197 Appendix B
const KEY = block('2b7e151628aed2a6abf7158809cf4f3c')
const DATA = block('3243f6a8885a308d313198a2e0370734')

describe('bit helpers', () => {
  it('popcount8 counts the 1-bits of a byte', () => {
    expect(popcount8(0x00)).toBe(0)
    expect(popcount8(0x01)).toBe(1)
    expect(popcount8(0x80)).toBe(1)
    expect(popcount8(0xa5)).toBe(4)
    expect(popcount8(0xff)).toBe(8)
  })

  it('bitDifference is the Hamming distance', () => {
    expect(bitDifference(DATA, DATA)).toBe(0)
    expect(bitDifference(block('00'.repeat(16)), block('ff'.repeat(16)))).toBe(128)
    expect(bitDifference(block('00'.repeat(16)), block('0f' + '00'.repeat(15)))).toBe(4)
  })

  it('xorBlocks and differingBytes locate the changed bytes', () => {
    const a = block('00'.repeat(16))
    const b = block('00ff' + '00'.repeat(13) + '01')
    expect(toHex(xorBlocks(a, b))).toBe(toHex(b))
    expect(differingBytes(a, b)).toEqual([1, 15])
  })

  it('flipBit numbers bits from the MSB of byte 0 to the LSB of byte 15', () => {
    const zero = block('00'.repeat(16))
    expect(toHex(flipBit(zero, 0))).toBe('80' + '00'.repeat(15))
    expect(toHex(flipBit(zero, 9))).toBe('0040' + '00'.repeat(14))
    expect(toHex(flipBit(zero, 127))).toBe('00'.repeat(15) + '01')
    expect(toHex(flipBit(flipBit(DATA, 50), 50))).toBe(toHex(DATA))
    expect(() => flipBit(zero, 128)).toThrow()
  })
})

describe('avalanche', () => {
  it('identical inputs differ in 0 bits after every round', () => {
    const res = avalanche(DATA, KEY, DATA, KEY)
    expect(res.inputBits).toBe(0)
    expect(res.rounds).toHaveLength(11)
    expect(res.rounds.every((r) => r.bits === 0 && r.bytes.length === 0)).toBe(true)
  })

  it('one flipped data bit differs in exactly 1 bit after round 0 and spreads to the whole block', () => {
    const res = avalanche(DATA, KEY, flipBit(DATA, 127), KEY)
    expect(res.inputBits).toBe(1)
    expect(res.rounds[0].bits).toBe(1) // AddRoundKey with the same key keeps the difference
    expect(res.rounds[0].bytes).toEqual([15])
    // SubBytes turns it into one changed byte, MixColumns spreads it over one column (4 bytes).
    expect(res.rounds[1].bytes).toHaveLength(4)
    // After two rounds every byte is affected.
    expect(res.rounds[2].bytes).toHaveLength(16)
    // After that, roughly half of the 128 bits differ.
    for (const r of res.rounds.slice(3)) {
      expect(r.bits).toBeGreaterThan(40)
      expect(r.bits).toBeLessThan(88)
    }
  })

  it('one flipped key bit also differs in exactly 1 bit after round 0', () => {
    const res = avalanche(DATA, KEY, DATA, flipBit(KEY, 0))
    expect(res.inputBits).toBe(1)
    expect(res.rounds[0].bits).toBe(1)
    expect(res.rounds[10].bits).toBeGreaterThan(40)
  })

  it('reports the final states as the two ciphertexts', () => {
    const data2 = flipBit(DATA, 3)
    const res = avalanche(DATA, KEY, data2, KEY)
    expect(toHex(res.rounds[10].stateA)).toBe('3925841d02dc09fbdc118597196a0b32') // FIPS-197 Appendix B
    expect(res.rounds[10].stateB).toEqual(encrypt(data2, KEY))
    expect(res.rounds[10].percent).toBeCloseTo((res.rounds[10].bits / 128) * 100)
  })

  it('averages close to 50 % over many random single-bit changes', () => {
    let total = 0
    const runs = 200
    for (let i = 0; i < runs; i++) {
      const data = Array.from({ length: 16 }, (_, j) => (i * 37 + j * 101) & 0xff)
      total += avalanche(data, KEY, flipBit(data, i % 128), KEY).rounds[10].bits
    }
    const mean = total / runs
    expect(mean).toBeGreaterThan(60)
    expect(mean).toBeLessThan(68)
  })
})

// Stallings, Cryptography and Network Security, AES example (course slides ch05, Tables 6.5 and 6.6).
describe('textbook avalanche example', () => {
  const key = block('0f1571c947d9e8590cb7add6af7f6798')
  const data = block('0123456789abcdeffedcba9876543210')
  const first = encryptTrace(data, key)

  it('encrypts to the book ciphertext', () => {
    expect(toHex(first.ciphertext)).toBe('ff0b844a0853bf7c6934ab4364148fb9')
  })

  it('matches Table 6.5 (change in plaintext: 01… → 00…, bit 7)', () => {
    const second = flipBit(data, 7)
    expect(toHex(second)).toBe('0023456789abcdeffedcba9876543210')
    const r = compareTraces(first, encryptTrace(second, key))
    expect(r.rounds.map((x) => x.bits)).toEqual([1, 20, 58, 59, 61, 68, 64, 67, 65, 61, 58])
  })

  it('matches Table 6.6 (change in key: 0f… → 0e…, bit 7)', () => {
    const second = flipBit(key, 7)
    expect(toHex(second)).toBe('0e1571c947d9e8590cb7add6af7f6798')
    const r = compareTraces(first, encryptTrace(data, second))
    expect(r.rounds.map((x) => x.bits)).toEqual([1, 22, 58, 67, 63, 81, 70, 74, 67, 59, 53])
  })
})
