/**
 * Key-bit diffusion for Part 3: how a change in the key spreads through the key schedule.
 * Compares two key schedules word by word and round key by round key.
 */
import { bitDifference } from '../../aes/avalanche'
import type { KeySchedule } from '../../aes/keyExpansion'

export interface ScheduleDiff {
  /** For each word w0 … w43: number of bits that differ (0–32). */
  wordBits: number[]
  /** For each round key K0 … K10: number of bits that differ (0–128). */
  roundBits: number[]
  /** For each round key: indices (0–15) of the bytes that differ, for StateMatrix highlighting. */
  roundBytes: number[][]
}

export function compareSchedules(a: KeySchedule, b: KeySchedule): ScheduleDiff {
  return {
    wordBits: a.words.map((w, i) => bitDifference(w, b.words[i])),
    roundBits: a.roundKeys.map((k, r) => bitDifference(k, b.roundKeys[r])),
    roundBytes: a.roundKeys.map((k, r) => k.flatMap((x, i) => (x !== b.roundKeys[r][i] ? [i] : []))),
  }
}
