import { useEffect, useState } from 'react'
import { RoundsPage } from './parts/rounds/RoundsPage'
import { AvalanchePage } from './parts/avalanche/AvalanchePage'
import { KeyExpansionPage } from './parts/key-expansion/KeyExpansionPage'

const PAGES = [
  { id: 'rounds', label: '1 · Rounds', Page: RoundsPage },
  { id: 'avalanche', label: '2 · Avalanche', Page: AvalanchePage },
  { id: 'keys', label: '3 · Key expansion', Page: KeyExpansionPage },
] as const

type PageId = (typeof PAGES)[number]['id']

const readHash = (): PageId => {
  const h = window.location.hash.slice(1)
  return PAGES.some((p) => p.id === h) ? (h as PageId) : 'rounds'
}

export default function App() {
  const [page, setPage] = useState<PageId>(readHash)

  useEffect(() => {
    const onHash = () => setPage(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const { Page } = PAGES.find((p) => p.id === page)!
  return (
    <>
      <header>
        <strong>AES-128 Explorer</strong>
        <nav>
          {PAGES.map((p) => (
            <a key={p.id} href={`#${p.id}`} aria-current={p.id === page ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <Page />
      </main>
    </>
  )
}
