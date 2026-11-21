import { describe, expect, it } from 'vitest'
import { encryptTrace, mixColumns, shiftRows, subBytes } from './cipher'
import { decrypt, decryptTrace, invMixColumns, invShiftRows, invSubBytes } from './decipher'
import { parseBlock, toHex } from './hex'

const block = (hex: string) => parseBlock(hex)!
const key = block('000102030405060708090a0b0c0d0e0f')
const plaintext = block('00112233445566778899aabbccddeeff')
const ciphertext = block('69c4e0d86a7b0430d8cdb78070b4c55a')

describe('AES-128 decryption', () => {
  it('recovers the FIPS-197 C.1 plaintext', () => {
    expect(decrypt(ciphertext, key)).toEqual(plaintext)
  })

  it('recovers the FIPS-197 Appendix B plaintext', () => {
    expect(toHex(decrypt(
      block('3925841d02dc09fbdc118597196a0b32'),
      block('2b7e151628aed2a6abf7158809cf4f3c'),
    ))).toBe('3243f6a8885a308d313198a2e0370734')
  })

  it('agrees with Web Crypto ciphertexts and reverses each transformation', async () => {
    for (let i = 0; i < 32; i++) {
      const original = crypto.getRandomValues(new Uint8Array(16))
      const secret = crypto.getRandomValues(new Uint8Array(16))
      const imported = await crypto.subtle.importKey('raw', secret, 'AES-CBC', false, ['encrypt'])
      // With a zero IV, the first CBC block equals raw AES encryption of the input.
      // Web Crypto also appends a padding block; only the first block is used here.
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, imported, original)
      expect(decrypt(Array.from(new Uint8Array(encrypted).slice(0, 16)), Array.from(secret))).toEqual(Array.from(original))
      const state = Array.from(original)
      expect(invSubBytes(subBytes(state))).toEqual(state)
      expect(invShiftRows(shiftRows(state))).toEqual(state)
      expect(invMixColumns(mixColumns(state))).toEqual(state)
    }
  })

  it('rejects invalid ciphertext and key lengths', () => {
    expect(() => decrypt([1, 2, 3], key)).toThrow(/16 bytes/)
    expect(() => decrypt(ciphertext, [1, 2, 3])).toThrow(/16 bytes/)
  })
})

describe('decryption visualization trace', () => {
  const trace = decryptTrace(ciphertext, key)
  const forward = encryptTrace(plaintext, key)

  it('records 11 rounds in execution order with keys K10 down to K0', () => {
    expect(trace.rounds).toHaveLength(11)
    trace.rounds.forEach((round, i) => {
      expect(round.round).toBe(i)
      expect(round.keyIndex).toBe(10 - i)
      expect(round.roundKey).toEqual(forward.rounds[10 - i].roundKey)
      expect(round.input).toEqual(i === 0 ? ciphertext : trace.rounds[i - 1].state)
      expect(round.state).toEqual(round.steps.at(-1)!.state)
    })
  })

  it('records the correct operation order and omits the final InvMixColumns', () => {
    expect(trace.rounds[0].steps.map((s) => s.step)).toEqual(['AddRoundKey'])
    for (let r = 1; r < 10; r++) {
      expect(trace.rounds[r].steps.map((s) => s.step)).toEqual([
        'InvShiftRows', 'InvSubBytes', 'AddRoundKey', 'InvMixColumns',
      ])
    }
    expect(trace.rounds[10].steps.map((s) => s.step)).toEqual([
      'InvShiftRows', 'InvSubBytes', 'AddRoundKey',
    ])
    expect(trace.rounds[10].state).toEqual(plaintext)
    expect(trace.plaintext).toEqual(plaintext)
  })

  it('records intermediate states that undo the corresponding encryption operations', () => {
    expect(trace.rounds[0].state).toEqual(forward.rounds[10].steps[1].state)
    for (let r = 1; r <= 10; r++) {
      const j = 10 - r
      const steps = trace.rounds[r].steps
      expect(steps[0].state).toEqual(forward.rounds[j + 1].steps[0].state)
      expect(steps[1].state).toEqual(forward.rounds[j].state)
      expect(steps[2].state).toEqual(j === 0 ? plaintext : forward.rounds[j].steps[2].state)
      if (j > 0) expect(steps[3].state).toEqual(forward.rounds[j].steps[1].state)
    }
  })

  it('preserves inputs and keeps intermediate snapshots separate', () => {
    const input = ciphertext.slice()
    const secret = key.slice()
    const result = decryptTrace(input, secret)
    expect(input).toEqual(ciphertext)
    expect(secret).toEqual(key)
    input[0] ^= 0xff
    secret[0] ^= 0xff
    expect(result.ciphertext).toEqual(ciphertext)
    expect(result.key).toEqual(key)
    expect(result.rounds[0].input).toEqual(ciphertext)
    const snapshots = result.rounds.flatMap((r) => r.steps.map((s) => s.state))
    expect(new Set(snapshots).size).toBe(snapshots.length)
  })
})
