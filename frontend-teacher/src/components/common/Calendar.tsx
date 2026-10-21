// Shared: changes need a PR note and a teammate review.
// Purpose: Week / Month / Quarter calendar (Mon-Fri). The calendar owns the grid, the buttons and their state
// (today, selected, past, dimmed); each role draws what is inside a day through render props.
import type { ReactNode } from 'react'
import { calLabel, calNav, calSetView, CAL_VIEWS, monthWeeks, shiftMonth, weekDays, WEEKDAY_HEADINGS, type CalState } from '../../lib/calendar'
import { dayOfMonth, DOW_SHORT, dowOf, formatMonthDay, formatMonth, parseISODate } from '../../lib/dates'
import { IconButton } from './Button'
import { Segmented } from './controls'
import Icon from './Icon'

/** What a role draws for one day in the week and month views. */
export interface DayRender {
  /** Full spoken label, e.g. "Thursday, October 15, Lunch 3 of 4". */
  aria: string
  content: ReactNode
  /** Greys the cell out. */
  past?: boolean
}

export type MiniStatus = 'open' | 'full' | 'off' | 'past' | 'none'

/** What a role draws for one day in the quarter view. */
export interface MiniRender {
  status: MiniStatus
  aria: string
  /** A dot under the number, e.g. "students booked". */
  dot?: boolean
  disabled?: boolean
}

interface ControlsProps {
  cal: CalState
  today: string
  onChange: (next: CalState) => void
}

/** Scale switch, previous / next and the range label. Place it in the page header. */
export function CalendarControls({ cal, today, onChange }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 max-[640px]:w-full max-[640px]:justify-between max-[640px]:gap-2">
      <Segmented
        label="Calendar scale"
        value={cal.view}
        options={CAL_VIEWS}
        onChange={(view) => onChange(calSetView(cal, view, today))}
      />
      <div className="flex items-center gap-2">
        <IconButton aria-label={`Previous ${cal.view}`} onClick={() => onChange(calNav(cal, -1))}>
          <Icon name="left" strokeWidth={2} />
        </IconButton>
        <output aria-live="polite" className="min-w-[150px] text-center text-lg font-extrabold max-[640px]:min-w-0 max-[640px]:text-base">
          {calLabel(cal)}
        </output>
        <IconButton aria-label={`Next ${cal.view}`} onClick={() => onChange(calNav(cal, 1))}>
          <Icon name="right" strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  )
}

interface GridProps {
  cal: CalState
  today: string
  onSelect: (date: string) => void
  renderDay: (date: string, view: 'week' | 'month') => DayRender
  renderMini: (date: string) => MiniRender
}

const MINI_STATUS: Record<MiniStatus, string> = {
  open: 'bg-tint text-tint-ink',
  full: 'bg-amber text-amber-ink',
  off: 'bg-amber text-amber-ink',
  past: 'bg-past text-past-ink',
  none: 'bg-transparent text-muted',
}

