/**
 * Part 1 – AES rounds (encryption and decryption).
 *  1a. One round step by step, pausing after each transformation.
 *  1b. Full encryption or decryption showing the round key and data after every round.
 *
 * The data can be normal text or hex. Text is encoded as UTF-8, padded with PKCS#7 and cut into
 * 128-bit blocks (src/aes/blocks.ts). The blocks are chained with ECB or CBC (src/aes/modes.ts).
 * Values come from encryptTrace() and decryptTrace() in src/aes/.
 */
import { useEffect, useRef, useState } from 'react'
import type { EncryptionTrace, RoundSnapshot, StepName } from '../../aes/cipher'
import type { DecryptionTrace, DecryptionRoundSnapshot, InverseStepName } from '../../aes/decipher'
import { repeats, runBlocks } from '../../aes/modes'
import type { BlockRun, ChainMode } from '../../aes/modes'
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
  { label: 'Repeated text', key: '2b7e151628aed2a6abf7158809cf4f3c', data: 'ATTACK AT DAWN!!ATTACK AT DAWN!!ATTACK AT DAWN!!', format: 'text' },
  {
    label: 'NIST SP 800-38A',
    key: '2b7e151628aed2a6abf7158809cf4f3c',
    data: '6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51 30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710',
    format: 'hex',
  },
]

/** The IV of the NIST SP 800-38A CBC example. */
const DEFAULT_IV = '000102030405060708090a0b0c0d0e0f'

