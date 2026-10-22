// Shared: changes need a PR note and a teammate review.
// Purpose: the Washington Preparatory School crest as a round logo. The image lives at /school-logo.png (public/).
// If the file is missing or fails to load, a navy "WP" badge takes its place so the layout never breaks.
import { useState } from 'react'

const SCHOOL_NAME = 'Washington Preparatory School'

interface Props {
  /** Diameter in px. 36 in the sidebar and top bar, 64 on the sign-in screen. */
  size?: number
  /** A ring that separates the crest from a sidebar (white on dark sidebars). */
  ring?: boolean
  className?: string
}

export default function SchoolLogo({ size = 36, ring = false, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const box = { width: size, height: size }
  const ringClass = ring ? 'ring-2 ring-logo-ring' : ''

  if (failed) {
    return (
      <span
        role="img"
        aria-label={SCHOOL_NAME}
        style={{ ...box, fontSize: Math.round(size * 0.36) }}
        className={`flex flex-none items-center justify-center rounded-full bg-brand font-extrabold text-on-brand ${ringClass} ${className}`}
      >
        WP
      </span>
    )
  }

  return (
    <img
      src="/school-logo.png"
      alt={SCHOOL_NAME}
      width={size}
      height={size}
      style={box}
      onError={() => setFailed(true)}
      className={`flex-none rounded-full object-cover ${ringClass} ${className}`}
    />
  )
}
