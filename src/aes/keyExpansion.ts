/**
 * Part 3 – Key expansion (owner: Mohamad).
 *
 * This file is the CONTRACT the other parts code against:
 *  - Part 1 (stepper / full run) needs `roundKeys` for AddRoundKey and `SBOX` / `INV_SBOX` for SubBytes.
 *  - Part 2 (avalanche) needs `roundKeys` to compare two keys.
 * Do not change the signatures without telling the team.
 *
 * Follows the chapter 5 slides ("AES Key Expansion") and FIPS-197 §5.2.
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

// ---------------------------------------------------------------------------
// GF(2^8) arithmetic with m(x) = x^8 + x^4 + x^3 + x + 1  (0x11b)
// ---------------------------------------------------------------------------

/** Multiplication by x (i.e. {02}) in GF(2^8). */
export const xtime = (a: number): number => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff

/** Multiplication of two bytes in GF(2^8) (shift-and-add). */
export function gmul(a: number, b: number): number {
  let p = 0
  for (; b; b >>= 1, a = xtime(a)) if (b & 1) p ^= a
  return p
}

/** Multiplicative inverse in GF(2^8); {00} maps to {00} by convention. */
export function ginv(a: number): number {
  if (a === 0) return 0
  // a^254 = a^-1 because the multiplicative group has 255 elements.
  let result = 1
  for (let e = 254, base = a; e; e >>= 1, base = gmul(base, base)) if (e & 1) result = gmul(result, base)
  return result
}

// ---------------------------------------------------------------------------
// S-box (slides "S-Box Construction"): inverse in GF(2^8), then the affine transform
//   b'_i = b_i ⊕ b_(i+4) ⊕ b_(i+5) ⊕ b_(i+6) ⊕ b_(i+7) ⊕ c_i,  c = {63}
// ---------------------------------------------------------------------------

const rotl8 = (x: number, s: number) => ((x << s) | (x >> (8 - s))) & 0xff

/** Affine transformation applied after the inverse when building the S-box. */
export const affine = (b: number): number => b ^ rotl8(b, 1) ^ rotl8(b, 2) ^ rotl8(b, 3) ^ rotl8(b, 4) ^ 0x63

const sbox: number[] = Array.from({ length: 256 }, (_, x) => affine(ginv(x)))
const invSbox: number[] = new Array(256)
sbox.forEach((s, x) => (invSbox[s] = x))

/** The AES S-box (256 entries). Used by SubWord here and by SubBytes in Part 1. */
export const SBOX: readonly number[] = sbox

/** Inverse S-box, used by InvSubBytes in Part 1 (decryption). */
export const INV_SBOX: readonly number[] = invSbox

/** Round constants: RC[1] = 01, RC[j] = 02 · RC[j-1] in GF(2^8). Index 0 is unused. */
export const RC: readonly number[] = (() => {
  const rc = [0, 1]
  for (let j = 2; j <= 10; j++) rc.push(xtime(rc[j - 1]))
  return rc
})()

// ---------------------------------------------------------------------------
// Key expansion
// ---------------------------------------------------------------------------

/** One-byte circular left shift: [a0, a1, a2, a3] → [a1, a2, a3, a0]. */
export function rotWord(w: Word): Word {
  return [w[1], w[2], w[3], w[0]]
}

/** S-box applied to each byte of the word. */
export function subWord(w: Word): Word {
  return w.map((b) => SBOX[b])
}

/** Byte-wise XOR of two words. */
export function xorWord(a: Word, b: Word): Word {
  return a.map((x, i) => x ^ b[i])
}

/**
 * Expands a 16-byte key into the 44-word AES-128 key schedule.
 *
 *   w[i] = key bytes 4i … 4i+3                      for i < 4
 *   temp = w[i-1]
 *   if i mod 4 = 0: temp = SubWord(RotWord(temp)) ⊕ Rcon[i/4]
 *   w[i] = w[i-4] ⊕ temp
 */
export function expandKey(key: Block): KeySchedule {
  if (key.length !== 16) throw new Error(`AES-128 key must be 16 bytes, got ${key.length}`)

  const words: Word[] = []
  const steps: WordStep[] = []

  for (let i = 0; i < 4; i++) {
    const word = key.slice(4 * i, 4 * i + 4)
    words.push(word)
    steps.push({ index: i, round: 0, word })
  }

  for (let i = 4; i < 44; i++) {
    const temp = words[i - 1]
    const wPrev4 = words[i - 4]
    let mixed = temp
    let g: WordStep['g']
    if (i % 4 === 0) {
      const rot = rotWord(temp)
      const sub = subWord(rot)
      const rcon = [RC[i / 4], 0, 0, 0]
      mixed = xorWord(sub, rcon)
      g = { rotWord: rot, subWord: sub, rcon, result: mixed }
    }
    const word = xorWord(wPrev4, mixed)
    words.push(word)
    steps.push({ index: i, round: Math.floor(i / 4), word, temp, wPrev4, ...(g && { g }) })
  }

  const roundKeys: Block[] = Array.from({ length: 11 }, (_, r) => words.slice(4 * r, 4 * r + 4).flat())
  return { words, roundKeys, steps }
}
