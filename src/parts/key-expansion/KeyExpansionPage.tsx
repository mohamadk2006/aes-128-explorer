import { useState } from 'react'
import type { ReactNode } from 'react'
import { RC, SBOX, expandKey } from '../../aes/keyExpansion'
import type { KeySchedule, WordStep } from '../../aes/keyExpansion'
import { flipBit } from '../../aes/avalanche'
import { hex2, parseBlock, toHex } from '../../aes/hex'
import type { Block, Word } from '../../aes/types'
import { StateMatrix } from '../../components/StateMatrix'
import { compareSchedules } from './diffusion'
import type { ScheduleDiff } from './diffusion'
import './KeyExpansionPage.css'

const EXAMPLES = [
  { label: 'FIPS-197 A.1', key: '2b7e151628aed2a6abf7158809cf4f3c' },
  { label: 'Textbook (Table 6.3)', key: '0f1571c947d9e8590cb7add6af7f6798' },
  { label: 'FIPS-197 C.1', key: '000102030405060708090a0b0c0d0e0f' },
  { label: 'All zeros', key: '00000000000000000000000000000000' },
]

const randomKey = () => toHex(Array.from(crypto.getRandomValues(new Uint8Array(16))))

type View = 'words' | 'matrices'

/** Diffusion comparison: the flipped key, its schedule and the differences. */
interface Diffusion {
  bit: number
  key: Block
  schedule: KeySchedule
  diff: ScheduleDiff
}

/**
 * Part 3 – Key expansion: the 44 words w0 … w43, shown in groups of 4 (round keys K0 … K10),
 * with the derivation of any selected word, the S-box lookups inside SubWord, a 4×4 matrix view of
 * the round keys, and the effect of flipping one key bit.
 */
