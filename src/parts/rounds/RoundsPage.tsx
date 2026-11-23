/**
 * Part 1 – AES rounds (encryption and decryption).
 *  1a. One round step by step, pausing after each transformation.
 *  1b. Full encryption or decryption showing the round key and data after every round.
 *
 * The data can be normal text or hex. Text is encoded as UTF-8, padded with PKCS#7 and cut into
 * 128-bit blocks; each block is encrypted on its own with the same key (src/aes/blocks.ts).
 * Values come from encryptTrace() and decryptTrace() in src/aes/.
 */
import { useState } from 'react'
import { encryptTrace } from '../../aes/cipher'
import type { EncryptionTrace, RoundSnapshot, StepName } from '../../aes/cipher'
import { decryptTrace } from '../../aes/decipher'
import type { DecryptionTrace, DecryptionRoundSnapshot, InverseStepName } from '../../aes/decipher'
import { blocksToText, bytesToText, parseHexBlocks, textToBlocks, textToBytes } from '../../aes/blocks'
import type { Block, Mode } from '../../aes/types'
import { hex2, parseBlock, toHex } from '../../aes/hex'
import { StateMatrix } from '../../components/StateMatrix'
import './RoundsPage.css'

type Format = 'text' | 'hex'

const EXAMPLES: { label: string; key: string; data: string; format: Format }[] = [
  { label: 'FIPS-197 Appendix B', key: '2b7e151628aed2a6abf7158809cf4f3c', data: '3243f6a8885a308d313198a2e0370734', format: 'hex' },
  { label: 'Textbook', key: '0f1571c947d9e8590cb7add6af7f6798', data: '0123456789abcdeffedcba9876543210', format: 'hex' },
  { label: 'FIPS-197 C.1', key: '000102030405060708090a0b0c0d0e0f', data: '00112233445566778899aabbccddeeff', format: 'hex' },
  { label: 'Text message', key: '2b7e151628aed2a6abf7158809cf4f3c', data: 'Meet me after the toga party, bring the key!', format: 'text' },
]

const randomHex = () => toHex(Array.from(crypto.getRandomValues(new Uint8Array(16))))

const blocksOf = (ex: (typeof EXAMPLES)[number]): Block[] =>
  ex.format === 'text' ? textToBlocks(ex.data) : parseHexBlocks(ex.data)!

type Trace = EncryptionTrace | DecryptionTrace
type Round = RoundSnapshot | DecryptionRoundSnapshot
type Operation = StepName | InverseStepName