/** Play speeds, in milliseconds per step. */
const SPEEDS = [
  { label: 'Slow', ms: 2200 },
  { label: 'Normal', ms: 1300 },
  { label: 'Fast', ms: 600 },
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
  const [chain, setChain] = useState<ChainMode>('ECB')
  const [ivText, setIvText] = useState(DEFAULT_IV)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(SPEEDS[1].ms)
  const decrypting = mode === 'decrypt'
  const action = decrypting ? 'decryption' : 'encryption'
  // Decryption always takes hex: ciphertext bytes are not readable text.
  const textInput = !decrypting && format === 'text'

  const key = parseBlock(keyText)
  const blocks = textInput ? textToBlocks(plainText) : parseHexBlocks(hexText)
  const iv = parseBlock(ivText)
  const cbc = chain === 'CBC'
  const runs = key && blocks && (!cbc || iv) ? runBlocks(blocks, key, mode, chain, iv ?? blocks[0]) : null
  const block = runs ? Math.min(blockIdx, runs.length - 1) : 0
  const run = runs ? runs[block] : null
  const trace = run ? run.trace : null

  const selectBlock = (i: number, at: StepPos = DEFAULT_START) => {
    setBlockIdx(i)
    setStart(at)
  }

  const changeMode = (next: Mode) => {
    if (next === mode) return
    // Carry the current output into the other mode so switching demonstrates the inverse.
    if (runs) {
      const outputs = runs.map((r) => r.output)
      const text = decrypting ? blocksToText(outputs) : null
      if (text !== null) {
        setFormat('text')
        setPlainText(text)
      } else {
        if (decrypting) setFormat('hex')
        setHexText(toHex(outputs.flat()))
      }
    }
    setPlaying(false)
    setMode(next)
  }

  const loadExample = (ex: (typeof EXAMPLES)[number]) => {
    setKeyText(ex.key)
    selectBlock(0)
    setPlaying(false)
    if (decrypting) {
      const exIv = iv ?? parseBlock(DEFAULT_IV)!
      setHexText(toHex(runBlocks(blocksOf(ex), parseBlock(ex.key)!, 'encrypt', chain, exIv).flatMap((r) => r.output)))
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

        <div className="rd-field rd-chain">
          <div className="rd-data-head">
            <span className="rd-label">Mode of operation</span>
            <div className="rd-mode rd-format" role="group" aria-label="Mode of operation">
              <button type="button" aria-pressed={!cbc} onClick={() => setChain('ECB')}>ECB</button>
              <button type="button" aria-pressed={cbc} onClick={() => setChain('CBC')}>CBC</button>
            </div>
          </div>
          <small className="rd-muted">
            {cbc ? (
              <>
                <b>CBC</b>: each plaintext block is XORed with the previous ciphertext block (the IV for block 1)
                before AES. C<sub>i</sub> = E(K, P<sub>i</sub> ⊕ C<sub>i−1</sub>), C<sub>0</sub> = IV. Decrypting
                uses the same key and the same IV.
              </>
            ) : (
              <>
                <b>ECB</b>: every block is encrypted on its own with the same key, C<sub>i</sub> = E(K, P<sub>i</sub>).
                Try “Repeated text” to see its weakness, then switch to CBC.
              </>
            )}
          </small>
          {cbc && (
            <HexField id="rd-iv" label="IV, initialization vector (128 bits, 32 hex digits)" value={ivText} onChange={setIvText} valid={!!iv} />
          )}
        </div>
      </div>

      {runs && (runs.length > 1 || textInput || cbc) && (
        <BlockList runs={runs} mode={mode} chain={chain} selected={block} onSelect={(i) => selectBlock(i)} padded={textInput} />
      )}

      <div className="rd-tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'step'} onClick={() => setView('step')}>
          One round, step by step
        </button>
        <button type="button" role="tab" aria-selected={view === 'full'} onClick={() => setView('full')}>
          Full {action}
        </button>
      </div>

      {run && cbc && <CbcNote run={run} block={block} mode={mode} />}

      {!trace || !runs ? (
        <p className="rd-card rd-muted">Enter a valid key, data{cbc ? ' and IV' : ''} to start.</p>
      ) : view === 'step' ? (
        <SingleRound
          key={`${mode}:${block}:${toHex(trace.key)}:${toHex(trace.plaintext)}:${toHex(trace.ciphertext)}`}
          trace={trace}
          mode={mode}
          start={start}
          block={block}
          blockCount={runs.length}
          onBlock={selectBlock}
          finalName={decrypting ? (cbc ? 'AES output, still to be XORed with the previous ciphertext block' : 'recovered plaintext') : 'ciphertext'}
          playing={playing}
          setPlaying={setPlaying}
          speed={speed}
          setSpeed={setSpeed}
        />
      ) : (
        <FullRun trace={trace} mode={mode} block={block} blockCount={runs.length} />
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
  runs,
  mode,
  chain,
  selected,
  onSelect,
  padded,
}: {
  runs: BlockRun[]
  mode: Mode
  chain: ChainMode
  selected: number
  onSelect: (i: number) => void
  padded: boolean
}) {
  const decrypting = mode === 'decrypt'
  const cbc = chain === 'CBC'
  const inputs = runs.map((r) => r.input)
  const outputs = runs.map((r) => r.output)
  const padLen = padded ? inputs[inputs.length - 1][15] : 0
  const total = runs.length * 16
  const recovered = decrypting ? blocksToText(outputs) : null
  const inRep = repeats(inputs)
  const outRep = repeats(outputs)
  const plainRep = decrypting ? outRep : inRep
  const cipherRep = decrypting ? inRep : outRep
  const plainRepeats = plainRep.some((r) => r >= 0)
  const cipherRepeats = cipherRep.some((r) => r >= 0)
  const prevName = (i: number) => (i === 0 ? 'IV' : `C${i}`)

  return (
    <div className="rd-card rd-blocks">
      <h2 className="rd-blocks-title">
        {runs.length} block{runs.length === 1 ? '' : 's'} of 128 bits · {chain}
      </h2>
      <p className="rd-muted rd-blocks-help">
        {padded && (
          <>
            The text is encoded as UTF-8, then <b>padded</b> (PKCS#7: <i>n</i> bytes of value <i>n</i>) to a multiple of
            16 bytes. Here {padLen} byte{padLen === 1 ? '' : 's'} of <code>{hex2(padLen)}</code> are added.{' '}
          </>
        )}
        {cbc
          ? `In CBC each block is chained to the previous ciphertext block (block 1 to the IV), so the blocks depend on each other.`
          : `In ECB each block is ${decrypting ? 'decrypted' : 'encrypted'} on its own with the same key.`}{' '}
        Pick a block to follow it through the rounds.
      </p>
      {(plainRepeats || cipherRepeats) && (
        <p className={`rd-lesson ${cipherRepeats ? 'rd-lesson-bad' : 'rd-lesson-good'}`} role="status">
          {cipherRepeats && plainRepeats
            ? '⚠ The plaintext repeats, and ECB gives the repeated blocks the same ciphertext too. Someone who sees only the ciphertext can tell which blocks are equal. Switch to CBC to hide it.'
            : cipherRepeats
              ? '⚠ Some ciphertext blocks are equal, so their plaintext blocks are equal too.'
              : '✓ The plaintext repeats, but CBC chains every block to the previous ciphertext, so all the ciphertext blocks are different.'}
        </p>
      )}
      <ol className="rd-block-list">
        {runs.map((r, i) => (
          <li key={i}>
            <button type="button" aria-pressed={i === selected} onClick={() => onSelect(i)}>
              <span className="rd-block-num">
                Block {i + 1}
                {inRep[i] >= 0 && <span className="rd-rep" data-g={inRep[i] % 4}>input = block {inRep[i] + 1}</span>}
              </span>
              <span className="rd-block-io">
                <span className="rd-bytes" aria-label={`Input ${toHex(r.input)}`} data-g={inRep[i] >= 0 ? inRep[i] % 4 : inRep.includes(i) ? i % 4 : undefined}>
                  {r.input.map((b, k) => (
                    <span key={k} className={i * 16 + k >= total - padLen ? 'rd-pad' : undefined}>
                      {hex2(b)}
                    </span>
                  ))}
                </span>
                {padded && <span className="rd-block-text">“{previewText(r.input, Math.min(16, Math.max(0, (i + 1) * 16 - (total - padLen))))}”</span>}
                {r.chain && !decrypting && (
                  <span className="rd-block-xor">
                    ⊕ {prevName(i)} <code>{toHex(r.chain)}</code>
                    <br />= AES input <code>{toHex(r.aesIn)}</code>
                  </span>
                )}
                <span className="rd-block-arrow" aria-hidden="true">↓ AES {decrypting ? 'decrypt' : 'encrypt'}</span>
                {r.chain && decrypting && (
                  <span className="rd-block-xor">
                    AES output <code>{toHex(r.aesOut)}</code>
                    <br />⊕ {prevName(i)} <code>{toHex(r.chain)}</code> =
                  </span>
                )}
                <code className="rd-block-out" data-g={outRep[i] >= 0 ? outRep[i] % 4 : outRep.includes(i) ? i % 4 : undefined}>
                  {toHex(r.output)}
                </code>
                {outRep[i] >= 0 && <span className="rd-rep" data-g={outRep[i] % 4}>output = block {outRep[i] + 1}</span>}
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
              <span className="rd-muted">Not padded UTF-8 text (it was hex data, or the key, IV or mode is wrong).</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** What CBC adds around AES for the selected block. */
function CbcNote({ run, block, mode }: { run: BlockRun; block: number; mode: Mode }) {
  const prev = block === 0 ? 'IV' : `C${block}`
  return (
    <p className="rd-cbc-note">
      <b>CBC, block {block + 1}:</b>{' '}
      {mode === 'encrypt' ? (
        <>
          AES encrypts P{block + 1} ⊕ {prev} = <code>{toHex(run.aesIn)}</code>, not the plaintext block itself. The
          rounds below start from that block.
        </>
      ) : (
        <>
          AES decrypts C{block + 1} to <code>{toHex(run.aesOut)}</code>; XORing it with {prev} gives P{block + 1} ={' '}
          <code>{toHex(run.output)}</code>.
        </>
      )}
    </p>
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
  finalName,
  playing,
  setPlaying,
  speed,
  setSpeed,
}: {
  trace: Trace
  mode: Mode
  start: StepPos
  block: number
  blockCount: number
  onBlock: (i: number, at: StepPos) => void
  /** What the state after round 10 is, e.g. "ciphertext". */
  finalName: string
  playing: boolean
  setPlaying: (p: boolean) => void
  speed: number
  setSpeed: (ms: number) => void
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

  // Play: press Next automatically, one step every `speed` ms, until the last block is done.
  const nextRef = useRef(next)
  useEffect(() => {
    nextRef.current = next
  })
  const hasNext = !!next
  useEffect(() => {
    if (!playing) return
    if (!hasNext) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => nextRef.current?.go(), speed)
    return () => window.clearTimeout(id)
  }, [playing, speed, hasNext, round, pos, setPlaying])

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
      <Stepper key={round} snap={snap} mode={mode} pos={pos} finalName={finalName} />
      <div className="rd-nav">
        <button
          type="button"
          className={`rd-play${playing ? ' on' : ''}`}
          onClick={() => setPlaying(!playing)}
          disabled={!playing && !next}
          aria-pressed={playing}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <label className="rd-speed">
          <span>Speed</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((sp) => (
              <option key={sp.ms} value={sp.ms}>
                {sp.label}
              </option>
            ))}
          </select>
        </label>
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

function Stepper({ snap, mode, pos, finalName }: { snap: Round; mode: Mode; pos: number; finalName: string }) {
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
                {isFinal && ` — this is the ${finalName}.`}
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
