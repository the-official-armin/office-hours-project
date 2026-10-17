// Owner: Subgroup B (Teacher desktop UI). Small presentational pieces shared by the Teacher pages.
import type { ReactNode } from 'react'
import type { Feedback } from '../../hooks/useAsyncAction'
import { dayOfMonth, shortMonth, shortWeekday } from '../../lib/dates'
import Icon from './Icons'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-6 ${className}`}>{children}</section>
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-3">{actions}</div>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">{children}</p>
}

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  )
}

export function Badge({
  tone = 'brand',
  children,
}: {
  tone?: 'brand' | 'warn' | 'muted' | 'danger'
  children: ReactNode
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-ink',
    warn: 'bg-warn-soft text-warn-ink',
    muted: 'bg-past text-muted',
    danger: 'bg-danger-soft text-danger',
  }
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

/** Always rendered so screen readers announce changes (aria-live). */
export function FeedbackMessage({ feedback }: { feedback: Feedback | null }) {
  const tone =
    feedback?.kind === 'error'
      ? 'bg-danger-soft text-danger'
      : feedback?.kind === 'success'
        ? 'bg-brand-soft text-brand-ink'
        : ''
  return (
    <div aria-live="polite" role="status" className={feedback ? `rounded-lg px-4 py-3 text-sm font-semibold ${tone}` : ''}>
      {feedback?.text}
    </div>
  )
}

export function Notice({ tone = 'brand', children }: { tone?: 'brand' | 'warn'; children: ReactNode }) {
  const styles = tone === 'warn' ? 'bg-warn-soft text-warn-ink' : 'bg-brand-soft text-brand-ink'
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium ${styles}`}>
      <Icon name={tone === 'warn' ? 'warning' : 'info'} className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function SeatDots({ booked, max }: { booked: number; max: number }) {
  if (max > 12) return null
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full border-2 border-brand ${i < booked ? 'bg-brand' : 'bg-surface'}`}
        />
      ))}
    </span>
  )
}

export function DateBadge({ date, tone = 'brand' }: { date: string; tone?: 'brand' | 'warn' }) {
  const styles = tone === 'warn' ? 'bg-warn-soft text-warn-ink' : 'bg-brand-soft text-brand-ink'
  return (
    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${styles}`}>
      <span className="text-[11px] font-bold tracking-wide">{tone === 'warn' ? shortMonth(date) : shortWeekday(date)}</span>
      <span className="text-xl font-extrabold leading-none">{dayOfMonth(date)}</span>
    </div>
  )
}

export function Avatar({ text }: { text: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
      {text}
    </span>
  )
}
