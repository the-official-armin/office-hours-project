// Shared: unit tests for the calendar scale logic.
import { describe, expect, it } from 'vitest'
import { calLabel, calNav, calRange, calSetView, initialCal, mondayOf, monthWeeks, shiftMonth, type CalState } from './calendar'

const TODAY = '2026-10-15' // Thursday

describe('mondayOf', () => {
  it('finds the Monday of a school week and jumps weekends forward', () => {
    expect(mondayOf('2026-10-15')).toBe('2026-10-12') // Thu
    expect(mondayOf('2026-10-12')).toBe('2026-10-12') // Mon
    expect(mondayOf('2026-10-16')).toBe('2026-10-12') // Fri
    expect(mondayOf('2026-10-17')).toBe('2026-10-19') // Sat -> next Monday
    expect(mondayOf('2026-10-18')).toBe('2026-10-19') // Sun -> next Monday
  })
})

describe('calRange and calLabel', () => {
  const base: CalState = { view: 'week', wk: '2026-10-19', month: { y: 2026, m: 9 }, sel: null }

  it('covers a week, a month, and a quarter', () => {
    expect(calRange(base)).toEqual(['2026-10-19', '2026-10-23'])
    expect(calRange({ ...base, view: 'month' })).toEqual(['2026-10-01', '2026-10-31'])
    expect(calRange({ ...base, view: 'quarter' })).toEqual(['2026-10-01', '2026-12-31'])
  })

  it('labels each scale', () => {
    expect(calLabel(base)).toBe('Oct 19 – 23, 2026')
    expect(calLabel({ ...base, wk: '2026-10-26' })).toBe('Oct 26 – 30, 2026')
    expect(calLabel({ ...base, wk: '2026-11-30' })).toBe('Nov 30 – Dec 4, 2026')
    expect(calLabel({ ...base, view: 'month' })).toBe('October 2026')
    expect(calLabel({ ...base, view: 'quarter' })).toBe('Oct – Dec 2026')
    expect(calLabel({ ...base, view: 'quarter', month: { y: 2026, m: 11 } })).toBe('Dec 2026 – Feb 2027')
  })
})

describe('calNav', () => {
  it('moves one week, one month, or three months', () => {
    const c = initialCal(TODAY)
    expect(calNav({ ...c, view: 'week' }, 1).wk).toBe('2026-10-19')
    expect(calNav({ ...c, view: 'week' }, -1).wk).toBe('2026-10-05')
    expect(calNav(c, 1).month).toEqual({ y: 2026, m: 10 })
    expect(calNav({ ...c, view: 'quarter' }, 1).month).toEqual({ y: 2027, m: 0 })
    expect(calNav({ ...c, view: 'quarter' }, -1).month).toEqual({ y: 2026, m: 6 })
  })

  it('rolls over year ends', () => {
    expect(shiftMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 })
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 })
  })
})

describe('calSetView keeps the selected day in view', () => {
  it('month -> week uses the selected day when it is in the month', () => {
    const c: CalState = { ...initialCal(TODAY), sel: '2026-10-28' }
    expect(calSetView(c, 'week', TODAY).wk).toBe('2026-10-26')
  })

  it('month -> week falls back to today, then to the first of the range', () => {
    expect(calSetView(initialCal(TODAY), 'week', TODAY).wk).toBe('2026-10-12')
    const elsewhere: CalState = { ...initialCal(TODAY), month: { y: 2026, m: 11 } }
    expect(calSetView(elsewhere, 'week', TODAY).wk).toBe(mondayOf('2026-12-01'))
  })

  it('a weekend selection jumps to the next Monday', () => {
    const c: CalState = { ...initialCal(TODAY), sel: '2026-10-17' }
    expect(calSetView(c, 'week', TODAY).wk).toBe('2026-10-19')
  })

  it('week -> month shows the selected day, or the middle of the week', () => {
    const wk: CalState = { view: 'week', wk: '2026-10-26', month: { y: 2026, m: 9 }, sel: '2026-10-28' }
    expect(calSetView(wk, 'month', TODAY).month).toEqual({ y: 2026, m: 9 })
    const spanning: CalState = { view: 'week', wk: '2026-10-26', month: { y: 2026, m: 9 }, sel: null }
    expect(calSetView(spanning, 'month', TODAY).month).toEqual({ y: 2026, m: 9 }) // Wed Oct 28
    const novWeek: CalState = { view: 'week', wk: '2026-11-30', month: { y: 2026, m: 9 }, sel: null }
    expect(calSetView(novWeek, 'month', TODAY).month).toEqual({ y: 2026, m: 11 }) // Wed Dec 2
  })

  it('returns the same state for the same view', () => {
    const c = initialCal(TODAY)
    expect(calSetView(c, 'month', TODAY)).toBe(c)
  })
})

describe('monthWeeks', () => {
  it('lists Mon-Fri rows that touch the month', () => {
    const weeks = monthWeeks(2026, 9) // October 2026 starts on a Thursday
    expect(weeks[0]).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(weeks).toHaveLength(5)
    expect(weeks[4][4]).toBe('2026-10-30')
  })

  it('skips a trailing week that only has weekend days of the month', () => {
    // Aug 2026 ends on a Monday the 31st: the last row starts Aug 31.
    const weeks = monthWeeks(2026, 7)
    expect(weeks[weeks.length - 1][0]).toBe('2026-08-31')
    // Nov 2026 starts on a Sunday: the first row is Nov 2 - 6.
    expect(monthWeeks(2026, 10)[0][0]).toBe('2026-11-02')
  })
})
