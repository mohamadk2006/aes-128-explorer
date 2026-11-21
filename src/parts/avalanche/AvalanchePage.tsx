/**
 * Part 2 – Avalanche effect.
 *
 *  Step 1. Enter a key and a data block; encrypt and store the state after every round.
 *  Step 2. Choose a new data block for the same key, or a new key for the same data block.
 *  Step 3. Encrypt again and show, after every round, how many bits differ from the stored run.
 *
 * The encryption comes from encryptTrace() (src/aes/cipher.ts); the comparison from src/aes/avalanche.ts.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { compareTraces, flipBit, bitDifference } from '../../aes/avalanche'
import type { AvalancheResult } from '../../aes/avalanche'
import { encryptTrace } from '../../aes/cipher'
import type { EncryptionTrace } from '../../aes/cipher'
import { parseBlock, toHex } from '../../aes/hex'
import type { Block } from '../../aes/types'
import { StateMatrix } from '../../components/StateMatrix'
import './AvalanchePage.css'

const EXAMPLES = [
  { label: 'FIPS-197 Appendix B', key: '2b7e151628aed2a6abf7158809cf4f3c', data: '3243f6a8885a308d313198a2e0370734' },
  { label: 'Textbook', key: '0f1571c947d9e8590cb7add6af7f6798', data: '0123456789abcdeffedcba9876543210' },
  { label: 'All zeros', key: '00000000000000000000000000000000', data: '00000000000000000000000000000000' },
]

type Change = 'data' | 'key'

const randomHex = () => toHex(Array.from(crypto.getRandomValues(new Uint8Array(16))))
const randomBit = () => crypto.getRandomValues(new Uint8Array(1))[0] & 127

/** Hex with a space every 4 bytes, for readability. */
const spaced = (b: Block) => toHex(b).replace(/(.{8})(?!$)/g, '$1 ')

