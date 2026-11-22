/** Small inline SVG icons (Lucide-style strokes). Decorative: hidden from screen readers. */
const PATHS = {
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  layers: 'M12 2l10 5-10 5L2 7l10-5zM2 12l10 5 10-5M2 17l10 5 10-5',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  key: 'M15 7a4 4 0 11-3.9 4.9L3 20v-3l2-2h2v-2h2l1.5-1.5A4 4 0 0115 7zM16 10h.01',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  play: 'M7 4l13 8-13 8V4z',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5A2.5 2.5 0 006.5 22H20v-5',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
