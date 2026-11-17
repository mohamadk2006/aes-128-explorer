/**
 * Part 3 – Key expansion (owner: Mohamad).
 *
 * This file is the CONTRACT the other parts code against:
 *  - Part 1 (stepper / full run) needs `roundKeys` for AddRoundKey and `SBOX` for SubBytes.
 *  - Part 2 (avalanche) needs `roundKeys` to compare two keys.
 *
 * The function signatures and types below are agreed; the bodies are temporary stubs
 * (all zeros) until the real implementation lands on the `key-expansion` branch.
 * Do not change the signatures without telling the team.
 */
import type { Block, Word } from './types'

/** How one word w[i] was computed, for the step-by-step display. */
export interface WordStep {
  /** Index i of the word, 0–43. */
  index: number
  /** Round key it belongs to: Math.floor(i / 4), 0–10. */
  round: number
  /** The resulting word w[i]. */
  word: Word
  /**
   * Missing for i < 4 (those words are copied straight from the key).
   * For i ≥ 4: temp = w[i-1], and wPrev4 = w[i-4].
   */
  temp?: Word
  wPrev4?: Word
  /** Only when i % 4 === 0: the extra function g applied to temp. */
  g?: {
    rotWord: Word
    subWord: Word
    /** Rcon[i/4] as a word: [RC[j], 0, 0, 0]. */
    rcon: Word
    /** subWord XOR rcon. */
    result: Word
  }
}

export interface KeySchedule {
  /** w[0] … w[43]. */
  words: Word[]
  /** K0 … K10; roundKeys[r] = w[4r] … w[4r+3] as a 16-byte block. */
  roundKeys: Block[]
  /** One entry per word, same order as `words`. */
  steps: WordStep[]
}

/** The AES S-box (256 entries). Used by SubWord here and by SubBytes in Part 1. */
export const SBOX: readonly number[] = new Array(256).fill(0) // TODO(key-expansion): build in GF(2^8)

/** Inverse S-box, used by InvSubBytes in Part 1 (decryption). */
export const INV_SBOX: readonly number[] = new Array(256).fill(0) // TODO(key-expansion)

/** Round constants RC[1] … RC[10]; index 0 is unused. */
export const RC: readonly number[] = new Array(11).fill(0) // TODO(key-expansion)

/** One-byte circular left shift: [a0, a1, a2, a3] → [a1, a2, a3, a0]. */
export function rotWord(w: Word): Word {
  return [...w] // TODO(key-expansion)
}

/** S-box applied to each byte of the word. */
export function subWord(w: Word): Word {
  return [...w] // TODO(key-expansion)
}

/** Expands a 16-byte key into the 44-word AES-128 key schedule. */
export function expandKey(key: Block): KeySchedule {
  // TODO(key-expansion): real implementation. Stub: correct shapes, all zeros.
  void key
  const words: Word[] = Array.from({ length: 44 }, () => [0, 0, 0, 0])
  return {
    words,
    roundKeys: Array.from({ length: 11 }, () => new Array(16).fill(0)),
    steps: words.map((word, index) => ({ index, round: Math.floor(index / 4), word })),
  }
}
