import { describe, expect, it } from 'vitest'
import { addRoundKey, encrypt, encryptTrace, mixColumns, shiftRows, subBytes } from './cipher'
import { parseBlock, toHex } from './hex'

const block = (hex: string) => parseBlock(hex)!

describe('round transformations', () => {
  it('ShiftRows rotates row r left by r', () => {
    // State bytes 00 01 … 0f, filled column by column.
    const s = block('000102030405060708090a0b0c0d0e0f')
    expect(toHex(shiftRows(s))).toBe('00050a0f04090e03080d02070c01060b')
  })

  it('MixColumns matches the chapter 5 slide example', () => {
    // Slide: 87 F2 4D 97 / 6E 4C 90 EC / 46 E7 4A C3 / A6 8C D8 95
    //     → 47 40 A3 4C / 37 D4 70 9F / 94 E4 3A 42 / ED A5 A6 BC  (written column by column here)
    const s = block('876e46a6f24ce78c4d904ad897ecc395')
    expect(toHex(mixColumns(s))).toBe('473794ed40d4e4a5a3703aa64c9f42bc')
  })

  it('does not modify its input', () => {
    const s = block('000102030405060708090a0b0c0d0e0f')
    const copy = s.slice()
    subBytes(s)
    shiftRows(s)
    mixColumns(s)
    addRoundKey(s, s)
    expect(s).toEqual(copy)
  })
})

describe('encryptTrace (FIPS-197 Appendix B)', () => {
  const trace = encryptTrace(
    block('3243f6a8885a308d313198a2e0370734'),
    block('2b7e151628aed2a6abf7158809cf4f3c'),
  )
  const hex = (r: number) => trace.rounds[r].steps.map((s) => `${s.step}:${toHex(s.state)}`)

  it('has 11 rounds with the right steps', () => {
    expect(trace.rounds).toHaveLength(11)
    expect(trace.rounds[0].steps.map((s) => s.step)).toEqual(['AddRoundKey'])
    expect(trace.rounds[5].steps.map((s) => s.step)).toEqual(['SubBytes', 'ShiftRows', 'MixColumns', 'AddRoundKey'])
    expect(trace.rounds[10].steps.map((s) => s.step)).toEqual(['SubBytes', 'ShiftRows', 'AddRoundKey'])
  })

  it('round 0: initial AddRoundKey', () => {
    expect(toHex(trace.rounds[0].state)).toBe('193de3bea0f4e22b9ac68d2ae9f84808')
  })

  it('round 1: every step matches', () => {
    expect(toHex(trace.rounds[1].input)).toBe('193de3bea0f4e22b9ac68d2ae9f84808')
    expect(hex(1)).toEqual([
      'SubBytes:d42711aee0bf98f1b8b45de51e415230',
      'ShiftRows:d4bf5d30e0b452aeb84111f11e2798e5',
      'MixColumns:046681e5e0cb199a48f8d37a2806264c',
      'AddRoundKey:a49c7ff2689f352b6b5bea43026a5049',
    ])
    expect(toHex(trace.rounds[1].roundKey)).toBe('a0fafe1788542cb123a339392a6c7605')
  })

  it('round 10 and the ciphertext', () => {
    // FIPS-197 shows this as rows: eb 59 8b 1b / 40 2e a1 c3 / f2 38 13 42 / 1e 84 e7 d2
    expect(toHex(trace.rounds[10].input)).toBe('eb40f21e592e38848ba113e71bc342d2')
    expect(toHex(trace.rounds[10].roundKey)).toBe('d014f9a8c9ee2589e13f0cc8b6630ca6')
    expect(toHex(trace.ciphertext)).toBe('3925841d02dc09fbdc118597196a0b32')
  })
})

describe('encrypt (FIPS-197 Appendix C.1)', () => {
  it('produces the published ciphertext', () => {
    const c = encrypt(block('00112233445566778899aabbccddeeff'), block('000102030405060708090a0b0c0d0e0f'))
    expect(toHex(c)).toBe('69c4e0d86a7b0430d8cdb78070b4c55a')
  })

  it('rejects blocks that are not 16 bytes', () => {
    expect(() => encrypt([1, 2, 3], block('000102030405060708090a0b0c0d0e0f'))).toThrow()
  })
})
