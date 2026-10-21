// Owner: Subgroup B (Teacher desktop UI). End-to-end walk through the demo scenario at the API level.
// Runs without a browser: the store falls back to memory when localStorage is unavailable.
import { describe, expect, it } from 'vitest'
import { addDays, parseISODate, toISODate } from '../../lib/dates'
import { RuleError } from '../errors'
import { getRole, login, logout } from '../auth'
import { mockTeacherApi as api } from './mockTeacher'
import { createDemoBooking, createDemoRequest, resetDemoData, runReminders } from './demo'
import { getState } from './store'

describe('demo scenario', () => {
  it('walks the whole flow', { timeout: 60_000 }, async () => {
    const now = new Date()
    const today = toISODate(now)
    const from = toISODate(addDays(parseISODate(today), -14))
    const to = toISODate(addDays(parseISODate(today), 42))

    // 1. login
    expect(getRole()).toBeNull()
    expect(getRole()).toBeNull()
    await login('teacher')
    expect(getRole()).toBe('teacher')

    // 2. day off on a date that already has bookings
    const seedBookings = await api.getBookings()
    const seedRequests = await api.getRequests()
    expect(seedBookings.length).toBeGreaterThan(0)
    expect(seedRequests).toHaveLength(3)
    const bookedDate = seedBookings.find((b) => !getState().daysOff.some((d) => d.date === b.date))!.date
    const preview = await api.previewDayOff(bookedDate)
    expect(preview.affectedBookings).toBeGreaterThan(0)
    await api.addDayOff({ date: bookedDate, reason: 'Test day off' })
    expect((await api.getBookings()).length).toBe(seedBookings.length) // bookings kept

    // 3. rules through the demo "student"
    const slots = await api.getSlots(from, to)
    const full = slots.find((s) => s.booked >= s.maxStudents && s.date >= today && !getState().daysOff.some((d) => d.date === s.date))!
    await expect(createDemoBooking({ slotId: full.id, studentName: 'Zed', reason: 'x' })).rejects.toMatchObject({
      code: 'full',
    })
    const past = slots.find((s) => new Date(`${s.date}T${s.start}:00`) <= now)!
    await expect(createDemoBooking({ slotId: past.id, studentName: 'Zed', reason: 'x' })).rejects.toMatchObject({
      code: 'past',
    })
    const dayOffSlot = slots.find((s) => s.date === bookedDate)!
    await expect(createDemoBooking({ slotId: dayOffSlot.id, studentName: 'Zed', reason: 'x' })).rejects.toBeInstanceOf(
      RuleError,
    )
    const open = (s: (typeof slots)[number]) =>
      s.booked < s.maxStudents &&
      new Date(`${s.date}T${s.start}:00`) > now &&
      !getState().daysOff.some((d) => d.date === s.date)
    const target = slots.find(open)!
    const before = await api.getNotifications()
    const created = await createDemoBooking({ slotId: target.id, studentName: 'Zed', reason: 'Quiz help' })
    expect(created.slotId).toBe(target.id)
    const after = await api.getNotifications()
    expect(after.length).toBe(before.length + 1)
    expect(after[0].type).toBe('booking')
    const refreshed = (await api.getSlots(target.date, target.date)).find((s) => s.id === target.id)!
    expect(refreshed.booked).toBe(target.booked + 1)

    // 4. accept one request, decline another
    // The new day off blocks requests for that date (rule 2), so accept one on another day.
    const [toAccept, toDecline] = seedRequests.filter((r) => r.date !== bookedDate)
    const accepted = await api.acceptRequest(toAccept.id)
    expect(accepted.slotId).toBeNull()
    await api.declineRequest(toDecline.id)
    expect(await api.getRequests()).toHaveLength(1)
    expect((await api.getBookings()).some((b) => b.id === accepted.id)).toBe(true)

    // 5. schedule change keeps bookings and warns
    const view = await api.getSchedule()
    const bookingCount = (await api.getBookings()).length
    const tight = await api.saveSchedule({ ...view.schedule, seatsPerOfficeHour: 1 })
    expect(tight.warnings.length).toBeGreaterThan(0)
    expect((await api.getBookings()).length).toBe(bookingCount)
    const wider = await api.saveSchedule({ ...view.schedule, seatsPerOfficeHour: 6 })
    expect(wider.warnings).toHaveLength(0)

    // 6. notification preference off => no new notification
    const prefs = await api.getReminderPrefs()
    const profile = await api.getMe()
    await api.saveSettings({ profile, prefs: { ...prefs, studentBooks: false } })
    const open2 = (await api.getSlots(from, to)).find(open)!
    const n1 = (await api.getNotifications()).length
    await createDemoBooking({ slotId: open2.id, studentName: 'Quiet', reason: 'No email please' })
    expect((await api.getNotifications()).length).toBe(n1)

    // requests outside the rules are rejected too
    await expect(
      createDemoRequest({ date: from, start: '10:00', studentName: 'Late', reason: '' }),
    ).rejects.toMatchObject({ code: 'past' })

    // reminders are deduplicated
    await runReminders()
    const r1 = (await api.getNotifications()).length
    await runReminders()
    expect((await api.getNotifications()).length).toBe(r1)

    // 7. logout
    logout()
    expect(getRole()).toBeNull()

    // 8. reset
    await resetDemoData()
    expect((await api.getBookings()).length).toBe(seedBookings.length)
    expect(await api.getRequests()).toHaveLength(3)
    expect(await api.getNotifications()).toHaveLength(0)
    expect(getRole()).toBeNull() // reset keeps the current login state
  })
})
