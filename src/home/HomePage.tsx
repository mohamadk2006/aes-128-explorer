import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { encryptTrace } from '../aes/cipher'
import { parseBlock, toHex } from '../aes/hex'
import { StateMatrix } from '../components/StateMatrix'
import { Icon } from '../components/Icon'
import { PARTS } from './parts'
import './HomePage.css'

/** FIPS-197 Appendix B, used by the live demo. */
const DEMO = encryptTrace(parseBlock('3243f6a8885a308d313198a2e0370734')!, parseBlock('2b7e151628aed2a6abf7158809cf4f3c')!)

/** Every frame of the demo: the plaintext, then the state after each operation of each round. */
const FRAMES = [
  { round: -1, op: 'Plaintext', state: DEMO.plaintext },
  ...DEMO.rounds.flatMap((r) => r.steps.map((s) => ({ round: r.round, op: s.step as string, state: s.state }))),
]

const OPS = [
  {
    op: 'SubBytes',
    title: 'SubBytes',
    what: 'Every byte is replaced using the S-box, a fixed 16×16 table. This is the only non-linear step.',
    why: 'Confusion: the output is not a simple formula of the input.',
  },
  {
    op: 'ShiftRows',
    title: 'ShiftRows',
    what: 'Row 0 stays; rows 1, 2 and 3 rotate left by 1, 2 and 3 bytes.',
    why: 'Diffusion across columns: each column now holds bytes from all four.',
  },
  {
    op: 'MixColumns',
    title: 'MixColumns',
    what: 'Each column is multiplied by a fixed matrix in GF(2⁸), so every output byte depends on all four input bytes.',
    why: 'Diffusion inside a column. Skipped in round 10.',
  },
  {
    op: 'AddRoundKey',
    title: 'AddRoundKey',
    what: 'The state is XORed with the round key Kr from the key expansion.',
    why: 'The only step that uses the key.',
  },
] as const

export function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">EECE 455 · Project 7 · Interactive lab</span>
          <h1>
            Watch AES-128 turn your data into <span className="hero-mark">ciphertext</span>, one step at a time.
          </h1>
          <p>
            AES encrypts a 16-byte block by repeating four simple operations for 10 rounds, using a different round
            key each time. Explore every operation, see how one changed bit spreads, and build the round keys yourself.
          </p>
          <div className="hero-cta">
            <a className="btn-cta" href="#rounds">
              <Icon name="play" /> Start with part 1
            </a>
            <a className="btn-soft" href="#keys">
              <Icon name="key" /> See the key expansion
            </a>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section aria-labelledby="ops-title">
        <h2 id="ops-title" className="section-title">
          One AES round = four operations
        </h2>
        <p className="section-lead">
          Each operation has its own colour on every page of this site. Round 0 is only AddRoundKey, rounds 1–9 do
          all four, and round 10 skips MixColumns.
        </p>
        <div className="ops">
          {OPS.map((o, i) => (
            <article key={o.op} className="op-card" data-op={o.op} style={{ '--i': i } as CSSProperties}>
              <OpDemo op={o.op} />
              <div>
                <span className="op-step">Step {i + 1}</span>
                <h3>{o.title}</h3>
                <p>{o.what}</p>
                <p className="op-why">{o.why}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="path-title">
        <h2 id="path-title" className="section-title">
          Your learning path
        </h2>
        <div className="path">
          {PARTS.map((p, i) => (
            <a key={p.id} className="path-card" href={`#${p.id}`} data-part={p.id} style={{ '--i': i } as CSSProperties}>
              <span className="path-top">
                <span className="path-num">{p.num}</span>
                <Icon name={p.icon} size={22} />
              </span>
              <b>{p.title}</b>
              <span className="path-text">{p.summary}</span>
              <span className="path-go">
                Open part {p.num} <Icon name="arrow-right" size={16} />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="reading" aria-labelledby="read-title">
        <div>
          <h2 id="read-title" className="section-title">
            How to read a 4×4 state
          </h2>
          <p className="section-lead">
            The 16 bytes of a block are written into the state <b>column by column</b>, as in FIPS-197 and the
            textbook. So <code>3243f6a8…</code> puts <code>32 43 f6 a8</code> in the first column. Each column is one
            32-bit word, which is also how the round keys are built in part 3.
          </p>
        </div>
        <div className="index-grid" aria-label="Byte order in the state: byte i is at row i mod 4, column i div 4">
          {Array.from({ length: 16 }, (_, k) => {
            const row = Math.floor(k / 4)
            const col = k % 4
            const i = row + 4 * col
            return (
              <span key={k} style={{ '--col': col } as CSSProperties}>
                {i}
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** Live demo: the FIPS-197 example block going through all 40 operations. */
function HeroDemo() {
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 1100)
    return () => window.clearInterval(id)
  }, [playing])

  const f = FRAMES[frame]
  const done = frame === FRAMES.length - 1
  return (
    <figure className="hero-demo">
      <div className="hero-demo-head">
        <span className="op-tag" data-op={f.op}>
          {f.op}
        </span>
        <span className="hero-round">{f.round < 0 ? 'before round 0' : `round ${f.round}`}</span>
      </div>
      <StateMatrix block={f.state} tone={done ? 'result' : 'plain'} />
      <div className="hero-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${frame / (FRAMES.length - 1)})` }} />
      </div>
      <figcaption>
        <span>{done ? 'Ciphertext' : 'FIPS-197 example block'}</span>
        <code>{toHex(f.state)}</code>
      </figcaption>
      <button type="button" className="hero-pause" onClick={() => setPlaying(!playing)} aria-pressed={!playing}>
        {playing ? 'Pause' : 'Play'} demo
      </button>
    </figure>
  )
}

/** A tiny looping 4×4 picture of what each operation does. */
function OpDemo({ op }: { op: string }) {
  return (
    <div className={`op-demo op-demo-${op}`} aria-hidden="true">
      {Array.from({ length: 16 }, (_, k) => (
        <span key={k} style={{ '--r': Math.floor(k / 4), '--k': k % 4 } as CSSProperties} />
      ))}
    </div>
  )
}