/** Where the step-by-step view starts: a round and a position inside it (0 = start of the round). */
type StepPos = { round: number; pos: number }
const DEFAULT_START: StepPos = { round: 1, pos: 0 }

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
  const [format, setFormat] = useState<Format>('hex')
  const [plainText, setPlainText] = useState(EXAMPLES[3].data)
  const [hexText, setHexText] = useState(EXAMPLES[0].data)
  const [blockIdx, setBlockIdx] = useState(0)
  const [start, setStart] = useState<StepPos>(DEFAULT_START)
  const [view, setView] = useState<'step' | 'full'>('step')
  const [mode, setMode] = useState<Mode>('encrypt')
  const decrypting = mode === 'decrypt'
  const action = decrypting ? 'decryption' : 'encryption'
  // Decryption always takes hex: ciphertext bytes are not readable text.
  const textInput = !decrypting && format === 'text'

  const key = parseBlock(keyText)
  const blocks = textInput ? textToBlocks(plainText) : parseHexBlocks(hexText)
  const traces = key && blocks ? blocks.map((b) => (decrypting ? decryptTrace(b, key) : encryptTrace(b, key))) : null
  const block = traces ? Math.min(blockIdx, traces.length - 1) : 0
  const trace = traces ? traces[block] : null

  const selectBlock = (i: number, at: StepPos = DEFAULT_START) => {
    setBlockIdx(i)
    setStart(at)
  }

  const changeMode = (next: Mode) => {
    if (next === mode) return
    // Carry the current output into the other mode so switching demonstrates the inverse.
    if (traces) {
      if (decrypting) {
        const text = blocksToText(traces.map((t) => t.plaintext))
        if (text !== null) {
          setFormat('text')
          setPlainText(text)
        } else {
          setFormat('hex')
          setHexText(toHex(traces.flatMap((t) => t.plaintext)))
        }
      } else {
        setHexText(toHex(traces.flatMap((t) => t.ciphertext)))
      }
    }
    setMode(next)
  }

  const loadExample = (ex: (typeof EXAMPLES)[number]) => {
    setKeyText(ex.key)
    selectBlock(0)
    if (decrypting) {
      setHexText(toHex(blocksOf(ex).flatMap((b) => encryptTrace(b, parseBlock(ex.key)!).ciphertext)))
    } else if (ex.format === 'text') {
      setFormat('text')
      setPlainText(ex.data)
    } else {
      setFormat('hex')
      setHexText(ex.data)
    }
  }

  const inputName = decrypting ? 'Ciphertext' : 'Plaintext'
  const textBytes = textInput ? textToBytes(plainText).length : 0

  return (
    <section className="rd">
      <h1 data-eyebrow="Part 1 · Rounds">AES rounds, step by step</h1>
      <p className="rd-lead">
        Enter a 128-bit key and your data, as normal text or hex. AES works on 128-bit blocks, so longer data is
        split into several blocks. Step through a single round one transformation at a time, or run the full{' '}
        {action} and see the key and the data after every round.
      </p>

      <div className="rd-mode" role="group" aria-label="Cipher mode">
        <button type="button" aria-pressed={!decrypting} onClick={() => changeMode('encrypt')}>Encrypt</button>
        <button type="button" aria-pressed={decrypting} onClick={() => changeMode('decrypt')}>Decrypt</button>
      </div>
      <p className="rd-muted rd-mode-help">
        {decrypting
          ? 'Enter ciphertext (one or more 32-hex-digit blocks) and the original encryption key. Decryption uses the same round keys in reverse: K10 → K0.'
          : 'Enter plaintext and a key. Encryption uses round keys K0 → K10.'}
        {' '}Switching modes uses the current result as the new input.
      </p>

      <div className="rd-inputs">
        <HexField id="rd-key" label="Key (128 bits, 32 hex digits)" value={keyText} onChange={setKeyText} valid={!!key} />

        <div className="rd-field">
          <div className="rd-data-head">
            <label htmlFor="rd-data">{inputName}</label>
            {!decrypting && (
              <div className="rd-mode rd-format" role="group" aria-label="Plaintext format">
                <button type="button" aria-pressed={format === 'text'} onClick={() => setFormat('text')}>Text</button>
                <button type="button" aria-pressed={format === 'hex'} onClick={() => setFormat('hex')}>Hex</button>
              </div>
            )}
          </div>
          {textInput ? (
            <>
              <div className="rd-row">
                <textarea
                  id="rd-data"
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  rows={2}
                  spellCheck={false}
                  aria-describedby="rd-data-help"
                  placeholder="Type any message…"
                />
              </div>
              <small id="rd-data-help" className="rd-muted">
                {textBytes} byte{textBytes === 1 ? '' : 's'} of UTF-8 + {blocks!.length * 16 - textBytes} padding byte
                {blocks!.length * 16 - textBytes === 1 ? '' : 's'} = {blocks!.length} block{blocks!.length === 1 ? '' : 's'} of 16 bytes
              </small>
            </>
          ) : (
            <HexField
              id="rd-data"
              label=""
              value={hexText}
              onChange={(v) => setHexText(v)}
              valid={!!blocks}
              blocks
            />
          )}
        </div>

        <div className="rd-examples">
          Examples:
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="rd-chip" onClick={() => loadExample(ex)}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {traces && (traces.length > 1 || textInput) && (
        <BlockList traces={traces} mode={mode} selected={block} onSelect={(i) => selectBlock(i)} padded={textInput} />
      )}

      <div className="rd-tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'step'} onClick={() => setView('step')}>
          One round, step by step
        </button>
        <button type="button" role="tab" aria-selected={view === 'full'} onClick={() => setView('full')}>
          Full {action}
        </button>
      </div>

      {!trace || !traces ? (
        <p className="rd-card rd-muted">Enter a valid key and data to start.</p>
      ) : view === 'step' ? (
        <SingleRound
          key={`${mode}:${block}:${toHex(trace.key)}:${toHex(trace.plaintext)}:${toHex(trace.ciphertext)}`}
          trace={trace}
          mode={mode}
          start={start}
          block={block}
          blockCount={traces.length}
          onBlock={selectBlock}
        />
      ) : (
        <FullRun trace={trace} mode={mode} block={block} blockCount={traces.length} />
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
  blocks = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  valid: boolean
  /** Accept one or more whole blocks instead of exactly one. */
  blocks?: boolean
}) {
  const digits = value.replace(/\s+/g, '')
  const n = digits.length / 32
  return (
    <div className="rd-field">
      {label && <label htmlFor={id}>{label}</label>}
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
          ? blocks
            ? `✓ ${n} block${n === 1 ? '' : 's'} of 16 bytes (32 hex digits each)`
            : '✓ 16 bytes'
          : /[^0-9a-fA-F]/.test(digits)
            ? 'Use only hexadecimal digits 0–9 and a–f.'
            : blocks
              ? `${digits.length} hex digits: use a multiple of 32 (one block = 32 hex digits).`
              : `${digits.length} of 32 hex digits.`}
      </small>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The blocks of the message
// ---------------------------------------------------------------------------

function BlockList({
  traces,
  mode,
  selected,
  onSelect,
  padded,
}: {
  traces: Trace[]
  mode: Mode
  selected: number
  onSelect: (i: number) => void
  padded: boolean
}) {
  const decrypting = mode === 'decrypt'
  const inputs = traces.map((t) => (decrypting ? t.ciphertext : t.plaintext))
  const outputs = traces.map((t) => (decrypting ? t.plaintext : t.ciphertext))
  const padLen = padded ? inputs[inputs.length - 1][15] : 0
  const total = traces.length * 16
  const recovered = decrypting ? blocksToText(outputs) : null

  return (
    <div className="rd-card rd-blocks">
      <h2 className="rd-blocks-title">
        {traces.length} block{traces.length === 1 ? '' : 's'} of 128 bits
      </h2>
      <p className="rd-muted rd-blocks-help">
        {padded && (
          <>
            The text is encoded as UTF-8, then <b>padded</b> (PKCS#7: <i>n</i> bytes of value <i>n</i>) to a multiple of
            16 bytes. Here {padLen} byte{padLen === 1 ? '' : 's'} of <code>{hex2(padLen)}</code> are added.{' '}
          </>
        )}
        Each block is {decrypting ? 'decrypted' : 'encrypted'} on its own with the same key (ECB mode). Pick a block to
        follow it through the rounds.
      </p>
      <ol className="rd-block-list">
        {inputs.map((input, i) => (
          <li key={i}>
            <button type="button" aria-pressed={i === selected} onClick={() => onSelect(i)}>
              <span className="rd-block-num">Block {i + 1}</span>
              <span className="rd-block-io">
                <span className="rd-bytes" aria-label={`Input ${toHex(input)}`}>
                  {input.map((b, k) => (
                    <span key={k} className={i * 16 + k >= total - padLen ? 'rd-pad' : undefined}>
                      {hex2(b)}
                    </span>
                  ))}
                </span>
                {padded && <span className="rd-block-text">“{previewText(input, Math.min(16, Math.max(0, (i + 1) * 16 - (total - padLen))))}”</span>}
                <span className="rd-block-arrow" aria-hidden="true">↓ {decrypting ? 'decrypt' : 'encrypt'}</span>
                <code className="rd-block-out">{toHex(outputs[i])}</code>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="rd-summary rd-blocks-out">
        <div>
          <small>{decrypting ? 'Recovered bytes (all blocks)' : 'Ciphertext (all blocks)'}</small>
          <code className="rd-strong">{toHex(outputs.flat())}</code>
        </div>
        {decrypting && (
          <div>
            <small>Recovered text</small>
            {recovered !== null ? (
              <span className="rd-strong">“{recovered}”</span>
            ) : (
              <span className="rd-muted">Not padded UTF-8 text (it was probably hex data, or the key is wrong).</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** The readable part of a block (without its padding bytes); characters cut across blocks show as �. */
function previewText(block: Block, padBytes: number): string {
  const bytes = block.slice(0, 16 - padBytes)
  return bytesToText(bytes) ?? new TextDecoder().decode(new Uint8Array(bytes))
}

// ---------------------------------------------------------------------------
// 1a. One round, step by step
// ---------------------------------------------------------------------------

function SingleRound({
  trace,
  mode,
  start,
  block,
  blockCount,
  onBlock,
}: {
  trace: Trace
  mode: Mode
  start: StepPos
  block: number
  blockCount: number
  onBlock: (i: number, at: StepPos) => void
}) {
  const [{ round, pos }, setAt] = useState<StepPos>(start)
  const snap = trace.rounds[round]
  const last = snap.steps.length

  // Next/Back walk through the steps, then on to the next round (and the next block).
  const next =
    pos < last
      ? { label: 'Next →', go: () => setAt({ round, pos: pos + 1 }) }
      : round < 10
        ? { label: `Next: round ${round + 1} →`, go: () => setAt({ round: round + 1, pos: 0 }) }
        : block < blockCount - 1
          ? { label: `Next: block ${block + 2} →`, go: () => onBlock(block + 1, { round: 0, pos: 0 }) }
          : null
  const back =
    pos > 0
      ? () => setAt({ round, pos: pos - 1 })
      : round > 0
        ? () => setAt({ round: round - 1, pos: trace.rounds[round - 1].steps.length })
        : block > 0
          ? () => onBlock(block - 1, { round: 10, pos: trace.rounds[10].steps.length })
          : null

  return (
    <div className="rd-card">
      <div className="rd-round-pick">
        <span>{blockCount > 1 && `Block ${block + 1} · `}Round:</span>
        {Array.from({ length: 11 }, (_, i) => i).map((r) => (
          <button key={r} type="button" aria-pressed={r === round} onClick={() => setAt({ round: r, pos: 0 })}>
            {r}
          </button>
        ))}
      </div>
      <Stepper key={round} snap={snap} mode={mode} pos={pos} />
      <div className="rd-nav">
        <button type="button" onClick={() => setAt({ round, pos: 0 })} disabled={pos === 0}>
          Restart round
        </button>
        <button type="button" onClick={() => back?.()} disabled={!back}>
          ← Back
        </button>
        <button type="button" className="rd-primary" onClick={() => next?.go()} disabled={!next}>
          {next?.label ?? 'Done ✓'}
        </button>
      </div>
    </div>
  )
}

function Stepper({ snap, mode, pos }: { snap: Round; mode: Mode; pos: number }) {
  // pos 0 = start of the round; pos k = after the k-th step.
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
            <li key={name} className={cls} data-op={name}>
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
                Step {pos} of {last}:{' '}
              </b>
              <span className="op-tag" data-op={current.step}>
                {current.step}
              </span>{' '}
              {EXPLAIN[current.step]}
            </p>
            <div className="rd-flow" key={pos} data-op={current.step}>
              <StateMatrix block={before} label="Before" />
              {current.step === 'AddRoundKey' ? (
                <>
                  <span className="rd-op" data-op="AddRoundKey">⊕</span>
                  <StateMatrix block={snap.roundKey} label={`Round key K${keyIndex}`} tone="key" />
                </>
              ) : (
                <span className="rd-op rd-op-name" data-op={current.step}>
                  <span>{current.step}</span>
                  <span className="rd-arrow" aria-hidden="true" />
                </span>
              )}
              {current.step === 'AddRoundKey' && <span className="rd-op" data-op="AddRoundKey">=</span>}
              <StateMatrix
                block={current.state}
                label="After"
                className={`rd-after rd-after-${current.step}`}
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

    </>
  )
}

// ---------------------------------------------------------------------------
// 1b. Full encryption or decryption: key and data after each round
// ---------------------------------------------------------------------------

function FullRun({ trace, mode, block, blockCount }: { trace: Trace; mode: Mode; block: number; blockCount: number }) {
  const decrypting = mode === 'decrypt'
  return (
    <div className="rd-card">
      {blockCount > 1 && <p className="rd-explain">Showing <b>block {block + 1} of {blockCount}</b>. Pick another block above.</p>}
      <div className="rd-summary">
        <div>
          <small>{decrypting ? 'Ciphertext input' : 'Plaintext input'}{blockCount > 1 && ` · block ${block + 1}`}</small>
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
                <td className="rd-ops">
                  {r.steps.map((s) => (
                    <span key={s.step} className="op-tag" data-op={s.step}>
                      {s.step}
                    </span>
                  ))}
                </td>
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
