// Shared: changes need a PR note and a teammate review.
// Purpose: bottom tab bar shown under 900px, where the sidebar is hidden.
import { Link, useLocation } from 'react-router-dom'
import type { Role, ShellBadges } from '../../types'
import Icon from './Icon'
import { isCurrent, ROLE_LABEL, TAB_ITEMS } from './nav'

export default function TabBar({ role, badges }: { role: Role; badges: ShellBadges }) {
  const { pathname, search } = useLocation()

  return (
    <nav
      aria-label={`${ROLE_LABEL[role]} navigation`}
      className="fixed inset-x-0 bottom-0 z-30 flex gap-0.5 border-t border-line bg-surface px-[max(16px,env(safe-area-inset-right,0px))] pb-[calc(6px+env(safe-area-inset-bottom,0px))] pt-1.5 min-[900px]:hidden"
    >
      {TAB_ITEMS[role].map((tab) => {
        const count = tab.badge ? badges[tab.badge] : 0
        return (
          <Link
            key={tab.id}
            to={tab.to}
            aria-current={isCurrent(tab, pathname, search) ? 'page' : undefined}
            className="relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-0.5 text-[10.5px] font-bold text-muted no-underline aria-[current=page]:bg-tint aria-[current=page]:text-tint-ink"
          >
            <Icon name={tab.icon} size={22} />
            <span>{tab.label}</span>
            {count > 0 && (
              <span className="absolute right-1.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[10px] font-extrabold text-badge-ink">
                <span className="sr-only">{count} waiting: </span>
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
