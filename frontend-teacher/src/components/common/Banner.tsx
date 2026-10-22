// Shared: changes need a PR note and a teammate review.
// Purpose: info / warning banner, and the amber inline confirmation bar.
import type { ReactNode } from 'react'
import Icon from './Icon'

export default function Banner({ kind = 'info', children }: { kind?: 'info' | 'warn'; children: ReactNode }) {
  const warn = kind === 'warn'
  return (
    <div
      className={`flex gap-3 rounded-xl px-[18px] py-3.5 text-sm font-semibold ${
        warn ? 'items-start bg-amber leading-normal text-amber-ink' : 'items-center bg-tint text-tint-ink'
      }`}
    >
      <Icon name={warn ? 'warn' : 'info'} className={`flex-none ${warn ? 'mt-px' : ''}`} />
      <span>{children}</span>
    </div>
  )
}

/** An amber confirmation shown in place of a button, with the actions it offers. */
export function ConfirmBar({ message, children }: { message: ReactNode; children: ReactNode }) {
  return (
    <div
      role="group"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber px-4 py-3.5 text-sm font-semibold text-amber-ink"
    >
      <span>{message}</span>
      <span className="flex flex-wrap gap-2">{children}</span>
    </div>
  )
}
