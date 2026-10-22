// Shared: tests for which sidebar item counts as "current".
import { describe, expect, it } from 'vitest'
import { isCurrent, NAV_TREE, isGroup } from './nav'

const requests = { to: '/teacher/requests?tab=requests', defaultTab: true }
const booked = { to: '/teacher/requests?tab=bookings' }

describe('isCurrent', () => {
  it('matches a plain path exactly', () => {
    expect(isCurrent({ to: '/teacher' }, '/teacher', '')).toBe(true)
    expect(isCurrent({ to: '/teacher' }, '/teacher/calendar', '')).toBe(false)
  })

  it('treats the default tab as current when the URL has no tab', () => {
    expect(isCurrent(requests, '/teacher/requests', '')).toBe(true)
    expect(isCurrent(booked, '/teacher/requests', '')).toBe(false)
  })

  it('follows ?tab= when present', () => {
    expect(isCurrent(booked, '/teacher/requests', '?tab=bookings')).toBe(true)
    expect(isCurrent(requests, '/teacher/requests', '?tab=bookings')).toBe(false)
  })

  it('matches nested paths only when prefix is set', () => {
    const teachers = { to: '/student/teachers', prefix: true }
    expect(isCurrent(teachers, '/student/teachers/rivera', '')).toBe(true)
    expect(isCurrent({ to: '/student/teachers' }, '/student/teachers/rivera', '')).toBe(false)
  })

  it('has unique ids and a link target for every nav entry', () => {
    for (const role of ['teacher', 'student'] as const) {
      const ids = NAV_TREE[role].flatMap((n) => (isGroup(n) ? [n.id, ...n.kids.map((k) => k.id)] : [n.id]))
      expect(new Set(ids).size).toBe(ids.length)
      for (const n of NAV_TREE[role]) {
        const targets = isGroup(n) ? n.kids.map((k) => k.to) : [n.to]
        targets.forEach((t) => expect(t.startsWith(`/${role}`)).toBe(true))
      }
    }
  })
})
