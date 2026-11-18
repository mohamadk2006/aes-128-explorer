/**
 * AES-128 encryption engine (owner: Encryption).
 *
 * Shared by:
 *  - Part 1 (Rounds page): the step-by-step single round and the full run, using `encryptTrace`.
 *  - Part 2 (Avalanche): compares `rounds[r].state` of two traces after every round.
 *
 * Follows the chapter 5 slides and FIPS-197 §5.1. The state is a 16-byte Block filled column
 * by column (see types.ts): byte i is at row i % 4, column Math.floor(i / 4).
 */
import { SBOX, expandKey, xtime } from './keyExpansion'
import type { Block } from './types'

/** The four transformations of an encryption round. */
export type StepName = 'SubBytes' | 'ShiftRows' | 'MixColumns' | 'AddRoundKey'

/** The state right after one step of a round. */
export interface StepSnapshot {
  step: StepName
  state: Block
}

/** Everything about one round r (0 … 10). */
export interface RoundSnapshot {
  /** 0 = the initial AddRoundKey, 1 … 9 = full rounds, 10 = final round (no MixColumns). */
  round: number
  /** Round key K_r used by this round's AddRoundKey. */
  roundKey: Block
  /** The state at the start of the round (for round 0: the plaintext). */
  input: Block
  /** The state after each step, in order. The last entry is always AddRoundKey. */
  steps: StepSnapshot[]
  /** The state at the end of the round (= the last step's state). */
  state: Block
}

export interface EncryptionTrace {
  plaintext: Block
  key: Block
  /** rounds[0] … rounds[10]. */
  rounds: RoundSnapshot[]
  ciphertext: Block
}

// ---------------------------------------------------------------------------
// The four round transformations (each returns a new Block, inputs are never changed)
// ---------------------------------------------------------------------------

/** Byte i of the state sits at row i % 4, column ⌊i / 4⌋; this is the index of (row, col). */
const at = (row: number, col: number) => row + 4 * col

/** SubBytes: replace every byte with its S-box entry. */
export function subBytes(state: Block): Block {
  return state.map((b) => SBOX[b])
}

/** ShiftRows: row r is rotated left by r positions (row 0 is unchanged). */
export function shiftRows(state: Block): Block {
  const out: Block = new Array(16)
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) out[at(row, col)] = state[at(row, (col + row) % 4)]
  return out
}

/**
 * MixColumns: each column is multiplied by the fixed matrix
 *   [02 03 01 01]
 *   [01 02 03 01]
 *   [01 01 02 03]
 *   [03 01 01 02]   in GF(2^8).
 */
export function mixColumns(state: Block): Block {
  const out: Block = new Array(16)
  for (let col = 0; col < 4; col++) {
    const [a0, a1, a2, a3] = [0, 1, 2, 3].map((row) => state[at(row, col)])
    // {02}·a = xtime(a), {03}·a = xtime(a) ⊕ a
    out[at(0, col)] = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3
    out[at(1, col)] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3
    out[at(2, col)] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3)
    out[at(3, col)] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3)
  }
  return out
}

/** AddRoundKey: XOR the state with the round key, byte by byte. */
export function addRoundKey(state: Block, roundKey: Block): Block {
  return state.map((b, i) => b ^ roundKey[i])
}

// ---------------------------------------------------------------------------
// Full encryption
// ---------------------------------------------------------------------------

/**
 * Encrypts one 16-byte block and records the state after every step of every round.
 *
 *   round 0:      AddRoundKey(K0)
 *   rounds 1–9:   SubBytes → ShiftRows → MixColumns → AddRoundKey(Kr)
 *   round 10:     SubBytes → ShiftRows → AddRoundKey(K10)   (no MixColumns)
 */
export function encryptTrace(plaintext: Block, key: Block): EncryptionTrace {
  if (plaintext.length !== 16) throw new Error(`AES block must be 16 bytes, got ${plaintext.length}`)
  const { roundKeys } = expandKey(key)

  const rounds: RoundSnapshot[] = []
  let state = plaintext.slice()

  for (let round = 0; round <= 10; round++) {
    const input = state
    const steps: StepSnapshot[] = []
    const record = (step: StepName, s: Block) => {
      steps.push({ step, state: s })
      state = s
    }

    if (round > 0) {
      record('SubBytes', subBytes(state))
      record('ShiftRows', shiftRows(state))
      if (round < 10) record('MixColumns', mixColumns(state))
    }
    record('AddRoundKey', addRoundKey(state, roundKeys[round]))

    rounds.push({ round, roundKey: roundKeys[round], input, steps, state })
  }

  return { plaintext: plaintext.slice(), key: key.slice(), rounds, ciphertext: state }
}

/** Encrypts one block and returns only the ciphertext. */
export function encrypt(plaintext: Block, key: Block): Block {
  return encryptTrace(plaintext, key).ciphertext
}
