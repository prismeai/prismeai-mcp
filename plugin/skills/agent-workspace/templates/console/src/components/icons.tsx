import type { ReactNode } from 'react'

/* Line icons drawn inline (the host only ships a subset of lucide, never import it here): 24×24, stroke 1.75,
 * currentColor, so they follow the text colour of the theme. */

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className || 'h-[18px] w-[18px] shrink-0'}>
      {children}
    </svg>
  )
}

type P = { className?: string }

export const IconDashboard = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Svg>
)

export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="M12 3 2.5 8 12 13l9.5-5L12 3Z" />
    <path d="m2.5 12.5 9.5 5 9.5-5" />
    <path d="m2.5 17 9.5 5 9.5-5" />
  </Svg>
)

export const IconInbox = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v10" />
    <path d="m8 9 4 4 4-4" />
    <path d="M3 14h5l1.5 3h5L16 14h5" />
    <path d="M3 14v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
  </Svg>
)

export const IconBot = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 8V4" />
    <circle cx="12" cy="3.5" r="0.75" />
    <path d="M9 13v1.5M15 13v1.5" />
    <path d="M2 13v3M22 13v3" />
  </Svg>
)

export const IconCompare = (p: P) => (
  <Svg {...p}>
    <path d="M7 4v13" />
    <path d="m4 14 3 3 3-3" />
    <path d="M17 20V7" />
    <path d="m14 10 3-3 3 3" />
  </Svg>
)

export const IconGauge = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 17a8.5 8.5 0 1 1 15 0" />
    <path d="m12 13 3.5-4" />
    <circle cx="12" cy="13" r="1.25" />
  </Svg>
)

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3" />
    <path d="M9 7.5h7M9 11h5" />
  </Svg>
)

export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </Svg>
)

export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
    <path d="M20 20v-4h-4" />
  </Svg>
)

export const IconDoc = (p: P) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </Svg>
)

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4M12 17v.5" />
  </Svg>
)

export const IconX = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
)

export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Svg>
)

export const IconGit = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="9" r="2" />
    <path d="M6 8v8" />
    <path d="M18 11c0 3-3 4-6 4H8" />
  </Svg>
)
