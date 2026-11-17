import { useState } from 'react'
import type { ReactNode } from 'react'
import { RC, expandKey } from '../../aes/keyExpansion'
import type { KeySchedule, WordStep } from '../../aes/keyExpansion'
import { hex2, parseBlock, toHex } from '../../aes/hex'
import type { Word } from '../../aes/types'
import './KeyExpansionPage.css'

const EXAMPLES = [
  { label: 'FIPS-197 A.1', key: '2b7e151628aed2a6abf7158809cf4f3c' },
  { label: 'Textbook (Table 6.3)', key: '0f1571c947d9e8590cb7add6af7f6798' },
  { label: 'FIPS-197 C.1', key: '000102030405060708090a0b0c0d0e0f' },
  { label: 'All zeros', key: '00000000000000000000000000000000' },
]

const randomKey = () => toHex(Array.from(crypto.getRandomValues(new Uint8Array(16))))

/**
 * Part 3 – Key expansion: the 44 words w0 … w43, shown in groups of 4 (round keys K0 … K10),
 * with the derivation of any selected word.
 */
export function KeyExpansionPage() {
  const [keyText, setKeyText] = useState(EXAMPLES[0].key)
  const [selected, setSelected] = useState(4)
  const key = parseBlock(keyText)
  const schedule = key ? expandKey(key) : null
  const digits = keyText.replace(/\s+/g, '')

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

      {schedule && (
        <div className="kx-layout">
          <ScheduleTable schedule={schedule} selected={selected} onSelect={setSelected} />
          <Derivation step={schedule.steps[selected]} onSelect={setSelected} />
        </div>
      )}
    </section>
  )
}

function ScheduleTable({
  schedule,
  selected,
  onSelect,
}: {
  schedule: KeySchedule
  selected: number
  onSelect: (i: number) => void
}) {
  const deps = selected >= 4 ? [selected - 1, selected - 4] : []
  return (
    <div className="kx-card">
      <h2>The 44 words, 4 per round key</h2>
      <div className="kx-table" role="grid" aria-label="Key schedule">
        {schedule.roundKeys.map((_, r) => (
          <div className="kx-rk" role="row" key={r}>
            <div className="kx-rk-label" role="rowheader">
              <b>K{r}</b>
              <small>{r === 0 ? 'the key' : `round ${r}`}</small>
            </div>
            {[0, 1, 2, 3].map((j) => {
              const i = 4 * r + j
              const cls = [
                'kx-word',
                i === selected ? 'active' : '',
                deps.includes(i) ? 'dep' : '',
                i >= 4 && i % 4 === 0 ? 'g' : '',
              ].join(' ')
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  className={cls}
                  aria-pressed={i === selected}
                  onClick={() => onSelect(i)}
                >
                  <small>w{i}</small>
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
    </div>
  )
}

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

function Derivation({ step, onSelect }: { step: WordStep; onSelect: (i: number) => void }) {
  const i = step.index
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
            <Line label="SubWord" w={step.g.subWord} note="S-box on each byte" />
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
