// Small line icons drawn for SanctuaryCast (24x24 grid, currentColor), so the
// console needs no icon library.

import type { SVGProps } from 'react'

const paths = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5.2 12.2L20 20',
  plus: 'M12 5v14M5 12h14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM4 19.5A2.5 2.5 0 0 1 6.5 17H20',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18M15.5 9.5h.01',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.1-.9-1.4-.9-2.4 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  x: 'M6 6l12 12M18 6 6 18',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  eyeOff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3.1 3.6M6.4 7.4C4.2 9 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1',
  type: 'M5 6V4h14v2M12 4v16M9 20h6',
  cross: 'M12 3v18M6 8h12',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5'
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <path d={paths[name]} />
    </svg>
  )
}

/** App mark: a cross inside a soft gradient tile. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="sc-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8d88f8" />
          <stop offset="1" stopColor="#5a40c4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sc-logo)" />
      <path d="M16 7v18M10.5 12.5h11" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
