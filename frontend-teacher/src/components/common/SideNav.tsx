// Shared: changes need a PR note and a teammate review.
// Purpose: sidebar content in three regions. The brand header and the footer (signed-in person + Log out) never scroll
// and never move; only the nav tree between them scrolls when it is taller than the screen.
// The panel itself is fixed to the viewport by AppShell.
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Role, ShellBadges, ShellData } from '../../types'
import { initials } from '../../lib/dates'
import Icon from './Icon'
import SchoolLogo from './SchoolLogo'
import { isCurrent, isGroup, NAV_TREE, ROLE_LABEL, type NavLeaf } from './nav'

interface Props {
  role: Role
  user: ShellData['user']
  badges: ShellBadges
  onLogout: () => void
}

const itemBase =
  'flex min-h-11 w-full items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 text-left text-sm font-semibold text-side-ink no-underline hover:bg-side-hover'

const gutters = 'pl-[max(16px,env(safe-area-inset-left,0px))] pr-4'

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
  const [edges, setEdges] = useState({ top: false, bottom: false })
  const navRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const label = ROLE_LABEL[role]

  const current = (leaf: NavLeaf) => isCurrent(leaf, pathname, search)

  // Show a thin line at the top and bottom of the nav while there is more to scroll in that direction.
  useEffect(() => {
    const nav = navRef.current
    const list = listRef.current
    if (!nav || !list) return
    const measure = () =>
      setEdges({ top: nav.scrollTop > 0, bottom: nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1 })
    measure()
    nav.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    observer.observe(list)
    return () => {
      nav.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [])

  return (
    <div data-side className="flex h-full w-[248px] flex-col">
      <div className={`flex flex-none items-center gap-3 pb-5 pt-[calc(24px+env(safe-area-inset-top,0px))] ${gutters}`}>
        <div className="flex items-center gap-3 px-3">
          <SchoolLogo ring />
          <div>
            <b className="block text-base font-extrabold leading-tight text-side-ink-strong">Washington Prep</b>
            <span className="block text-xs text-side-mute">Office Hours &middot; {label}</span>
          </div>
        </div>
      </div>

      <nav
        ref={navRef}
        aria-label={`${label} navigation`}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain border-y ${gutters} ${
          edges.top ? 'border-t-side-line' : 'border-t-transparent'
        } ${edges.bottom ? 'border-b-side-line' : 'border-b-transparent'}`}
      >
        <div ref={listRef} className="flex flex-col gap-0.5 py-1">
          {NAV_TREE[role].map((node) => {
            if (!isGroup(node)) {
              return (
                <Link
                  key={node.id}
                  to={node.to}
                  aria-current={current(node) ? 'page' : undefined}
                  className={`${itemBase} aria-[current=page]:bg-side-active aria-[current=page]:text-side-ink-strong`}
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
                  className={`${itemBase} ${inside && !open ? 'bg-side-hover text-side-ink-strong' : ''}`}
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
                  className="relative mb-2 mt-0.5 flex flex-col gap-0.5 pl-[22px] before:absolute before:bottom-1 before:left-[21px] before:top-1 before:w-0.5 before:rounded-sm before:bg-side-line before:content-[''] [&[hidden]]:hidden"
                >
                  {node.kids.map((kid) => (
                    <Link
                      key={kid.id}
                      to={kid.to}
                      aria-current={current(kid) ? 'page' : undefined}
                      className="relative flex min-h-[38px] items-center gap-3 rounded-r-[10px] py-0 pl-[22px] pr-3 text-[13.5px] font-semibold text-side-mute no-underline hover:text-side-ink-strong aria-[current=page]:bg-side-active aria-[current=page]:text-side-ink-strong aria-[current=page]:before:absolute aria-[current=page]:before:-left-px aria-[current=page]:before:bottom-[7px] aria-[current=page]:before:top-[7px] aria-[current=page]:before:w-0.5 aria-[current=page]:before:rounded-sm aria-[current=page]:before:bg-side-accent aria-[current=page]:before:content-['']"
                    >
                      <span className="min-w-0 flex-1">{kid.label}</span>
                      {kid.badge && <Badge count={badges[kid.badge]} />}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </nav>

      <div className={`flex-none border-t border-side-line pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3 ${gutters}`}>
        <div className="flex items-center gap-3 px-3 pb-2 pt-1">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-side-active text-[13px] font-extrabold text-side-ink-strong">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <b className="block truncate text-sm font-bold text-side-ink-strong">{user.name}</b>
            <span className="block truncate text-xs text-side-mute">{user.subtitle}</span>
          </div>
        </div>
        <button type="button" onClick={onLogout} className={itemBase}>
          <Icon name="logout" />
          Log out
        </button>
      </div>
    </div>
  )
}
