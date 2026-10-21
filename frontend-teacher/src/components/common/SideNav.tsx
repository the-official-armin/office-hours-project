// Shared: changes need a PR note and a teammate review.
// Purpose: sidebar content: brand, nav tree with expandable groups, the signed-in person, and log out.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Role, ShellBadges, ShellUser } from '../../types'
import { initials } from '../../lib/dates'
import Icon from './Icon'
import { isCurrent, isGroup, NAV_TREE, ROLE_LABEL, type NavLeaf } from './nav'

interface Props {
  role: Role
  user: ShellUser
  badges: ShellBadges
  onLogout: () => void
}

const itemBase =
  'flex min-h-11 w-full items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 text-left text-sm font-semibold text-side-ink no-underline hover:bg-white/[.08]'

function Badge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="rounded-full bg-badge px-2 py-0.5 text-xs font-extrabold tabular-nums text-badge-ink">
      <span className="sr-only">{count} waiting: </span>
      {count}
    </span>
  )
}

export default function SideNav({ role, user, badges, onLogout }: Props) {
  const { pathname, search } = useLocation()
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const label = ROLE_LABEL[role]

  const current = (leaf: NavLeaf) => isCurrent(leaf, pathname, search)

  return (
    <div
      data-side
      className="sticky top-[env(safe-area-inset-top,0px)] flex h-screen w-[248px] flex-col gap-1 overflow-auto pb-4 pl-[max(16px,env(safe-area-inset-left,0px))] pr-4 pt-6"
    >
      <div className="flex items-center gap-3 px-3 pb-6 pt-1">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-accent text-[#12303a]">
          <Icon name="clock" />
        </div>
        <div>
          <b className="block text-base font-extrabold leading-tight text-white">Office Hours</b>
          <span className="block text-xs text-side-mute">{label}</span>
        </div>
      </div>

      <nav aria-label={`${label} navigation`} className="flex flex-col gap-0.5">
        {NAV_TREE[role].map((node) => {
          if (!isGroup(node)) {
            return (
              <Link
                key={node.id}
                to={node.to}
                aria-current={current(node) ? 'page' : undefined}
                className={`${itemBase} aria-[current=page]:bg-white/[.14] aria-[current=page]:text-white`}
              >
                <Icon name={node.icon} />
                <span className="min-w-0 flex-1">{node.label}</span>
                {node.badge && <Badge count={badges[node.badge]} />}
              </Link>
            )
          }

          const open = !closed[node.id]
          const inside = node.kids.some(current)
          const sum = node.kids.reduce((n, k) => n + (k.badge ? badges[k.badge] : 0), 0)
          return (
            <div key={node.id} className="flex flex-col gap-0.5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`sub-${node.id}`}
                onClick={() => setClosed((c) => ({ ...c, [node.id]: open }))}
                className={`${itemBase} ${inside && !open ? 'bg-white/[.08] text-white' : ''}`}
              >
                <Icon name={node.icon} />
                <span className="min-w-0 flex-1">{node.label}</span>
                {!open && <Badge count={sum} />}
                <span className={`inline-flex text-side-mute transition-transform duration-150 ${open ? '' : '-rotate-90'}`}>
                  <Icon name="chev" size={16} strokeWidth={2} />
                </span>
              </button>
              <div
                id={`sub-${node.id}`}
                hidden={!open}
                className="relative mb-2 mt-0.5 flex flex-col gap-0.5 pl-[22px] before:absolute before:bottom-1 before:left-[21px] before:top-1 before:w-0.5 before:rounded-sm before:bg-white/[.14] before:content-[''] [&[hidden]]:hidden"
              >
                {node.kids.map((kid) => (
                  <Link
                    key={kid.id}
                    to={kid.to}
                    aria-current={current(kid) ? 'page' : undefined}
                    className="relative flex min-h-[38px] items-center gap-3 rounded-r-[10px] py-0 pl-[22px] pr-3 text-[13.5px] font-semibold text-side-mute no-underline hover:text-white aria-[current=page]:bg-white/[.12] aria-[current=page]:text-white aria-[current=page]:before:absolute aria-[current=page]:before:-left-px aria-[current=page]:before:bottom-[7px] aria-[current=page]:before:top-[7px] aria-[current=page]:before:w-0.5 aria-[current=page]:before:rounded-sm aria-[current=page]:before:bg-accent aria-[current=page]:before:content-['']"
                  >
                    <span className="min-w-0 flex-1">{kid.label}</span>
                    {kid.badge && <Badge count={badges[kid.badge]} />}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="mt-3 flex items-center gap-3 border-t border-white/[.14] px-3 pb-2 pt-4">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-[13px] font-extrabold text-[#12303a]">
          {initials(user.name)}
        </div>
        <div className="min-w-0">
          <b className="block truncate text-sm font-bold text-white">{user.name}</b>
          <span className="block truncate text-xs text-side-mute">{user.subtitle}</span>
        </div>
      </div>
      <button type="button" onClick={onLogout} className={itemBase}>
        <Icon name="logout" />
        Log out
      </button>
    </div>
  )
}