export function AvalanchePage() {
  // Step 1 inputs and the stored first encryption.
  const [keyText, setKeyText] = useState(EXAMPLES[0].key)
  const [dataText, setDataText] = useState(EXAMPLES[0].data)
  const [stored, setStored] = useState<EncryptionTrace | null>(null)

  // Step 2: what changes, and the new value.
  const [change, setChange] = useState<Change>('data')
  const [newText, setNewText] = useState('')

  const key = parseBlock(keyText)
  const data = parseBlock(dataText)
  const inputsChanged = !!stored && (toHex(stored.key) !== keyText.replace(/\s+/g, '').toLowerCase() ||
    toHex(stored.plaintext) !== dataText.replace(/\s+/g, '').toLowerCase())

  const store = () => {
    if (!key || !data) return
    setStored(encryptTrace(data, key))
    // Start the second run one bit away from the first, the classic avalanche experiment.
    setNewText(toHex(flipBit(change === 'data' ? data : key, 127)))
  }

  const pickChange = (c: Change) => {
    setChange(c)
    if (stored) setNewText(toHex(flipBit(c === 'data' ? stored.plaintext : stored.key, 127)))
  }

  const original = stored ? (change === 'data' ? stored.plaintext : stored.key) : null
  const newValue = parseBlock(newText)
  const result: AvalancheResult | null =
    stored && newValue
      ? compareTraces(
          stored,
          change === 'data' ? encryptTrace(newValue, stored.key) : encryptTrace(stored.plaintext, newValue),
        )
      : null

  return (
    <section className="av">
      <h1>Part 2 · Avalanche effect</h1>
      <p className="av-lead">
        A good cipher changes about half of the output bits when a single input bit changes. Encrypt once and store
        the data after every round, then encrypt again with a new data block or a new key and watch the difference
        spread round by round.
      </p>

      {/* Step 1 */}
      <div className="av-card">
        <h2>
          <span className="av-num">1</span> First encryption
        </h2>
        <div className="av-inputs">
          <HexField id="av-key" label="Key (128 bits, 32 hex digits)" value={keyText} onChange={setKeyText} valid={!!key} />
          <HexField id="av-data" label="Data block (128 bits, 32 hex digits)" value={dataText} onChange={setDataText} valid={!!data} />
          <div className="av-examples">
            Examples:
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="av-chip"
                onClick={() => {
                  setKeyText(ex.key)
                  setDataText(ex.data)
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
        <div className="av-actions">
          <button type="button" className="av-primary" onClick={store} disabled={!key || !data}>
            {stored ? 'Encrypt and store again' : 'Encrypt and store each round'}
          </button>
          {stored && !inputsChanged && (
            <span className="av-muted">
              ✓ Stored 11 round states. Ciphertext <code>{spaced(stored.ciphertext)}</code>
            </span>
          )}
          {inputsChanged && (
            <span className="av-warn" role="status">
              The inputs changed — press the button to store the new run. The comparison below still uses the
              stored one.
            </span>
          )}
        </div>
      </div>

      {/* Step 2 */}
      {stored && original && (
        <div className="av-card">
          <h2>
            <span className="av-num">2</span> Second encryption
          </h2>
          <div className="av-tabs" role="radiogroup" aria-label="What changes">
            <button type="button" role="radio" aria-checked={change === 'data'} onClick={() => pickChange('data')}>
              New data block, same key
            </button>
            <button type="button" role="radio" aria-checked={change === 'key'} onClick={() => pickChange('key')}>
              New key, same data block
            </button>
          </div>

          <p className="av-muted av-fixed">
            {change === 'data' ? 'Key (unchanged): ' : 'Data block (unchanged): '}
            <code>{spaced(change === 'data' ? stored.key : stored.plaintext)}</code>
          </p>

          <HexField
            id="av-new"
            label={change === 'data' ? 'New data block' : 'New key'}
            value={newText}
            onChange={setNewText}
            valid={!!newValue}
            extra={
              <button type="button" onClick={() => setNewText(toHex(flipBit(original, randomBit())))}>
                Flip 1 random bit
              </button>
            }
          />
          {newValue && <BitStrip a={original} b={newValue} label={change === 'data' ? 'data block' : 'key'} />}
        </div>
      )}

      {/* Step 3 */}
      {result && <Results result={result} change={change} />}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function HexField({
  id,
  label,
  value,
  onChange,
  valid,
  extra,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  valid: boolean
  extra?: ReactNode
}) {
  const digits = value.replace(/\s+/g, '')
  return (
    <div className="av-field">
      <label htmlFor={id}>{label}</label>
      <div className="av-row">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!valid}
          aria-describedby={`${id}-help`}
        />
        {extra}
        <button type="button" onClick={() => onChange(randomHex())}>
          Random
        </button>
      </div>
      <small id={`${id}-help`} className={valid ? 'av-muted' : 'av-error'} role={valid ? undefined : 'alert'}>
        {valid
          ? '✓ 16 bytes'
          : /[^0-9a-fA-F]/.test(digits)
            ? 'Use only hexadecimal digits 0–9 and a–f.'
            : `${digits.length} of 32 hex digits.`}
      </small>
    </div>
  )
}

/** The 128 bits of the new input, with the bits that differ from the original marked. */
function BitStrip({ a, b, label }: { a: Block; b: Block; label: string }) {
  const n = bitDifference(a, b)
  const bits = []
  for (let i = 0; i < 128; i++) {
    const mask = 0x80 >> (i & 7)
    const bit = b[i >> 3] & mask ? 1 : 0
    const diff = (a[i >> 3] ^ b[i >> 3]) & mask
    bits.push(
      <span key={i} className={diff ? 'av-bit-diff' : undefined} title={`bit ${i}`}>
        {bit}
      </span>,
    )
  }
  return (
    <div className="av-bits-wrap">
      <p className="av-muted">
        The new {label} differs from the stored one in <b className="av-strong">{n}</b> of 128 bits
        {n === 0 && ' — change at least one bit to see the avalanche'}.
      </p>
      <div className="av-bits" aria-label={`${n} bits differ`}>
        {bits}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Results({ result, change }: { result: AvalancheResult; change: Change }) {
  const final = result.rounds[10]
  const later = result.rounds.slice(1)
  const avg = later.reduce((s, r) => s + r.bits, 0) / later.length
  return (
    <div className="av-card">
      <h2>
        <span className="av-num">3</span> Bit mismatch after each round
      </h2>

      <div className="av-stats">
        <div>
          <small>Input difference</small>
          <b>
            {result.inputBits} bit{result.inputBits === 1 ? '' : 's'}
          </b>
          <span className="av-muted">in the {change === 'data' ? 'data block' : 'key'}</span>
        </div>
        <div>
          <small>Ciphertext difference</small>
          <b className="av-strong">{final.bits} / 128 bits</b>
          <span className="av-muted">{final.percent.toFixed(1)} %</span>
        </div>
        <div>
          <small>Average over rounds 1–10</small>
          <b>{avg.toFixed(1)} bits</b>
          <span className="av-muted">ideal ≈ 64 (50 %)</span>
        </div>
      </div>

      <Chart result={result} />

      <div className="av-table-wrap">
        <table className="av-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>First encryption</th>
              <th>Second encryption</th>
              <th>Difference (XOR)</th>
              <th>Bits that differ</th>
            </tr>
          </thead>
          <tbody>
            {result.rounds.map((r) => (
              <tr key={r.round}>
                <th scope="row">{r.round}</th>
                <td>
                  <StateMatrix block={r.stateA} size="sm" tone={r.round === 10 ? 'result' : 'plain'} highlight={r.bytes} />
                </td>
                <td>
                  <StateMatrix block={r.stateB} size="sm" tone={r.round === 10 ? 'result' : 'plain'} highlight={r.bytes} />
                </td>
                <td>
                  <StateMatrix block={r.difference} size="sm" tone="key" />
                </td>
                <td className="av-count">
                  <b>{r.bits}</b> / 128
                  <span className="av-muted"> ({r.percent.toFixed(1)} %)</span>
                  <div className="av-meter" aria-hidden="true">
                    <span style={{ width: `${r.percent}%` }} />
                  </div>
                  <small className="av-muted">
                    {r.bytes.length} of 16 bytes changed
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="av-muted av-note">
        Round 0 is the state after the initial AddRoundKey. Highlighted bytes differ between the two runs. In the
        difference matrix, every 1-bit marks a bit that differs.
      </p>
    </div>
  )
}

/** Bar chart of differing bits per round, with the ideal 64-bit (50 %) line. */
function Chart({ result }: { result: AvalancheResult }) {
  const W = 560
  const H = 220
  const pad = { l: 36, r: 12, t: 14, b: 30 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const slot = iw / 11
  const y = (bits: number) => pad.t + ih - (bits / 128) * ih
  return (
    <figure className="av-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Differing bits per round: ${result.rounds.map((r) => r.bits).join(', ')}`}>
        {[0, 32, 64, 96, 128].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 64 ? 'av-ideal' : 'av-grid'} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="av-axis">
              {t}
            </text>
          </g>
        ))}
        <text x={W - pad.r} y={y(64) - 5} textAnchor="end" className="av-axis av-ideal-label">
          ideal 50 %
        </text>
        {result.rounds.map((r) => {
          const x = pad.l + r.round * slot + slot * 0.18
          const w = slot * 0.64
          return (
            <g key={r.round}>
              <rect x={x} y={y(r.bits)} width={w} height={Math.max(0, pad.t + ih - y(r.bits))} rx={3} className="av-bar">
                <title>
                  Round {r.round}: {r.bits} bits ({r.percent.toFixed(1)} %)
                </title>
              </rect>
              <text x={x + w / 2} y={y(r.bits) - 4} textAnchor="middle" className="av-axis av-val">
                {r.bits}
              </text>
              <text x={x + w / 2} y={H - pad.b + 16} textAnchor="middle" className="av-axis">
                {r.round}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="av-muted">Differing bits after each round (0 = after the initial AddRoundKey)</figcaption>
    </figure>
  )
}
