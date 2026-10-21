// Owner: Subgroup B (Teacher desktop UI). Local implementation of the Student API, backed by store.ts.
// The signed-in student in mock mode is ME_STUDENT. Every action tells the teacher (when it is ME_TEACHER).
import type { Booking, BookingRequest, Note, StudentSettings, Teacher } from '../../types'
import { formatDateShort, formatTime } from '../../lib/dates'
import { checkBooking, checkBookingReason, checkRequest, findTeacher, hasStarted, timingOf } from '../../lib/rules'
import { RuleError } from '../errors'
import { assertOk, delay, pushNote, worldOf } from './actions'
import { ME_STUDENT, ME_TEACHER } from './seed'
import { getState, mutate, nextId } from './store'

export interface BookSeatInput {
  teacherId: string
  date: string
  timingId: string
  seat: number
  reason: string
}

export interface SendRequestInput {
  teacherId: string
  date: string
  time: string
  reason: string
}

export const mockStudentApi = {
  async getTeachers(): Promise<Teacher[]> {
    await delay()
    return getState().teachers
  },

  /**
   * Every confirmed booking of every teacher, so seat grids and "open seats" can count seats. Other students'
   * names and reasons are removed: a student only learns that a seat is taken, never by whom.
   */
  async getSeatBookings(): Promise<Booking[]> {
    await delay()
    return getState()
      .bookings.filter((b) => b.status === 'confirmed')
      .map((b) => (b.studentId === ME_STUDENT ? b : { ...b, studentName: '', reason: '' }))
  },

  /** This student's bookings, including cancelled ones. */
  async getBookings(): Promise<Booking[]> {
    await delay()
    return getState().bookings.filter((b) => b.studentId === ME_STUDENT)
  },

  async getRequests(): Promise<BookingRequest[]> {
    await delay()
    return getState().requests.filter((r) => r.studentId === ME_STUDENT)
  },

  async bookSeat(input: BookSeatInput): Promise<Booking> {
    await delay()
    return mutate((d) => {
      if (!Number.isInteger(input.seat) || input.seat < 1) throw new RuleError('bad_seat', 'Pick a seat first.')
      assertOk(checkBookingReason(input.reason))
      assertOk(checkBooking(worldOf(d), { ...input, studentId: ME_STUDENT }, new Date()))
      const t = findTeacher(worldOf(d), input.teacherId)!
      const x = t.timings.find((y) => y.id === input.timingId)!
      const booking: Booking = {
        id: nextId(d, 'b'),
        teacherId: t.id,
        date: input.date,
        timingId: x.id,
        seat: input.seat,
        studentId: ME_STUDENT,
        studentName: d.studentPrefs.name,
        reason: input.reason.trim(),
        status: 'confirmed',
      }
      d.bookings.push(booking)
      if (t.id === ME_TEACHER) {
        pushNote(d, 'teacher', `${booking.studentName} booked Seat ${booking.seat} in ${x.name} on ${formatDateShort(booking.date)}.`, d.teacherPrefs.booking)
      }
      return booking
    })
  },

  async cancelBooking(id: string): Promise<void> {
    await delay()
    mutate((d) => {
      const b = d.bookings.find((x) => x.id === id && x.studentId === ME_STUDENT && x.status === 'confirmed')
      if (!b) throw new RuleError('not_found', 'That booking was already cancelled.')
      const x = timingOf(worldOf(d), b)
      if (x && hasStarted(b.date, x.start, new Date())) throw new RuleError('past', 'That office hour has already started.')
      b.status = 'cancelled'
      if (b.teacherId === ME_TEACHER) {
        pushNote(
          d,
          'teacher',
          `${b.studentName} cancelled Seat ${b.seat} in ${x?.name ?? 'an office hour'} on ${formatDateShort(b.date)}. The seat is open again.`,
          d.teacherPrefs.cancel,
        )
      }
    })
  },

  async sendRequest(input: SendRequestInput): Promise<BookingRequest> {
    await delay()
    return mutate((d) => {
      assertOk(checkRequest(worldOf(d), input, new Date()))
      const request: BookingRequest = {
        id: nextId(d, 'r'),
        teacherId: input.teacherId,
        studentId: ME_STUDENT,
        studentName: d.studentPrefs.name,
        date: input.date,
        time: input.time,
        reason: input.reason.trim(),
        status: 'pending',
        note: '',
      }
      d.requests.push(request)
      if (input.teacherId === ME_TEACHER) {
        pushNote(d, 'teacher', `${request.studentName} sent a request for ${formatDateShort(request.date)} at ${formatTime(request.time)}.`, d.teacherPrefs.request)
      }
      return request
    })
  },

  async cancelRequest(id: string): Promise<void> {
    await delay()
    mutate((d) => {
      const r = d.requests.find((x) => x.id === id && x.studentId === ME_STUDENT && x.status === 'pending')
      if (!r) throw new RuleError('not_found', 'That request was already answered.')
      d.requests = d.requests.filter((x) => x.id !== id)
      if (r.teacherId === ME_TEACHER) {
        pushNote(d, 'teacher', `${r.studentName} cancelled the request for ${formatDateShort(r.date)}.`, d.teacherPrefs.request)
      }
    })
  },

  async getSettings(): Promise<StudentSettings> {
    await delay()
    return getState().studentPrefs
  },

  async saveSettings(input: StudentSettings): Promise<StudentSettings> {
    await delay()
    if (!input.name.trim()) throw new RuleError('invalid', 'Enter a name first.')
    if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
      throw new RuleError('invalid', 'Enter a valid email address.')
    }
    return mutate((d) => {
      d.studentPrefs = { ...input, id: d.studentPrefs.id, name: input.name.trim(), grade: input.grade.trim(), email: input.email.trim() }
      return d.studentPrefs
    })
  },

  async getNotes(): Promise<Note[]> {
    await delay()
    return getState().notes.student
  },

  async markNotesRead(): Promise<void> {
    await delay()
    mutate((d) => {
      d.notes.student = d.notes.student.map((n) => ({ ...n, read: true }))
    })
  },
}
