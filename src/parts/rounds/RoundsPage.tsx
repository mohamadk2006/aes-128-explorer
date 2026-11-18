/**
 * Part 1 – AES rounds (encryption).
 *  1a. One round step by step, pausing after each transformation.
 *  1b. Full encryption showing the round key and the data after every round.
 *
 * All values come from encryptTrace() in src/aes/cipher.ts.
 */
import { useState } from 'react'
import { encryptTrace } from '../../aes/cipher'
import type { EncryptionTrace, RoundSnapshot, StepName } from '../../aes/cipher'
import { parseBlock, toHex } from '../../aes/hex'
import { StateMatrix } from '../../components/StateMatrix'
import './RoundsPage.css'

const EXAMPLES = [
  { label: 'FIPS-197 Appendix B', key: '2b7e151628aed2a6abf7158809cf4f3c', data: '3243f6a8885a308d313198a2e0370734' },
  { label: 'Textbook', key: '0f1571c947d9e8590cb7add6af7f6798', data: '0123456789abcdeffedcba9876543210' },
  { label: 'FIPS-197 C.1', key: '000102030405060708090a0b0c0d0e0f', data: '00112233445566778899aabbccddeeff' },
]

const randomHex = () => toHex(Array.from(crypto.getRandomValues(new Uint8Array(16))))

const EXPLAIN: Record<StepName, string> = {
  SubBytes: 'Each byte is replaced by its S-box entry (non-linear substitution).',
  ShiftRows: 'Row 0 stays; rows 1, 2 and 3 are rotated left by 1, 2 and 3 bytes.',
  MixColumns: 'Each column is multiplied by the fixed matrix [02 03 01 01] in GF(2⁸), mixing its 4 bytes.',
  AddRoundKey: 'The state is XORed byte by byte with the round key.',
}

/** Bytes that ShiftRows moves (rows 1–3), to highlight them. */
const SHIFTED = Array.from({ length: 16 }, (_, i) => i).filter((i) => i % 4 !== 0)

export function RoundsPage() {
  const [keyText, setKeyText] = useState(EXAMPLES[0].key)
  const [dataText, setDataText] = useState(EXAMPLES[0].data)
  const [view, setView] = useState<'step' | 'full'>('step')

  const key = parseBlock(keyText)
  const data = parseBlock(dataText)
  const trace = key && data ? encryptTrace(data, key) : null

  return (
    <section className="rd">
      <h1>Part 1 · AES rounds</h1>
      <p className="rd-lead">
        Enter a 128-bit key and one 128-bit data block. Step through a single round one transformation at a time,
        or run the full encryption and see the key and the data after every round.
      </p>

      <div className="rd-inputs">
        <HexField id="rd-key" label="Key (128 bits, 32 hex digits)" value={keyText} onChange={setKeyText} valid={!!key} />
        <HexField id="rd-data" label="Data block (128 bits, 32 hex digits)" value={dataText} onChange={setDataText} valid={!!data} />
        <div className="rd-examples">
          Examples:
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="rd-chip"
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

      <div className="rd-tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'step'} onClick={() => setView('step')}>
          One round, step by step
        </button>
        <button type="button" role="tab" aria-selected={view === 'full'} onClick={() => setView('full')}>
          Full encryption
        </button>
      </div>

      {!trace ? (
        <p className="rd-card rd-muted">Enter a valid key and data block to start.</p>
      ) : view === 'step' ? (
        <SingleRound trace={trace} />
      ) : (
        <FullEncryption trace={trace} />
      )}
    </section>
  )
}

function HexField({
  id,
  label,
  value,
  onChange,
  valid,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  valid: boolean
}) {
  const digits = value.replace(/\s+/g, '')
  return (
    <div className="rd-field">
      <label htmlFor={id}>{label}</label>
      <div className="rd-row">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!valid}
          aria-describedby={`${id}-help`}
        />
        <button type="button" onClick={() => onChange(randomHex())}>
          Random
        </button>
      </div>
      <small id={`${id}-help`} className={valid ? 'rd-muted' : 'rd-error'} role={valid ? undefined : 'alert'}>
        {valid
          ? '✓ 16 bytes'
          : /[^0-9a-fA-F]/.test(digits)
            ? 'Use only hexadecimal digits 0–9 and a–f.'
            : `${digits.length} of 32 hex digits.`}
      </small>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1a. One round, step by step
// ---------------------------------------------------------------------------

function SingleRound({ trace }: { trace: EncryptionTrace }) {
  const [round, setRound] = useState(1)
  return (
    <div className="rd-card">
      <div className="rd-round-pick">
        <span>Round:</span>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
          <button key={r} type="button" aria-pressed={r === round} onClick={() => setRound(r)}>
            {r}
          </button>
        ))}
      </div>
      {/* key= restarts the stepper whenever the round or the inputs change */}
      <Stepper key={`${round}:${toHex(trace.key)}:${toHex(trace.plaintext)}`} snap={trace.rounds[round]} />
    </div>
  )
}

