import type { CSSProperties } from 'react'
import { hex2 } from '../aes/hex'
import type { Block } from '../aes/types'
import './StateMatrix.css'

/**
 * A 16-byte block drawn as the AES 4×4 state, filled column by column
 * (byte i at row i % 4, column ⌊i / 4⌋). Shared by all parts.
 *
 * `highlight` marks bytes (by index 0–15), e.g. bytes that changed or that differ in Part 2.
 * A cell whose value changes between renders replays its entrance animation, so students can see
 * which bytes an operation touched. `className` lets a page add an operation-specific animation.
 */
export function StateMatrix({
  block,
  label,
  highlight,
  tone = 'plain',
  size = 'md',
  className,
}: {
  block: Block
  label?: string
  highlight?: readonly number[]
  tone?: 'plain' | 'key' | 'result'
  size?: 'sm' | 'md'
  className?: string
}) {
  const cells = []
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const i = row + 4 * col
      const style = { '--n': row * 4 + col, '--row': row, '--col': col } as CSSProperties
      cells.push(
        // Keyed by value: a changed byte is a new element, so its animation runs again.
        <span key={`${i}:${block[i]}`} className={highlight?.includes(i) ? 'hl' : undefined} style={style}>
          {hex2(block[i])}
        </span>,
      )
    }
  return (
    <figure className={`sm sm-${tone} sm-${size} ${className ?? ''}`}>
      <div className="sm-grid" role="img" aria-label={`${label ?? 'State'}: ${block.map(hex2).join(' ')}`}>
        {cells}
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}
