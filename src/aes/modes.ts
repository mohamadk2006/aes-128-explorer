/**
 * Modes of operation: how AES (one 16-byte block) is used for a longer message.
 *
 *  ECB: every block is encrypted on its own: C_i = E(K, P_i). Equal plaintext blocks give equal
 *       ciphertext blocks, so patterns in the message show through.
 *  CBC: every plaintext block is XORed with the previous ciphertext block (the IV for the first)
 *       before it is encrypted: C_i = E(K, P_i ⊕ C_{i-1}), C_0 = IV. Decryption: P_i = D(K, C_i) ⊕ C_{i-1}.
 *       Equal plaintext blocks now give different ciphertext blocks.
 */
import { xorBlocks } from './avalanche'
import { encryptTrace } from './cipher'
import type { EncryptionTrace } from './cipher'
import { decryptTrace } from './decipher'
import type { DecryptionTrace } from './decipher'
import type { Block, Mode } from './types'

export type ChainMode = 'ECB' | 'CBC'

/** One block of the message going through AES. */
export interface BlockRun {
  /** The block as given: a plaintext block when encrypting, a ciphertext block when decrypting. */
  input: Block
  /** CBC only: the block it is XORed with (the IV or the previous ciphertext block). */
  chain: Block | null
  /** What AES itself encrypts or decrypts (for CBC encryption: input ⊕ chain). */
  aesIn: Block
  /** The full AES trace of aesIn. */
  trace: EncryptionTrace | DecryptionTrace
  /** What AES returns (for CBC decryption this is still XORed with chain). */
  aesOut: Block
  /** The block of the result: ciphertext when encrypting, plaintext when decrypting. */
  output: Block
}

export function runBlocks(blocks: readonly Block[], key: Block, mode: Mode, chain: ChainMode, iv: Block): BlockRun[] {
  const runs: BlockRun[] = []
  let prev = iv
  for (const input of blocks) {
    const link = chain === 'CBC' ? prev : null
    if (mode === 'encrypt') {
      const aesIn = link ? xorBlocks(input, link) : input
      const trace = encryptTrace(aesIn, key)
      runs.push({ input, chain: link, aesIn, trace, aesOut: trace.ciphertext, output: trace.ciphertext })
      prev = trace.ciphertext
    } else {
      const trace = decryptTrace(input, key)
      const output = link ? xorBlocks(trace.plaintext, link) : trace.plaintext
      runs.push({ input, chain: link, aesIn: input, trace, aesOut: trace.plaintext, output })
      prev = input
    }
  }
  return runs
}

/** For each block, the index of the first earlier block with the same bytes, or -1. */
export function repeats(blocks: readonly Block[]): number[] {
  const seen = new Map<string, number>()
  return blocks.map((b, i) => {
    const k = b.join(',')
    const first = seen.get(k)
    if (first === undefined) seen.set(k, i)
    return first ?? -1
  })
}