function Stepper({ snap }: { snap: RoundSnapshot }) {
  // pos 0 = start of the round; pos k = after the k-th step.
  const [pos, setPos] = useState(0)
  const steps = snap.steps
  const last = steps.length
  const current = pos > 0 ? steps[pos - 1] : null
  const before = pos > 1 ? steps[pos - 2].state : snap.input
  const isFinal = snap.round === 10

  return (
    <>
      <ol className="rd-steps">
        <li className={pos === 0 ? 'now' : 'done'}>Start</li>
        {(['SubBytes', 'ShiftRows', 'MixColumns', 'AddRoundKey'] as StepName[]).map((name) => {
          const idx = steps.findIndex((s) => s.step === name)
          const cls = idx < 0 ? 'skip' : idx + 1 === pos ? 'now' : idx + 1 < pos ? 'done' : ''
          return (
            <li key={name} className={cls}>
              {name}
              {idx < 0 && <small> (skipped)</small>}
            </li>
          )
        })}
      </ol>

      <div className="rd-stage" aria-live="polite">
        {!current ? (
          <>
            <p className="rd-explain">
              State at the start of round {snap.round}
              {snap.round === 1 ? ' (plaintext after the initial AddRoundKey with K0)' : ` (output of round ${snap.round - 1})`}.
              {isFinal && ' Round 10 is the final round: it has no MixColumns.'} Press <b>Next</b> to apply the first step.
            </p>
            <div className="rd-flow">
              <StateMatrix block={snap.input} label={`Input to round ${snap.round}`} />
            </div>
          </>
        ) : (
          <>
            <p className="rd-explain">
              <b>
                Step {pos} of {last}: {current.step}.
              </b>{' '}
              {EXPLAIN[current.step]}
            </p>
            <div className="rd-flow" key={pos}>
              <StateMatrix block={before} label="Before" />
              {current.step === 'AddRoundKey' ? (
                <>
                  <span className="rd-op">⊕</span>
                  <StateMatrix block={snap.roundKey} label={`Round key K${snap.round}`} tone="key" />
                </>
              ) : (
                <span className="rd-op">→ {current.step} →</span>
              )}
              {current.step === 'AddRoundKey' && <span className="rd-op">=</span>}
              <StateMatrix
                block={current.state}
                label="After"
                tone={pos === last ? 'result' : 'plain'}
                highlight={current.step === 'ShiftRows' ? SHIFTED : undefined}
              />
            </div>
            {pos === last && (
              <p className="rd-explain">
                Round {snap.round} is complete. Output: <code>{toHex(current.state)}</code>
                {isFinal && ' — this is the ciphertext.'}
              </p>
            )}
          </>
        )}
      </div>

      <div className="rd-nav">
        <button type="button" onClick={() => setPos(0)} disabled={pos === 0}>
          Restart
        </button>
        <button type="button" onClick={() => setPos(pos - 1)} disabled={pos === 0}>
          ← Back
        </button>
        <button type="button" className="rd-primary" onClick={() => setPos(pos + 1)} disabled={pos === last}>
          Next →
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// 1b. Full encryption: key and data after each round
// ---------------------------------------------------------------------------

function FullEncryption({ trace }: { trace: EncryptionTrace }) {
  return (
    <div className="rd-card">
      <div className="rd-summary">
        <div>
          <small>Plaintext</small>
          <code>{toHex(trace.plaintext)}</code>
        </div>
        <div>
          <small>Key</small>
          <code>{toHex(trace.key)}</code>
        </div>
        <div>
          <small>Ciphertext</small>
          <code className="rd-strong">{toHex(trace.ciphertext)}</code>
        </div>
      </div>

      <div className="rd-table-wrap">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Operations</th>
              <th>Round key</th>
              <th>Data after the round</th>
            </tr>
          </thead>
          <tbody>
            {trace.rounds.map((r) => (
              <tr key={r.round}>
                <th scope="row">{r.round}</th>
                <td className="rd-ops">{r.steps.map((s) => s.step).join(' → ')}</td>
                <td>
                  <StateMatrix block={r.roundKey} size="sm" tone="key" label={`K${r.round}`} />
                </td>
                <td>
                  <StateMatrix
                    block={r.state}
                    size="sm"
                    tone={r.round === 10 ? 'result' : 'plain'}
                    label={toHex(r.state)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
