// Shared: changes need a PR note and a teammate review.
// Purpose: page title row with an optional subtitle and right-aligned actions.
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-balance text-2xl font-extrabold tracking-tight min-[900px]:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
