/** AES-128 decryption of one 16-byte block. All operations return new blocks. */
import { addRoundKey } from './cipher'
import { INV_SBOX, expandKey, gmul } from './keyExpansion'
import type { Block } from './types'

export type InverseStepName = 'InvShiftRows' | 'InvSubBytes' | 'AddRoundKey' | 'InvMixColumns'

export interface DecryptionRoundSnapshot {
  /** Execution order: 0 is the initial XOR with K10, 10 is the final round. */
  round: number
  keyIndex: number
  roundKey: Block
  input: Block
  steps: { step: InverseStepName; state: Block }[]
  state: Block
}

export interface DecryptionTrace {
  ciphertext: Block
  key: Block
  rounds: DecryptionRoundSnapshot[]
  plaintext: Block
}

/** Undo SubBytes by replacing each byte with its inverse S-box entry. */
export function invSubBytes(state: Block): Block {
  return state.map((b) => INV_SBOX[b])
}

/** Undo ShiftRows: rotate row r right by r positions in the column-major state. */
export function invShiftRows(state: Block): Block {
  const out: Block = new Array(16)
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) out[row + 4 * col] = state[row + 4 * ((col - row + 4) % 4)]
  return out
}

/**
 * Undo MixColumns by multiplying each column by the inverse matrix in GF(2^8):
 *   [0e 0b 0d 09]
 *   [09 0e 0b 0d]
 *   [0d 09 0e 0b]
 *   [0b 0d 09 0e]
 */
export function invMixColumns(state: Block): Block {
  const out: Block = new Array(16)
  for (let col = 0; col < 4; col++) {
    const i = 4 * col
    const [a, b, c, d] = state.slice(i, i + 4)
    out[i] = gmul(0x0e, a) ^ gmul(0x0b, b) ^ gmul(0x0d, c) ^ gmul(0x09, d)
    out[i + 1] = gmul(0x09, a) ^ gmul(0x0e, b) ^ gmul(0x0b, c) ^ gmul(0x0d, d)
    out[i + 2] = gmul(0x0d, a) ^ gmul(0x09, b) ^ gmul(0x0e, c) ^ gmul(0x0b, d)
    out[i + 3] = gmul(0x0b, a) ^ gmul(0x0d, b) ^ gmul(0x09, c) ^ gmul(0x0e, d)
  }
  return out
}

/**
 * Decrypt one block and record the state after every operation for visualization.
 * Uses the original encryption key, expanded as usual.
 * Start with K10, use K9 down to K1 in the inverse rounds, and finish with K0.
 * The final inverse round omits InvMixColumns.
 */
export function decryptTrace(ciphertext: Block, key: Block): DecryptionTrace {
  if (ciphertext.length !== 16) throw new Error(`AES block must be 16 bytes, got ${ciphertext.length}`)
  const { roundKeys } = expandKey(key)

  const rounds: DecryptionRoundSnapshot[] = []
  let state = ciphertext.slice()
  for (let round = 0; round <= 10; round++) {
    const input = state
    const keyIndex = 10 - round
    const steps: DecryptionRoundSnapshot['steps'] = []
    const record = (step: InverseStepName, next: Block) => {
      steps.push({ step, state: next })
      state = next
    }

    if (round > 0) {
      record('InvShiftRows', invShiftRows(state))
      record('InvSubBytes', invSubBytes(state))
    }
    record('AddRoundKey', addRoundKey(state, roundKeys[keyIndex]))
    if (round > 0 && round < 10) record('InvMixColumns', invMixColumns(state))

    rounds.push({ round, keyIndex, roundKey: roundKeys[keyIndex], input, steps, state })
  }

  return { ciphertext: ciphertext.slice(), key: key.slice(), rounds, plaintext: state }
}

/** Decrypt one block and return only the recovered plaintext. */
export function decrypt(ciphertext: Block, key: Block): Block {
  return decryptTrace(ciphertext, key).plaintext
}
