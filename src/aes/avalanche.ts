/**
 * Avalanche effect analysis (owner: Part 2 – Avalanche).
 *
 * Compares two AES-128 encryptions round by round: after every round r (0 … 10) it counts how
 * many of the 128 state bits differ between the two runs. Built on encryptTrace() from cipher.ts,
 * so there is no second AES implementation here.
 *
 * Bit numbering: bit 0 is the most significant bit of byte 0, bit 127 the least significant bit
 * of byte 15 — i.e. the order in which the bits appear when the block is written in hex.
 */
import { encryptTrace } from './cipher'
import type { EncryptionTrace } from './cipher'
import type { Block } from './types'

/** Number of 1-bits in a byte (0–8). */
export function popcount8(b: number): number {
  let n = 0
  for (let x = b & 0xff; x; x >>= 1) n += x & 1
  return n
}

/** Byte-wise XOR of two blocks: the 1-bits mark the positions where they differ. */
export function xorBlocks(a: Block, b: Block): Block {
  if (a.length !== b.length) throw new Error(`Blocks differ in length: ${a.length} vs ${b.length}`)
  return a.map((x, i) => x ^ b[i])
}

/** Number of bits in which two blocks differ (Hamming distance), 0 … 8·length. */
export function bitDifference(a: Block, b: Block): number {
  return xorBlocks(a, b).reduce((sum, x) => sum + popcount8(x), 0)
}

/** Indices (0–15) of the bytes that are not equal in the two blocks. */
export function differingBytes(a: Block, b: Block): number[] {
  const out: number[] = []
  a.forEach((x, i) => {
    if (x !== b[i]) out.push(i)
  })
  return out
}

/** Returns a copy of the block with one bit inverted (bit 0 = MSB of byte 0, see top of file). */
export function flipBit(block: Block, bit: number): Block {
  if (!Number.isInteger(bit) || bit < 0 || bit >= block.length * 8) throw new Error(`Bit index out of range: ${bit}`)
  const out = block.slice()
  out[bit >> 3] ^= 0x80 >> (bit & 7)
  return out
}

/** How the two encryptions differ in one round. */
export interface RoundComparison {
  /** 0 = after the initial AddRoundKey, 1 … 10 = after that round. */
  round: number
  /** State at the end of this round in the first and the second encryption. */
  stateA: Block
  stateB: Block
  /** stateA ⊕ stateB. */
  difference: Block
  /** Number of differing bits (0–128). */
  bits: number
  /** bits / 128 × 100. */
  percent: number
  /** Indices of the bytes that differ, for highlighting in the state matrix. */
  bytes: number[]
}

export interface AvalancheResult {
  first: EncryptionTrace
  second: EncryptionTrace
  /** Bits that differ in the inputs: plaintexts for a data change, keys for a key change. */
  inputBits: number
  /** rounds[0] … rounds[10]. */
  rounds: RoundComparison[]
}

/** Compares two stored encryption traces round by round. */
export function compareTraces(first: EncryptionTrace, second: EncryptionTrace): AvalancheResult {
  const rounds = first.rounds.map((ra, r): RoundComparison => {
    const stateA = ra.state
    const stateB = second.rounds[r].state
    const bits = bitDifference(stateA, stateB)
    return {
      round: r,
      stateA,
      stateB,
      difference: xorBlocks(stateA, stateB),
      bits,
      percent: (bits / 128) * 100,
      bytes: differingBytes(stateA, stateB),
    }
  })
  const inputBits = bitDifference(first.plaintext, second.plaintext) + bitDifference(first.key, second.key)
  return { first, second, inputBits, rounds }
}

/** Encrypts both (plaintext, key) pairs and compares them round by round. */
export function avalanche(plaintextA: Block, keyA: Block, plaintextB: Block, keyB: Block): AvalancheResult {
  return compareTraces(encryptTrace(plaintextA, keyA), encryptTrace(plaintextB, keyB))
}
