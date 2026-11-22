import { describe, expect, it } from 'vitest'
import { flipBit } from '../../aes/avalanche'
import { parseBlock } from '../../aes/hex'
import { expandKey } from '../../aes/keyExpansion'
import { compareSchedules } from './diffusion'

const key = parseBlock('2b7e151628aed2a6abf7158809cf4f3c')!

describe('compareSchedules', () => {
  it('finds no difference for the same key', () => {
    const d = compareSchedules(expandKey(key), expandKey(key))
    expect(d.wordBits.every((n) => n === 0)).toBe(true)
    expect(d.roundBits.every((n) => n === 0)).toBe(true)
    expect(d.roundBytes.every((b) => b.length === 0)).toBe(true)
  })

  it('one flipped key bit changes 1 bit of K0 and spreads through later round keys', () => {
    const d = compareSchedules(expandKey(key), expandKey(flipBit(key, 0)))
    expect(d.roundBits[0]).toBe(1)
    expect(d.roundBytes[0]).toEqual([0])
    expect(d.wordBits.slice(0, 4)).toEqual([1, 0, 0, 0])
    // w4 = w0 ⊕ g(w3): w3 is unchanged, so w4 differs in exactly the same bit as w0.
    expect(d.wordBits[4]).toBe(1)
    // After a few rounds the S-box has spread the change to many bits.
    expect(d.roundBits[10]).toBeGreaterThan(30)
    expect(d.wordBits).toHaveLength(44)
    expect(d.roundBits).toHaveLength(11)
  })

  it('a flipped bit in w3 reaches every word of K1 through g', () => {
    const d = compareSchedules(expandKey(key), expandKey(flipBit(key, 127)))
    expect(d.wordBits.slice(4, 8).every((n) => n > 0)).toBe(true)
  })
})
