import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { HomePage } from './home/HomePage'
import { RoundsPage } from './parts/rounds/RoundsPage'
import { AvalanchePage } from './parts/avalanche/AvalanchePage'
import { KeyExpansionPage } from './parts/key-expansion/KeyExpansionPage'
import { Icon } from './components/Icon'
import { PARTS } from './home/parts'
import type { PartId } from './home/parts'

const PAGES: Record<PartId, () => ReactElement> = {
  rounds: RoundsPage,
  avalanche: AvalanchePage,
  keys: KeyExpansionPage,
}

type PageId = 'home' | PartId

const readHash = (): PageId => {
  const h = window.location.hash.slice(1)
  return PARTS.some((p) => p.id === h) ? (h as PageId) : 'home'
}

export default function App() {
  const [page, setPage] = useState<PageId>(readHash)

  useEffect(() => {
    const onHash = () => setPage(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const index = PARTS.findIndex((p) => p.id === page)
  const part = index >= 0 ? PARTS[index] : null
  const PartPage = part ? PAGES[part.id] : null
  const next = index >= 0 ? PARTS[index + 1] : null

  return (
    <>
      <header className="app-header">
        <div className="app-header-in">
          <a className="brand" href="#home" aria-label="AES-128 Explorer, home">
            <span className="brand-logo">
              <Icon name="lock" />
            </span>
            <span className="brand-name">AES-128 Explorer</span>
          </a>
          <nav className="app-nav" aria-label="Parts">
            {PARTS.map((p) => (
              <a key={p.id} href={`#${p.id}`} data-part={p.id} aria-current={p.id === page ? 'page' : undefined}>
                <span className="nav-num">{p.num}</span>
                <span className="nav-label">{p.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {/* key= replays the entrance animation on every page change */}
        <div className="page" key={page}>
          {PartPage ? <PartPage /> : <HomePage />}
          {part && (
            <div className="next-part">
              <a href={next ? `#${next.id}` : '#home'}>
                <span>
                  <small>{next ? `Next · part ${next.num}` : 'Done'}</small>
                  <b>{next ? next.title : 'Back to the overview'}</b>
                </span>
                <span className="go">
                  <Icon name="arrow-right" />
                </span>
              </a>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        EECE 455 · Project 7 · AES-128 runs entirely in your browser. For learning only, not for protecting real data.
      </footer>
    </>
  )
}
