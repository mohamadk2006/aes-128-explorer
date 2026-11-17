import { describe, expect, it } from 'vitest'
import { INV_SBOX, RC, SBOX, expandKey, ginv, gmul, rotWord, subWord, xorWord } from './keyExpansion'
import { parseBlock, toHex } from './hex'
import type { Word } from './types'

const word = (hex: string): Word => [0, 2, 4, 6].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('GF(2^8)', () => {
  it('multiplies (FIPS-197 §4.2 example)', () => {
    expect(gmul(0x57, 0x83)).toBe(0xc1)
    expect(gmul(0x57, 0x13)).toBe(0xfe)
  })

  it('inverts (chapter 5 S-box example: inverse of 95 is 8A)', () => {
    expect(ginv(0x95)).toBe(0x8a)
    for (let a = 1; a < 256; a++) expect(gmul(a, ginv(a))).toBe(1)
  })
})

describe('S-box', () => {
  it('matches known entries', () => {
    expect(SBOX[0x00]).toBe(0x63)
    expect(SBOX[0x95]).toBe(0x2a) // chapter 5 S-box construction example
    expect(SBOX[0x53]).toBe(0xed)
    expect(SBOX[0xff]).toBe(0x16)
  })

  it('is a permutation and INV_SBOX undoes it', () => {
    expect(new Set(SBOX).size).toBe(256)
    for (let x = 0; x < 256; x++) expect(INV_SBOX[SBOX[x]]).toBe(x)
  })
})

describe('round constants', () => {
  it('are 01 02 04 08 10 20 40 80 1B 36', () => {
    expect(RC.slice(1)).toEqual([0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36])
  })
})

describe('chapter 5 example (round 8 → first word of round 9)', () => {
  // Round 8 key: EA D2 73 21 B5 8D BA D2 31 2B F5 60 7F 8D 29 2F
  it('computes each intermediate value from the slide', () => {
    const temp = word('7f8d292f')
    const rot = rotWord(temp)
    expect(toHex(rot)).toBe('8d292f7f')
    const sub = subWord(rot)
    expect(toHex(sub)).toBe('5da515d2')
    const g = xorWord(sub, [RC[9], 0, 0, 0])
    expect(toHex(g)).toBe('46a515d2')
    expect(toHex(xorWord(g, word('ead27321')))).toBe('ac7766f3')
  })
})

describe('expandKey (FIPS-197 Appendix A.1)', () => {
  const schedule = expandKey(parseBlock('2b7e151628aed2a6abf7158809cf4f3c')!)

  it('produces 44 words and 11 round keys', () => {
    expect(schedule.words).toHaveLength(44)
    expect(schedule.roundKeys).toHaveLength(11)
    expect(schedule.steps).toHaveLength(44)
  })

  it('matches the published words', () => {
    const w = schedule.words.map(toHex)
    expect(w[0]).toBe('2b7e1516')
    expect(w[3]).toBe('09cf4f3c')
    expect(w[4]).toBe('a0fafe17')
    expect(w[5]).toBe('88542cb1')
    expect(w[6]).toBe('23a33939')
    expect(w[7]).toBe('2a6c7605')
    expect(w[8]).toBe('f2c295f2')
    expect(w[43]).toBe('b6630ca6')
  })

  it('groups words into round keys', () => {
    expect(toHex(schedule.roundKeys[0])).toBe('2b7e151628aed2a6abf7158809cf4f3c')
    expect(toHex(schedule.roundKeys[1])).toBe('a0fafe1788542cb123a339392a6c7605')
    expect(toHex(schedule.roundKeys[10])).toBe('d014f9a8c9ee2589e13f0cc8b6630ca6')
  })

  it('records the derivation of w4 (Appendix A.1 first row)', () => {
    const s = schedule.steps[4]
    expect(toHex(s.temp!)).toBe('09cf4f3c')
    expect(toHex(s.g!.rotWord)).toBe('cf4f3c09')
    expect(toHex(s.g!.subWord)).toBe('8a84eb01')
    expect(toHex(s.g!.rcon)).toBe('01000000')
    expect(toHex(s.g!.result)).toBe('8b84eb01')
    expect(toHex(s.wPrev4!)).toBe('2b7e1516')
    expect(schedule.steps[5].g).toBeUndefined()
    expect(schedule.steps[0].temp).toBeUndefined()
  })

  it('rejects keys that are not 16 bytes', () => {
    expect(() => expandKey([1, 2, 3])).toThrow()
  })
})

describe('expandKey (FIPS-197 Appendix C.1 key)', () => {
  it('ends with the published last round key', () => {
    const s = expandKey(parseBlock('000102030405060708090a0b0c0d0e0f')!)
    expect(toHex(s.roundKeys[10])).toBe('13111d7fe3944a17f307a78b4d2b30c5')
  })
})
