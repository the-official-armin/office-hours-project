// Shared: tests for the wording helpers.
import { describe, expect, it } from 'vitest'
import type { Teacher } from '../types'
import { daysText, teacherInitial, timesText } from './text'

const t = (timings: Teacher['timings']): Teacher => ({ id: 'x', name: 'Ms. X', subject: 'S', group: 'G', max: 4, daysOff: [], timings })

describe('text helpers', () => {
  it('lists days as a sentence', () => {
    expect(daysText(t([]))).toBe('No days set')
    expect(daysText(t([{ id: 'a', name: 'A', start: '08:00', end: '09:00', days: [2] }]))).toBe('Tuesday')
    expect(
      daysText(
        t([
          { id: 'a', name: 'A', start: '08:00', end: '09:00', days: [5, 2] },
          { id: 'b', name: 'B', start: '10:00', end: '11:00', days: [3, 2] },
        ]),
      ),
    ).toBe('Tuesday, Wednesday and Friday')
  })

  it('lists times earliest first and leaves out removed timings', () => {
    const text = timesText(
      t([
        { id: 'b', name: 'After school', start: '15:30', end: '16:00', days: [2] },
        { id: 'a', name: 'Lunch', start: '12:10', end: '12:40', days: [2] },
        { id: 'c', name: 'Old', start: '07:00', end: '07:30', days: [], gone: true },
      ]),
    )
    expect(text).toBe('Lunch 12:10 \u2013 12:40 PM \u00b7 After school 3:30 \u2013 4:00 PM')
  })

  it('takes initials without the title', () => {
    expect(teacherInitial('Dr. Lindqvist')).toBe('L')
    expect(teacherInitial('Ms. Rivera')).toBe('R')
    expect(teacherInitial('Mr. Jo Tanaka')).toBe('JT')
  })
})
