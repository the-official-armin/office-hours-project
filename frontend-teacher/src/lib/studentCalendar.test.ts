// Shared: tests for what the student calendar shows.
import { describe, expect, it } from 'vitest'
import type { Booking, BookingRequest, Teacher } from '../types'
import {
  buildItems,
  chipText,
  dayStatus,
  hasBookingDot,
  itemSpoken,
  itemsByDate,
  teacherKey,
  tinyText,
} from './studentCalendar'

// Thursday 15 Oct 2026, 12:00 local time.
const NOW = new Date(2026, 9, 15, 12, 0, 0)
const TODAY = '2026-10-15'
const TUE = '2026-10-20'
const THU = '2026-10-22'

const teachers = (): Teacher[] => [
  {
    id: 'rivera',
    name: 'Ms. Rivera',
    subject: 'Mathematics',
    group: 'Math',
    max: 4,
    daysOff: [],
    timings: [
      { id: 'lunch', name: 'Lunch', start: '12:10', end: '12:40', days: [2, 4] },
      { id: 'after', name: 'After school', start: '15:30', end: '16:00', days: [2, 4] },
    ],
  },
  {
    id: 'okafor',
    name: 'Mr. Okafor',
    subject: 'Chemistry',
    group: 'Science',
    max: 4,
    daysOff: [],
    timings: [{ id: 'lunch', name: 'Lunch', start: '12:10', end: '12:40', days: [2, 5] }],
  },
]

let n = 0
const booking = (over: Partial<Booking> & Pick<Booking, 'date'>): Booking => {
  n += 1
  return {
    id: `b${n}`,
    teacherId: 'rivera',
    timingId: 'lunch',
    studentId: 'maya',
    studentName: 'Maya K.',
    reason: 'Help with the quiz',
    status: 'confirmed',
    createdAt: '2026-10-01T08:00:00.000Z',
    ...over,
  }
}
const request = (over: Partial<BookingRequest> & Pick<BookingRequest, 'date'>): BookingRequest => {
  n += 1
  return {
    id: `r${n}`,
    teacherId: 'rivera',
    studentId: 'maya',
    studentName: 'Maya K.',
    time: '15:45',
    reason: 'Need more time',
    status: 'pending',
    note: '',
    ...over,
  }
}

describe('bookings', () => {
  it('a confirmed upcoming booking is "booking" and can be cancelled', () => {
    const [item] = buildItems([booking({ date: TUE })], [], teachers(), NOW)
    expect(item).toMatchObject({
      kind: 'booking',
      source: 'booking',
      teacherName: 'Ms. Rivera',
      subject: 'Mathematics',
      timingName: 'Lunch',
      start: '12:10',
      end: '12:40',
      reason: 'Help with the quiz',
      flag: null,
      cancellable: true,
      initial: 'R',
    })
    expect(item.time).toBe('12:10 – 12:40 PM')
  })

  it('an office hour that already started, or a cancelled booking, is greyed and cannot be cancelled', () => {
    const late = new Date(2026, 9, 15, 12, 30)
    const items = buildItems([booking({ date: TODAY }), booking({ date: TUE, status: 'cancelled' })], [], teachers(), late)
    expect(items.map((i) => i.kind)).toEqual(['past', 'cancelled'])
    expect(items.every((i) => !i.cancellable)).toBe(true)
  })

  it('flags a booking when the teacher is out, and when the timing no longer runs that day', () => {
    const t = teachers()
    t[0].daysOff = [{ date: TUE, reason: 'Trip' }]
    t[0].timings[1] = { ...t[0].timings[1], days: [4] }
    const items = buildItems([booking({ date: TUE }), booking({ date: '2026-10-27', timingId: 'after' })], [], t, NOW)
    expect(items[0]).toMatchObject({ kind: 'disrupted', flag: 'Teacher is out that day', cancellable: true })
    expect(items[1]).toMatchObject({ kind: 'disrupted', flag: 'This office hour was moved' })
  })

  it('still shows a booking whose timing was removed (kept with no days)', () => {
    const t = teachers()
    t[0].timings[0] = { ...t[0].timings[0], days: [], gone: true }
    const [item] = buildItems([booking({ date: TUE })], [], t, NOW)
    expect(item).toMatchObject({ kind: 'disrupted', flag: 'This office hour was moved', timingName: 'Lunch' })
  })

  it('works across teachers and sorts by date then start time', () => {
    const items = buildItems(
      [
        booking({ date: THU, timingId: 'after' }),
        booking({ date: TUE, teacherId: 'okafor' }),
        booking({ date: THU }),
        booking({ date: TUE }),
      ],
      [],
      teachers(),
      NOW,
    )
    expect(items.map((i) => `${i.date} ${i.start} ${i.teacherId}`)).toEqual([
      `${TUE} 12:10 okafor`,
      `${TUE} 12:10 rivera`,
      `${THU} 12:10 rivera`,
      `${THU} 15:30 rivera`,
    ])
  })
})