export function CalendarGrid({ cal, today, onSelect, renderDay, renderMini }: GridProps) {
  if (cal.view === 'quarter') {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-5 max-[640px]:grid-cols-1 max-[640px]:gap-4">
        {[0, 1, 2].map((i) => {
          const mo = shiftMonth(cal.month, i)
          return (
            <div key={`${mo.y}-${mo.m}`}>
              <div className="pb-2.5 pl-0.5 text-[15px] font-extrabold">
                {formatMonth(mo.y, mo.m).split(' ')[0]} <span className="font-semibold text-muted">{mo.y}</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {['M', 'T', 'W', 'T', 'F'].map((d, n) => (
                  <span key={n} aria-hidden="true" className="pb-0.5 text-center text-[11px] font-bold text-muted">
                    {d}
                  </span>
                ))}
                {monthWeeks(mo.y, mo.m).flatMap((wk) =>
                  wk.map((date) => {
                    if (parseISODate(date).getMonth() !== mo.m) return <span key={date} aria-hidden="true" className="invisible h-[38px]" />
                    const m = renderMini(date)
                    const selected = cal.sel === date
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={m.disabled}
                        aria-pressed={selected}
                        aria-label={m.aria}
                        onClick={() => onSelect(date)}
                        className={`relative flex h-[38px] min-w-0 items-center justify-center rounded-lg border p-0 text-[13px] font-bold max-[640px]:h-10 ${MINI_STATUS[m.status]} ${
                          date === today ? 'border-brand' : 'border-transparent'
                        } ${selected ? 'shadow-[0_0_0_2px_var(--brand)]' : ''} disabled:cursor-default`}
                      >
                        <span className="tabular-nums">{dayOfMonth(date)}</span>
                        {m.dot && (
                          <i
                            aria-hidden="true"
                            className={`absolute bottom-1 left-1/2 -ml-[2.5px] h-[5px] w-[5px] rounded-full ${
                              m.status === 'full' || m.status === 'off' ? 'bg-amber-ink' : 'bg-brand'
                            }`}
                          />
                        )}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const view = cal.view
  const dates = view === 'week' ? weekDays(cal.wk) : monthWeeks(cal.month.y, cal.month.m).flat()
  return (
    <div>
      {view === 'month' && (
        <div className="grid grid-cols-5 gap-2 pb-2 max-[640px]:gap-1">
          {WEEKDAY_HEADINGS.map((d) => (
            <div key={d} className="px-1 text-xs font-bold uppercase tracking-[.05em] text-muted">
              {d}
            </div>
          ))}
        </div>
      )}
      <div className={view === 'week' ? 'grid grid-cols-5 gap-2 max-[640px]:grid-cols-1' : 'grid grid-cols-5 gap-2 max-[640px]:gap-1'}>
        {dates.map((date, index) => {
          const r = renderDay(date, view)
          const d = parseISODate(date)
          const isToday = date === today
          const selected = cal.sel === date
          const label =
            view === 'week'
              ? `${DOW_SHORT[dowOf(date)]} ${d.getDate()}`
              : index === 0 || d.getDate() === 1
                ? formatMonthDay(date)
                : String(d.getDate())
          const dim = view === 'month' && d.getMonth() !== cal.month.m
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              aria-label={r.aria}
              onClick={() => onSelect(date)}
              className={`flex min-w-0 flex-col items-stretch rounded-xl border p-2.5 text-left ${
                view === 'week' ? 'min-h-[260px] gap-2 max-[640px]:min-h-0' : 'min-h-28 gap-1.5 max-[640px]:min-h-[76px] max-[640px]:gap-1 max-[640px]:rounded-[10px] max-[640px]:p-1.5'
              } ${r.past ? 'border-line bg-past' : 'border-line bg-surface'} ${isToday ? 'border-brand' : ''} ${
                selected ? 'shadow-[0_0_0_2px_var(--brand)]' : ''
              }`}
            >
              <span
                className={`flex flex-wrap items-center justify-between gap-1 ${view === 'week' ? '' : 'max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-0.5'}`}
              >
                <span
                  className={`text-sm font-bold tabular-nums max-[640px]:text-[13px] ${
                    r.past ? 'text-past-ink' : dim ? 'text-muted' : ''
                  }`}
                >
                  {label}
                </span>
                {isToday && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-extrabold text-on-brand max-[640px]:px-1.5 max-[640px]:text-[10px]">
                    Today
                  </span>
                )}
              </span>
              {r.content}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The colour key under a calendar. `extra` adds role-specific entries. */
export function CalendarLegend({ extra }: { extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-4 pt-4 text-[13px] text-muted">
      <span className="inline-flex items-center gap-2">
        <i className="inline-block h-3.5 w-3.5 rounded bg-tint" />
        Seats open
      </span>
      <span className="inline-flex items-center gap-2">
        <i className="inline-block h-3.5 w-3.5 rounded bg-amber" />
        Full or day off
      </span>
      <span className="inline-flex items-center gap-2">
        <i className="inline-block h-3.5 w-3.5 rounded border border-edge bg-past" />
        Past, can&rsquo;t be booked
      </span>
      {extra}
    </div>
  )
}
