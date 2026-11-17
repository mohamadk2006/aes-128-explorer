import { useState } from 'react'
import { expandKey } from '../../aes/keyExpansion'
import { parseBlock, toHex } from '../../aes/hex'

/**
 * Part 3 – Key expansion: the 44 words, shown in groups of 4 (K0 … K10).
 * Placeholder page that already calls the shared contract; the real UI comes on the key-expansion branch.
 */
export function KeyExpansionPage() {
  const [keyText, setKeyText] = useState('2b7e151628aed2a6abf7158809cf4f3c')
  const key = parseBlock(keyText)
  const schedule = key ? expandKey(key) : null

  return (
    <section>
      <h1>Part 3 · Key expansion</h1>
      <label>
        Key (32 hex digits){' '}
        <input value={keyText} onChange={(e) => setKeyText(e.target.value)} size={40} spellCheck={false} />
      </label>
      {!schedule ? (
        <p role="alert">Enter exactly 32 hexadecimal digits.</p>
      ) : (
        <table>
          <tbody>
            {schedule.roundKeys.map((_, r) => (
              <tr key={r}>
                <th>K{r}</th>
                {schedule.words.slice(4 * r, 4 * r + 4).map((w, j) => (
                  <td key={j}>
                    <small>w{4 * r + j}</small> <code>{toHex(w)}</code>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
