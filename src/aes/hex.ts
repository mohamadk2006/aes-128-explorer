import type { Block } from './types'

/** Two lowercase hex digits for one byte. */
export const hex2 = (b: number): string => b.toString(16).padStart(2, '0')

/** Bytes as one hex string, e.g. [0x2b, 0x7e] → "2b7e". */
export const toHex = (bytes: readonly number[]): string => bytes.map(hex2).join('')

/**
 * Parses exactly 32 hex digits (spaces allowed) into a 16-byte block.
 * Returns null if the input is not a valid 128-bit value.
 */
export function parseBlock(text: string): Block | null {
  const digits = text.replace(/\s+/g, '')
  if (!/^[0-9a-fA-F]{32}$/.test(digits)) return null
  const out: Block = []
  for (let i = 0; i < 32; i += 2) out.push(parseInt(digits.slice(i, i + 2), 16))
  return out
}
