/**
 * Part 1 – AES rounds (encryption and decryption).
 *  1a. One round step by step, pausing after each transformation.
 *  1b. Full encryption or decryption showing the round key and data after every round.
 *
 * Values come from encryptTrace() and decryptTrace() in src/aes/.
 */
import { useState } from 'react'
import { encryptTrace } from '../../aes/cipher'
import type { EncryptionTrace, RoundSnapshot, StepName } from '../../aes/cipher'
import { decryptTrace } from '../../aes/decipher'
import type { DecryptionTrace, DecryptionRoundSnapshot, InverseStepName } from '../../aes/decipher'
import type { Mode } from '../../aes/types'
import { parseBlock, toHex } from '../../aes/hex'
import { StateMatrix } from '../../components/StateMatrix'
import './RoundsPage.css'

const EXAMPLES = [
  { label: 'FIPS-197 Appendix B', key: '2b7e151628aed2a6abf7158809cf4f3c', data: '3243f6a8885a308d313198a2e0370734' },
  { label: 'Textbook', key: '0f1571c947d9e8590cb7add6af7f6798', data: '0123456789abcdeffedcba9876543210' },
  { label: 'FIPS-197 C.1', key: '000102030405060708090a0b0c0d0e0f', data: '00112233445566778899aabbccddeeff' },
]

const randomHex = () => toHex(Array.from(crypto.getRandomValues(new Uint8Array(16))))

type Trace = EncryptionTrace | DecryptionTrace
type Round = RoundSnapshot | DecryptionRoundSnapshot
type Operation = StepName | InverseStepName

const EXPLAIN: Record<Operation, string> = {
  SubBytes: 'Each byte is replaced by its S-box entry (non-linear substitution).',
  ShiftRows: 'Row 0 stays; rows 1, 2 and 3 are rotated left by 1, 2 and 3 bytes.',
  MixColumns: 'Each column is multiplied by the fixed matrix [02 03 01 01] in GF(2⁸), mixing its 4 bytes.',
  AddRoundKey: 'The state is XORed byte by byte with the round key.',
  InvShiftRows: 'Row 0 stays; rows 1, 2 and 3 are rotated right by 1, 2 and 3 bytes, undoing ShiftRows.',
  InvSubBytes: 'Each byte is replaced by its inverse S-box entry, undoing SubBytes.',
  InvMixColumns: 'Each column is multiplied by the inverse matrix with first row [0e 0b 0d 09] in GF(2⁸), undoing MixColumns.',
}

/** Bytes that ShiftRows moves (rows 1–3), to highlight them. */
const SHIFTED = Array.from({ length: 16 }, (_, i) => i).filter((i) => i % 4 !== 0)

