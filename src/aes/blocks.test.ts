import { describe, expect, it } from 'vitest'
import { blocksToText, pad, parseHexBlocks, textToBlocks, unpad } from './blocks'
import { encrypt } from './cipher'
import { decrypt } from './decipher'
import { parseBlock, toHex } from './hex'

describe('text and blocks', () => {
  it('pads with PKCS#7, adding a full block when the length is already a multiple of 16', () => {
    expect(pad([1, 2, 3])).toEqual([1, 2, 3, ...Array(13).fill(13)])
    expect(pad(Array(16).fill(0))).toHaveLength(32)
    expect(pad(Array(16).fill(0)).slice(16)).toEqual(Array(16).fill(16))
  })

  it('rejects invalid padding', () => {
    expect(unpad([...Array(15).fill(0), 0])).toBeNull()
    expect(unpad([...Array(14).fill(0), 3, 2])).toBeNull()
    expect(unpad([...Array(15).fill(0), 17])).toBeNull()
    expect(unpad([1, 2])).toBeNull()
  })

  it('splits text into the right number of blocks', () => {
    expect(textToBlocks('')).toHaveLength(1)
    expect(textToBlocks('Two One Nine Two')).toHaveLength(2) // 16 bytes + a full padding block
    expect(textToBlocks('Meet me after the toga party')).toHaveLength(2) // 28 bytes
    expect(toHex(textToBlocks('Hi')[0])).toBe('48690e0e0e0e0e0e0e0e0e0e0e0e0e0e')
  })

  it('round-trips text, including non-ASCII characters', () => {
    for (const t of ['', 'hello', 'Two One Nine Two', 'مرحبا AES ✓ — 128 bits']) {
      expect(blocksToText(textToBlocks(t))).toBe(t)
    }
  })

  it('encrypts and decrypts every block of a long message', () => {
    const key = parseBlock('2b7e151628aed2a6abf7158809cf4f3c')!
    const blocks = textToBlocks('A message that is clearly longer than one AES block.')
    const cipher = blocks.map((b) => encrypt(b, key))
    expect(blocksToText(cipher.map((c) => decrypt(c, key)))).toBe('A message that is clearly longer than one AES block.')
  })

  it('parses hex made of whole blocks only', () => {
    expect(parseHexBlocks('3243f6a8885a308d313198a2e0370734')).toHaveLength(1)
    expect(parseHexBlocks('00'.repeat(32))).toHaveLength(2)
    expect(parseHexBlocks('00'.repeat(17))).toBeNull()
    expect(parseHexBlocks('')).toBeNull()
    expect(parseHexBlocks('zz'.repeat(16))).toBeNull()
  })
})