describe('requests', () => {
  it('shows pending and accepted requests, with the request time, and drops declined ones', () => {
    const items = buildItems(
      [],
      [
        request({ date: TUE }),
        request({ date: THU, status: 'accepted', note: 'Ms. Rivera accepted this time.' }),
        request({ date: THU, status: 'declined' }),
      ],
      teachers(),
      NOW,
    )
    expect(items.map((i) => i.kind)).toEqual(['pending', 'accepted'])
    expect(items[0]).toMatchObject({ source: 'request', cancellable: true, time: '3:45 PM', end: null, timingName: null })
    expect(items[1]).toMatchObject({ cancellable: false, note: 'Ms. Rivera accepted this time.' })
  })

  it('a request whose time has passed is just "past"', () => {
    const [item] = buildItems([], [request({ date: TODAY, time: '09:00' })], teachers(), NOW)
    expect(item).toMatchObject({ kind: 'past', cancellable: false })
  })
})

describe('days', () => {
  const t = teachers()
  t[0].daysOff = [{ date: THU, reason: '' }]
  const items = buildItems(
    [booking({ date: TUE }), booking({ date: THU, timingId: 'after' })],
    [request({ date: '2026-10-21' })],
    t,
    NOW,
  )
  const byDate = itemsByDate(items)

  it('groups items by date', () => {
    expect([...byDate.keys()].sort()).toEqual([TUE, '2026-10-21', THU])
    expect(byDate.get(TUE)).toHaveLength(1)
  })

  it('colours a day by status: booked, needs attention, request only, empty, and past', () => {
    expect(dayStatus(byDate.get(TUE), TUE, TODAY)).toBe('open')
    expect(dayStatus(byDate.get(THU), THU, TODAY)).toBe('off')
    expect(dayStatus(byDate.get('2026-10-21'), '2026-10-21', TODAY)).toBe('none') // pending request only
    expect(dayStatus(undefined, '2026-10-23', TODAY)).toBe('none')
    expect(dayStatus(undefined, '2026-10-13', TODAY)).toBe('past')
    expect(dayStatus([{ ...items[0], kind: 'cancelled' }], TUE, TODAY)).toBe('past')
  })

  it('puts a dot on days with a booking only', () => {
    expect(hasBookingDot(byDate.get(TUE))).toBe(true)
    expect(hasBookingDot(byDate.get('2026-10-21'))).toBe(false)
    expect(hasBookingDot(undefined)).toBe(false)
    expect(hasBookingDot([{ ...items[0], kind: 'cancelled' }])).toBe(false)
  })
})

describe('labels', () => {
  const items = buildItems(
    [booking({ date: TUE }), booking({ date: TUE, teacherId: 'okafor' }), booking({ date: THU })],
    [request({ date: THU })],
    teachers(),
    NOW,
  )

  it('desktop chip, phone chip, and the phone key lists each teacher once', () => {
    const rivera = items.find((i) => i.teacherId === 'rivera')!
    expect(chipText(rivera)).toBe('Ms. Rivera · 12:10')
    expect(tinyText(rivera)).toBe('R 12:10')
    expect(teacherKey(items)).toBe('O = Mr. Okafor, R = Ms. Rivera')
    expect(teacherKey([])).toBe('')
  })

  it('describes items for a screen reader', () => {
    const okafor = items.find((i) => i.teacherId === 'okafor')!
    expect(itemSpoken(okafor)).toBe('Mr. Okafor Lunch')
    const pending = items.find((i) => i.source === 'request')!
    expect(itemSpoken(pending)).toBe('pending request with Ms. Rivera at 3:45 PM')
  })
})