export function KeyExpansionPage() {
  const [keyText, setKeyText] = useState(EXAMPLES[0].key)
  const [selected, setSelected] = useState(4)
  const [view, setView] = useState<View>('words')
  const [diffOn, setDiffOn] = useState(false)
  const [bit, setBit] = useState(0)

  const key = parseBlock(keyText)
  const schedule = key ? expandKey(key) : null
  const digits = keyText.replace(/\s+/g, '')

  let diffusion: Diffusion | null = null
  if (key && schedule && diffOn) {
    const flipped = flipBit(key, bit)
    const other = expandKey(flipped)
    diffusion = { bit, key: flipped, schedule: other, diff: compareSchedules(schedule, other) }
  }

  return (
    <section className="kx">
      <h1>Part 3 · Key expansion</h1>
      <p className="kx-lead">
        AES-128 turns one 128-bit key into 44 words of 32 bits. Every group of 4 words is one round key: K0 is the
        key itself and K1 … K10 are used by the 10 rounds. Select a word to see how it was computed.
      </p>

      <div className="kx-input">
        <label htmlFor="kx-key">Key (128 bits, 32 hex digits)</label>
        <div className="kx-row">
          <input
            id="kx-key"
            value={keyText}
            onChange={(e) => setKeyText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!key}
            aria-describedby="kx-key-help"
          />
          <button type="button" onClick={() => setKeyText(randomKey())}>
            Random
          </button>
        </div>
        <small id="kx-key-help" className={key ? 'kx-ok' : 'kx-error'} role={key ? undefined : 'alert'}>
          {key
            ? '✓ 16 bytes'
            : /[^0-9a-fA-F]/.test(digits)
              ? 'Use only hexadecimal digits 0–9 and a–f.'
              : `${digits.length} of 32 hex digits.`}
        </small>
        <div className="kx-examples">
          Examples:
          {EXAMPLES.map((ex) => (
            <button key={ex.key} type="button" className="kx-chip" onClick={() => setKeyText(ex.key)}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {key && schedule && (
        <>
          <DiffusionPanel
            keyBlock={key}
            on={diffOn}
            onToggle={setDiffOn}
            bit={bit}
            onBit={setBit}
            diffusion={diffusion}
          />
          <div className="kx-layout">
            <div className="kx-card">
              <div className="kx-card-head">
                <h2>The 44 words, 4 per round key</h2>
                <div className="kx-seg" role="group" aria-label="Show round keys as">
                  <button type="button" aria-pressed={view === 'words'} onClick={() => setView('words')}>
                    Words
                  </button>
                  <button type="button" aria-pressed={view === 'matrices'} onClick={() => setView('matrices')}>
                    4×4 matrices
                  </button>
                </div>
              </div>
              {view === 'words' ? (
                <ScheduleTable schedule={schedule} selected={selected} onSelect={setSelected} diff={diffusion?.diff} />
              ) : (
                <MatrixView schedule={schedule} selected={selected} onSelect={setSelected} diff={diffusion?.diff} />
              )}
            </div>
            <Derivation step={schedule.steps[selected]} onSelect={setSelected} diffusion={diffusion} />
          </div>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Key-bit diffusion
// ---------------------------------------------------------------------------

function DiffusionPanel({
  keyBlock,
  on,
  onToggle,
  bit,
  onBit,
  diffusion,
}: {
  keyBlock: Block
  on: boolean
  onToggle: (on: boolean) => void
  bit: number
  onBit: (bit: number) => void
  diffusion: Diffusion | null
}) {
  return (
    <div className={`kx-card kx-diffusion ${on ? 'on' : ''}`}>
      <label className="kx-switch">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <b>What if one key bit changes?</b>
          <small>
            Flip one bit of the key and see which words of the schedule change. A good key schedule spreads every key
            bit into many round-key bits.
          </small>
        </span>
      </label>

      {on && diffusion && (
        <>
          <p className="kx-muted kx-pick-help">
            Click a bit to flip it (bit 0 is the leftmost bit of the key). Flipped: <b>bit {bit}</b>, in byte{' '}
            {bit >> 3}.
          </p>
          <div className="kx-bitpick" role="group" aria-label="Key bit to flip">
            {keyBlock.map((byte, b) => (
              <div key={b} className="kx-bitbyte">
                <code>{hex2(byte)}</code>
                <div>
                  {Array.from({ length: 8 }, (_, k) => {
                    const i = 8 * b + k
                    const value = (byte >> (7 - k)) & 1
                    return (
                      <button
                        key={k}
                        type="button"
                        className={i === bit ? 'flipped' : undefined}
                        aria-pressed={i === bit}
                        aria-label={`Flip bit ${i} (currently ${value})`}
                        title={`bit ${i}`}
                        onClick={() => onBit(i)}
                      >
                        {i === bit ? 1 - value : value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="kx-chip"
              onClick={() => onBit(crypto.getRandomValues(new Uint8Array(1))[0] & 127)}
            >
              Random bit
            </button>
          </div>

          <div className="kx-spread" aria-label="Bits that differ in each round key">
            {diffusion.diff.roundBits.map((n, r) => (
              <div key={r} className="kx-spread-col" title={`K${r}: ${n} of 128 bits differ`}>
                <span className="kx-spread-n">{n}</span>
                <div className="kx-spread-bar">
                  <span style={{ height: `${(n / 128) * 100}%` }} />
                </div>
                <small>K{r}</small>
              </div>
            ))}
          </div>
          <p className="kx-muted kx-note">
            Bits of each round key that differ from the original schedule (out of 128). K0 is the key itself, so it
            differs in exactly 1 bit; RotWord, SubWord and the XOR chain spread the change, and by K10 about half of
            the bits are different. Changed words are marked in red below.
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Words view
// ---------------------------------------------------------------------------

function ScheduleTable({
  schedule,
  selected,
  onSelect,
  diff,
}: {
  schedule: KeySchedule
  selected: number
  onSelect: (i: number) => void
  diff?: ScheduleDiff
}) {
  const deps = selected >= 4 ? [selected - 1, selected - 4] : []
  return (
    <>
      <div className="kx-table" role="grid" aria-label="Key schedule">
        {schedule.roundKeys.map((_, r) => (
          <div className="kx-rk" role="row" key={r}>
            <div className="kx-rk-label" role="rowheader">
              <b>K{r}</b>
              <small>{r === 0 ? 'the key' : `round ${r}`}</small>
              {diff && <small className="kx-delta">Δ {diff.roundBits[r]} bits</small>}
            </div>
            {[0, 1, 2, 3].map((j) => {
              const i = 4 * r + j
              const changed = diff ? diff.wordBits[i] : 0
              const cls = [
                'kx-word',
                i === selected ? 'active' : '',
                deps.includes(i) ? 'dep' : '',
                i >= 4 && i % 4 === 0 ? 'g' : '',
                changed ? 'changed' : '',
              ].join(' ')
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  className={cls}
                  aria-pressed={i === selected}
                  aria-label={`w${i} ${toHex(schedule.words[i])}${changed ? `, ${changed} bits differ` : ''}`}
                  onClick={() => onSelect(i)}
                >
                  <small>
                    w{i}
                    {changed > 0 && <span className="kx-badge">Δ{changed}</span>}
                  </small>
                  <code>{toHex(schedule.words[i])}</code>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="kx-note">
        <span className="kx-dot" /> Words w4, w8, … w40 start a new round key and go through the extra function g
        (RotWord → SubWord → ⊕ Rcon). <span className="kx-swatch" /> marks the two words the selected word is built
        from.
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// 4×4 matrix view
// ---------------------------------------------------------------------------

function MatrixView({
  schedule,
  selected,
  onSelect,
  diff,
}: {
  schedule: KeySchedule
  selected: number
  onSelect: (i: number) => void
  diff?: ScheduleDiff
}) {
  const selRound = Math.floor(selected / 4)
  const col = selected % 4
  const colBytes = [0, 1, 2, 3].map((row) => 4 * col + row)
  return (
    <>
      <div className="kx-matrices">
        {schedule.roundKeys.map((rk, r) => (
          <button
            key={r}
            type="button"
            className={`kx-matrix ${r === selRound ? 'active' : ''}`}
            aria-pressed={r === selRound}
            aria-label={`Round key K${r}`}
            onClick={() => onSelect(r === selRound ? selected : 4 * r + col)}
          >
            <StateMatrix
              block={rk}
              size="sm"
              tone="key"
              label={diff ? `K${r} · Δ ${diff.roundBits[r]}` : `K${r}`}
              highlight={diff ? diff.roundBytes[r] : r === selRound ? colBytes : undefined}
            />
          </button>
        ))}
      </div>
      <p className="kx-note">
        Each round key is used as a 4×4 matrix in AddRoundKey, exactly like the state on the Rounds page: word w4r+j is
        column j of Kr. {diff
          ? 'Outlined bytes differ from the original schedule.'
          : `The outlined column is the selected word w${selected}.`}
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// Derivation of the selected word
// ---------------------------------------------------------------------------

function Bytes({ w }: { w: Word }) {
  return (
    <span className="kx-bytes">
      {w.map((b, i) => (
        <span key={i}>{hex2(b)}</span>
      ))}
    </span>
  )
}

function Line({ op, label, w, note, result }: { op?: string; label: ReactNode; w: Word; note: ReactNode; result?: boolean }) {
  return (
    <div className={`kx-line ${result ? 'result' : ''}`}>
      <span className="kx-op">{op}</span>
      <span className="kx-label">{label}</span>
      <Bytes w={w} />
      <span className="kx-what">{note}</span>
    </div>
  )
}

function Derivation({
  step,
  onSelect,
  diffusion,
}: {
  step: WordStep
  onSelect: (i: number) => void
  diffusion: Diffusion | null
}) {
  const i = step.index
  const changedBits = diffusion?.diff.wordBits[i] ?? 0
  return (
    <div className="kx-card kx-derive" aria-live="polite">
      <small className="kx-eyebrow">Selected word · round key K{step.round}</small>
      <h2>How w{i} is computed</h2>

      <div className="kx-lines" key={i}>
        {!step.temp ? (
          <>
            <p>
              w0 … w3 are the key itself: w{i} is bytes {4 * i}–{4 * i + 3} of the key.
            </p>
            <Line label={`w${i}`} w={step.word} note="copied from the key" result />
          </>
        ) : step.g ? (
          <>
            <p>
              {i} is a multiple of 4, so w{i - 1} first goes through g, and the result is XORed with w{i - 4}.
            </p>
            <Line label={`temp = w${i - 1}`} w={step.temp} note="previous word" />
            <Line label="RotWord" w={step.g.rotWord} note="rotate left by one byte" />
            <Line label="SubWord" w={step.g.subWord} note="S-box on each byte (see below)" />
            <Line op="⊕" label={`Rcon[${i / 4}]`} w={step.g.rcon} note={`RC[${i / 4}] = ${hex2(RC[i / 4])}`} />
            <Line op="=" label="g(temp)" w={step.g.result} note="SubWord ⊕ Rcon" />
            <Line op="⊕" label={`w${i - 4}`} w={step.wPrev4!} note="word four positions back" />
            <Line op="=" label={`w${i}`} w={step.word} note="" result />
          </>
        ) : (
          <>
            <p>
              {i} is not a multiple of 4, so w{i} is simply w{i - 1} XOR w{i - 4}.
            </p>
            <Line label={`w${i - 1}`} w={step.temp} note="previous word" />
            <Line op="⊕" label={`w${i - 4}`} w={step.wPrev4!} note="word four positions back" />
            <Line op="=" label={`w${i}`} w={step.word} note="" result />
          </>
        )}
      </div>

      {diffusion && (
        <p className={`kx-flipnote ${changedBits ? 'changed' : ''}`}>
          With bit {diffusion.bit} of the key flipped, w{i} becomes <code>{toHex(diffusion.schedule.words[i])}</code>
          {changedBits ? ` — ${changedBits} of 32 bits differ.` : ' — unchanged.'}
        </p>
      )}

      {step.g && <SboxLookup key={i} input={step.g.rotWord} />}

      <div className="kx-nav">
        <button type="button" disabled={i === 0} onClick={() => onSelect(i - 1)}>
          ← w{i - 1}
        </button>
        <button type="button" disabled={i === 43} onClick={() => onSelect(i + 1)}>
          w{i + 1} →
        </button>
      </div>

      <pre className="kx-formula">
        {`for i = 4 … 43:
  temp = w[i-1]
  if i mod 4 = 0:
    temp = SubWord(RotWord(temp)) ⊕ Rcon[i/4]
  w[i] = w[i-4] ⊕ temp`}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// S-box lookups inside SubWord
// ---------------------------------------------------------------------------

const HEX = '0123456789abcdef'

function SboxLookup({ input }: { input: Word }) {
  const [sel, setSel] = useState(0)
  const x = input[sel]
  const row = x >> 4
  const col = x & 15
  return (
    <div className="kx-sbox">
      <h3>Inside SubWord: four S-box lookups</h3>
      <div className="kx-lookups" role="group" aria-label="SubWord bytes">
        {input.map((b, k) => (
          <button key={k} type="button" aria-pressed={k === sel} onClick={() => setSel(k)}>
            <code>{hex2(b)}</code> → <code>{hex2(SBOX[b])}</code>
          </button>
        ))}
      </div>
      <p className="kx-muted">
        Byte <code>{hex2(x)}</code>: the first hex digit <b>{HEX[row]}</b> picks the row, the second digit{' '}
        <b>{HEX[col]}</b> picks the column, and the S-box gives <code className="kx-strong">{hex2(SBOX[x])}</code>.
      </p>
      <div className="kx-sbox-scroll">
        <table className="kx-sbox-table" aria-label="AES S-box">
          <thead>
            <tr>
              <th />
              {Array.from({ length: 16 }, (_, c) => (
                <th key={c} className={c === col ? 'on' : undefined}>
                  {HEX[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 16 }, (_, r) => (
              <tr key={r}>
                <th className={r === row ? 'on' : undefined}>{HEX[r]}</th>
                {Array.from({ length: 16 }, (_, c) => {
                  const v = 16 * r + c
                  const cls = v === x ? 'hit' : r === row || c === col ? 'line' : undefined
                  return (
                    <td key={c} className={cls}>
                      {hex2(SBOX[v])}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
