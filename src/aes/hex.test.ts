import { describe, expect, it } from 'vitest'
import { parseBlock, toHex } from './hex'

describe('hex helpers', () => {
  it('parses a 128-bit value with or without spaces', () => {
    const b = parseBlock('2b7e1516 28aed2a6 abf71588 09cf4f3c')
    expect(b).toHaveLength(16)
    expect(toHex(b!)).toBe('2b7e151628aed2a6abf7158809cf4f3c')
  })

  it('rejects wrong length or non-hex characters', () => {
    expect(parseBlock('abc')).toBeNull()
    expect(parseBlock('zz7e151628aed2a6abf7158809cf4f3c')).toBeNull()
  })
})
