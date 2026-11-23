/**
 * Turning a message of any length into 128-bit blocks, and back.
 *
 * AES only works on 16-byte blocks. A longer message is encoded as UTF-8, padded with PKCS#7
 * (n bytes of value n, 1 ≤ n ≤ 16, so there is always padding and it can be removed again),
 * then cut into 16-byte blocks. Each block is encrypted on its own with the same key (ECB mode).
 */
import type { Block } from './types'

export const BLOCK_SIZE = 16

/** UTF-8 bytes of a string. */
export const textToBytes = (text: string): number[] => Array.from(new TextEncoder().encode(text))

/** UTF-8 text of some bytes, or null if they are not valid UTF-8. */
export function bytesToText(bytes: readonly number[]): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

/** PKCS#7: append n bytes of value n so the length becomes a multiple of 16. */
export function pad(bytes: readonly number[]): number[] {
  const n = BLOCK_SIZE - (bytes.length % BLOCK_SIZE)
  return [...bytes, ...Array<number>(n).fill(n)]
}

/** Removes PKCS#7 padding, or returns null if the padding is not valid. */
export function unpad(bytes: readonly number[]): number[] | null {
  if (bytes.length === 0 || bytes.length % BLOCK_SIZE !== 0) return null
  const n = bytes[bytes.length - 1]
  if (n < 1 || n > BLOCK_SIZE) return null
  for (let i = bytes.length - n; i < bytes.length; i++) if (bytes[i] !== n) return null
  return bytes.slice(0, bytes.length - n)
}

/** Cuts bytes (length a multiple of 16) into 16-byte blocks. */
export function splitBlocks(bytes: readonly number[]): Block[] {
  if (bytes.length % BLOCK_SIZE !== 0) throw new Error('length must be a multiple of 16 bytes')
  const out: Block[] = []
  for (let i = 0; i < bytes.length; i += BLOCK_SIZE) out.push(bytes.slice(i, i + BLOCK_SIZE))
  return out
}

/** Text → padded 16-byte blocks. */
export const textToBlocks = (text: string): Block[] => splitBlocks(pad(textToBytes(text)))

/** Padded blocks → text, or null if the padding or the UTF-8 is not valid. */
export function blocksToText(blocks: readonly Block[]): string | null {
  const bytes = unpad(blocks.flat())
  return bytes ? bytesToText(bytes) : null
}

/**
 * Parses hex made of one or more whole 128-bit blocks (32, 64, 96 … hex digits; spaces allowed).
 * Returns null if the input is empty, not hex, or not a whole number of blocks.
 */
export function parseHexBlocks(text: string): Block[] | null {
  const digits = text.replace(/\s+/g, '')
  if (digits.length === 0 || digits.length % 32 !== 0 || !/^[0-9a-fA-F]+$/.test(digits)) return null
  const bytes: number[] = []
  for (let i = 0; i < digits.length; i += 2) bytes.push(parseInt(digits.slice(i, i + 2), 16))
  return splitBlocks(bytes)
}

/**
 * Text that fits in a single block (at most 16 UTF-8 bytes) → that block.
 * Shorter text is filled up with PKCS#7 padding; exactly 16 bytes fill the block on their own.
 * Returns null if the text is longer than 16 bytes.
 */
export function textToBlock(text: string): Block | null {
  if (textToBytes(text).length > BLOCK_SIZE) return null
  return textToBlocks(text)[0]
}

/**
 * Flips the lowest bit of the last letter or digit (or the last character if there is none),
 * e.g. "Hello, AES!" → "Hello, AER!": one bit changes, and it is still readable text.
 */
export function flipLastCharBit(text: string): string {
  const chars = Array.from(text)
  if (chars.length === 0) return text
  let i = chars.length - 1
  while (i > 0 && !/[\p{L}\p{N}]/u.test(chars[i])) i--
  chars[i] = String.fromCodePoint(chars[i].codePointAt(0)! ^ 1)
  return chars.join('')
}
