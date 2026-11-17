/**
 * Shared AES types. Every part of the project uses these, so change them only
 * after agreeing with the team.
 *
 * All byte values are numbers 0–255.
 */

/** A 32-bit word as 4 bytes, most significant first: w = [b0, b1, b2, b3]. */
export type Word = number[]

/**
 * A 128-bit block (data block, state or round key) as 16 bytes.
 * As in FIPS-197 and the textbook, the 4×4 state is filled column by column:
 * byte i sits at row i % 4, column Math.floor(i / 4).
 */
export type Block = number[]

export type Mode = 'encrypt' | 'decrypt'