export function RoundsPage() {
  const [keyText, setKeyText] = useState(EXAMPLES[0].key)
  const [dataText, setDataText] = useState(EXAMPLES[0].data)
  const [view, setView] = useState<'step' | 'full'>('step')
  const [mode, setMode] = useState<Mode>('encrypt')
  const decrypting = mode === 'decrypt'
  const action = decrypting ? 'decryption' : 'encryption'

  const key = parseBlock(keyText)
  const data = parseBlock(dataText)
  const trace = key && data ? (decrypting ? decryptTrace(data, key) : encryptTrace(data, key)) : null

  const changeMode = (next: Mode) => {
    if (next === mode) return
    // Carry the current output into the other mode so switching demonstrates the inverse.
    if (trace) setDataText(toHex(decrypting ? trace.plaintext : trace.ciphertext))
    setMode(next)
  }

  return (
    <section className="rd">
      <h1>Part 1 · AES rounds</h1>
      <p className="rd-lead">
        Enter a 128-bit key and one 128-bit data block. Step through a single round one transformation at a time,
        or run the full {action} and see the key and the data after every round.
      </p>

      <div className="rd-mode" role="group" aria-label="Cipher mode">
        <button type="button" aria-pressed={!decrypting} onClick={() => changeMode('encrypt')}>Encrypt</button>
        <button type="button" aria-pressed={decrypting} onClick={() => changeMode('decrypt')}>Decrypt</button>
      </div>
      <p className="rd-muted rd-mode-help">
        {decrypting
          ? 'Enter ciphertext and the original encryption key. Decryption uses the same round keys in reverse: K10 → K0.'
          : 'Enter plaintext and a key. Encryption uses round keys K0 → K10.'}
        {' '}Switching modes uses the current result as the new input.
      </p>

      <div className="rd-inputs">
        <HexField id="rd-key" label="Key (128 bits, 32 hex digits)" value={keyText} onChange={setKeyText} valid={!!key} />
        <HexField id="rd-data" label={`${decrypting ? 'Ciphertext' : 'Plaintext'} (128 bits, 32 hex digits)`} value={dataText} onChange={setDataText} valid={!!data} />
        <div className="rd-examples">
          Examples:
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="rd-chip"
              onClick={() => {
                setKeyText(ex.key)
                setDataText(decrypting ? toHex(encryptTrace(parseBlock(ex.data)!, parseBlock(ex.key)!).ciphertext) : ex.data)
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
          Full {action}
        </button>
      </div>

      {!trace ? (
        <p className="rd-card rd-muted">Enter a valid key and data block to start.</p>
      ) : view === 'step' ? (
        <SingleRound key={mode} trace={trace} mode={mode} />
      ) : (
        <FullRun trace={trace} mode={mode} />
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

function SingleRound({ trace, mode }: { trace: Trace; mode: Mode }) {
  const [round, setRound] = useState(1)
  return (
    <div className="rd-card">
      <div className="rd-round-pick">
        <span>Round:</span>
        {Array.from({ length: 11 }, (_, i) => i).map((r) => (
          <button key={r} type="button" aria-pressed={r === round} onClick={() => setRound(r)}>
            {r}
          </button>
        ))}
      </div>
      {/* key= restarts the stepper whenever the round or the inputs change */}
      <Stepper key={`${round}:${toHex(trace.key)}:${toHex(trace.plaintext)}:${toHex(trace.ciphertext)}`} snap={trace.rounds[round]} mode={mode} />
    </div>
  )
}

function Stepper({ snap, mode }: { snap: Round; mode: Mode }) {
  // pos 0 = start of the round; pos k = after the k-th step.
  const [pos, setPos] = useState(0)
  const steps = snap.steps
  const last = steps.length
  const current = pos > 0 ? steps[pos - 1] : null
  const before = pos > 1 ? steps[pos - 2].state : snap.input
  const isFinal = snap.round === 10
  const decrypting = mode === 'decrypt'
  const keyIndex = decrypting ? 10 - snap.round : snap.round
  const operationOrder: Operation[] = snap.round === 0
    ? ['AddRoundKey']
    : decrypting
      ? ['InvShiftRows', 'InvSubBytes', 'AddRoundKey', 'InvMixColumns']
      : ['SubBytes', 'ShiftRows', 'MixColumns', 'AddRoundKey']

  return (
    <>
      <ol className="rd-steps">
        <li className={pos === 0 ? 'now' : 'done'}>Start</li>
        {operationOrder.map((name) => {
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
              {snap.round === 0
                ? ` (${decrypting ? 'ciphertext' : 'plaintext'} before the initial AddRoundKey with K${keyIndex})`
                : snap.round === 1
                  ? ` (after the initial AddRoundKey with K${decrypting ? 10 : 0})`
                  : ` (output of round ${snap.round - 1})`}.
              {' '}This round uses K{keyIndex}.
              {isFinal && ` Round 10 is the final round: it has no ${decrypting ? 'InvMixColumns' : 'MixColumns'}.`} Press <b>Next</b> to apply the first step.
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
                  <StateMatrix block={snap.roundKey} label={`Round key K${keyIndex}`} tone="key" />
                </>
              ) : (
                <span className="rd-op">→ {current.step} →</span>
              )}
              {current.step === 'AddRoundKey' && <span className="rd-op">=</span>}
              <StateMatrix
                block={current.state}
                label="After"
                tone={pos === last ? 'result' : 'plain'}
                highlight={current.step === 'ShiftRows' || current.step === 'InvShiftRows' ? SHIFTED : undefined}
              />
            </div>
            {pos === last && (
              <p className="rd-explain">
                Round {snap.round} is complete. Output: <code>{toHex(current.state)}</code>
                {isFinal && ` — this is the ${decrypting ? 'recovered plaintext' : 'ciphertext'}.`}
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
// 1b. Full encryption or decryption: key and data after each round
// ---------------------------------------------------------------------------

function FullRun({ trace, mode }: { trace: Trace; mode: Mode }) {
  const decrypting = mode === 'decrypt'
  return (
    <div className="rd-card">
      <div className="rd-summary">
        <div>
          <small>{decrypting ? 'Ciphertext input' : 'Plaintext input'}</small>
          <code>{toHex(decrypting ? trace.ciphertext : trace.plaintext)}</code>
        </div>
        <div>
          <small>Key</small>
          <code>{toHex(trace.key)}</code>
        </div>
        <div>
          <small>{decrypting ? 'Recovered plaintext' : 'Ciphertext'}</small>
          <code className="rd-strong">{toHex(decrypting ? trace.plaintext : trace.ciphertext)}</code>
        </div>
      </div>

      <div className="rd-table-wrap">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Round (execution order)</th>
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
                  <StateMatrix block={r.roundKey} size="sm" tone="key" label={`K${decrypting ? 10 - r.round : r.round}`} />
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
