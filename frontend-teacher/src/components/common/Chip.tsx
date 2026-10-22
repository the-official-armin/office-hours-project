// Shared: changes need a PR note and a teammate review.
// Purpose: small status label.
import type { ReactNode } from 'react'

type Kind = 'tint' | 'amber' | 'past'

const KINDS: Record<Kind, string> = {
  tint: 'bg-tint text-tint-ink',
  amber: 'bg-amber text-amber-ink',
  past: 'bg-past text-ink2',
}

export default function Chip({ kind = 'tint', children }: { kind?: Kind; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold ${KINDS[kind]}`}>{children}</span>
}
