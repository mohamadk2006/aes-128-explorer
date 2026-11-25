import { describe, expect, it } from 'vitest'
import { parseHexBlocks, textToBlocks } from './blocks'
import { toHex } from './hex'
import { repeats, runBlocks } from './modes'

// NIST SP 800-38A, Appendix F.1.1 (ECB-AES128) and F.2.1 (CBC-AES128)
const KEY = parseHexBlocks('2b7e151628aed2a6abf7158809cf4f3c')![0]
const IV = parseHexBlocks('000102030405060708090a0b0c0d0e0f')![0]
const PLAIN = parseHexBlocks(
  '6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51 30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710',
)!
const ECB = ['3ad77bb40d7a3660a89ecaf32466ef97', 'f5d3d58503b9699de785895a96fdbaaf', '43b1cd7f598ece23881b00e3ed030688', '7b0c785e27e8ad3f8223207104725dd4']
const CBC = ['7649abac8119b246cee98e9b12e9197d', '5086cb9b507219ee95db113a917678b2', '73bed6b8e3c1743b7116e69e22229516', '3ff1caa1681fac09120eca307586e1a7']

describe('modes of operation (NIST SP 800-38A)', () => {
  it('ECB encrypts each block on its own', () => {
    expect(runBlocks(PLAIN, KEY, 'encrypt', 'ECB', IV).map((r) => toHex(r.output))).toEqual(ECB)
  })

  it('CBC chains each block to the previous ciphertext', () => {
    const runs = runBlocks(PLAIN, KEY, 'encrypt', 'CBC', IV)
    expect(runs.map((r) => toHex(r.output))).toEqual(CBC)
    expect(toHex(runs[0].chain!)).toBe(toHex(IV))
    expect(toHex(runs[1].chain!)).toBe(CBC[0])
  })

  it('decrypts both modes back to the plaintext', () => {
    for (const [chain, out] of [['ECB', ECB], ['CBC', CBC]] as const) {
      const cipher = parseHexBlocks(out.join(''))!
      expect(runBlocks(cipher, KEY, 'decrypt', chain, IV).map((r) => toHex(r.output))).toEqual(PLAIN.map(toHex))
    }
  })

  it('shows repeated blocks in ECB but not in CBC', () => {
    const blocks = textToBlocks('ATTACK AT DAWN!!ATTACK AT DAWN!!ATTACK AT DAWN!!')
    const ecb = runBlocks(blocks, KEY, 'encrypt', 'ECB', IV).map((r) => r.output)
    const cbc = runBlocks(blocks, KEY, 'encrypt', 'CBC', IV).map((r) => r.output)
    expect(repeats(blocks)).toEqual([-1, 0, 0, -1])
    expect(repeats(ecb)).toEqual([-1, 0, 0, -1])
    expect(repeats(cbc)).toEqual([-1, -1, -1, -1])
  })
})
