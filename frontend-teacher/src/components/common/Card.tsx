// Shared: changes need a PR note and a teammate review.
// Purpose: white surface card, plus the small pieces that sit inside one (header row, empty note, eyebrow label).
import type { ElementType, ReactNode } from 'react'

interface CardProps {
  as?: ElementType
  children: ReactNode
  className?: string
  /** Smaller padding. */
  tight?: boolean
  [key: string]: unknown
}

export default function Card({ as: Tag = 'section', children, className = '', tight = false, ...rest }: CardProps) {
  return (
    <Tag
      className={`min-w-0 rounded-2xl border border-line bg-surface ${tight ? 'p-[14px] min-[900px]:p-5' : 'p-[18px] min-[900px]:p-6'} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function CardHead({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 pb-3">{children}</div>
}

export function CardTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-extrabold">
      {children}
    </h2>
  )
}

export function Eyebrow({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`text-xs font-bold uppercase tracking-[.05em] text-muted ${className}`}>
      {children}
    </h2>
  )
}

/** An explanation shown where a list is empty. */
export function Empty({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return <div className={`${flush ? '' : 'border-t border-line'} pb-2 pt-6 text-sm text-muted`}>{children}</div>
}

/** One row in a list: leading block, text that grows, trailing content. */
export function Row({ children, first = false, top = false }: { children: ReactNode; first?: boolean; top?: boolean }) {
  return (
    <div
      className={`flex flex-wrap gap-3 py-4 min-[640px]:gap-4 ${top ? 'items-start' : 'items-center'} ${first ? '' : 'border-t border-line'}`}
    >
      {children}
    </div>
  )
}
