// Shared: changes need a PR note and a teammate review.
// Purpose: Switch (role="switch"), Stepper (- n +) and Segmented (button group with aria-pressed).
import type { ReactNode } from 'react'
import { IconButton } from './Button'

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] flex-none rounded-full border-0 p-0 disabled:opacity-60 ${checked ? 'bg-brand' : 'bg-toggle-off'}`}
    >
      <i
        className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] duration-[120ms] ${checked ? 'left-6' : 'left-1'}`}
      />
    </button>
  )
}

export function Stepper({
  value,
  min,
  max,
  onStep,
  lessLabel,
  moreLabel,
  children,
}: {
  value: number
  min: number
  max: number
  /** Called with -1 or +1. The caller decides whether the change is allowed. */
  onStep: (delta: -1 | 1) => void
  lessLabel: string
  moreLabel: string
  /** Text next to the buttons. */
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <IconButton aria-label={lessLabel} disabled={value <= min} onClick={() => onStep(-1)}>
        {'−'}
      </IconButton>
      <output aria-live="polite" className="min-w-16 text-center text-[32px] font-extrabold tabular-nums">
        {value}
      </output>
      <IconButton aria-label={moreLabel} disabled={value >= max} onClick={() => onStep(1)}>
        +
      </IconButton>
      {children && <span className="text-[13px] text-muted">{children}</span>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-xl border border-edge bg-soft p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-[38px] rounded-[9px] border-0 px-4 text-sm font-bold max-[899px]:px-3 ${
            value === o.id ? 'bg-brand text-on-brand' : 'bg-transparent text-ink2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
