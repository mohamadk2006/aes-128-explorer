import { hex2 } from '../aes/hex'
import type { Block } from '../aes/types'
import './StateMatrix.css'

/**
 * A 16-byte block drawn as the AES 4×4 state, filled column by column
 * (byte i at row i % 4, column ⌊i / 4⌋). Shared by all parts.
 *
 * `highlight` marks bytes (by index 0–15), e.g. bytes that changed or that differ in Part 2.
 */
export function StateMatrix({
  block,
  label,
  highlight,
  tone = 'plain',
  size = 'md',
}: {
  block: Block
  label?: string
  highlight?: readonly number[]
  tone?: 'plain' | 'key' | 'result'
  size?: 'sm' | 'md'
}) {
  const cells = []
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const i = row + 4 * col
      cells.push(
        <span key={i} className={highlight?.includes(i) ? 'hl' : undefined}>
          {hex2(block[i])}
        </span>,
      )
    }
  return (
    <figure className={`sm sm-${tone} sm-${size}`}>
      <div className="sm-grid" role="img" aria-label={`${label ?? 'State'}: ${block.map(hex2).join(' ')}`}>
        {cells}
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}
