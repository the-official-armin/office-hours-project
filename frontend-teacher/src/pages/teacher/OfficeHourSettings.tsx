// Owner: Subgroup B (Teacher desktop UI). Purpose: edit the timings (name, times, days) and seats per office hour,
// with a live "Your week" preview. The backend enforces the rules; the UI pre-validates with src/lib/rules.ts.
// Existing bookings are never deleted: students on a moved or removed timing are told and asked to rebook.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Banner, { ConfirmBar } from '../../components/common/Banner'
import Button, { Pill } from '../../components/common/Button'
import Card, { CardTitle } from '../../components/common/Card'
import { Stepper } from '../../components/common/controls'
import { ErrorText, Field, TextInput } from '../../components/common/fields'
import Icon from '../../components/common/Icon'
import InlineEditableTitle from '../../components/common/InlineEditableTitle'
import PageHeader from '../../components/common/PageHeader'
import { IconButton } from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import { DOW_SHORT, formatTime, plural } from '../../lib/dates'
import { MAX_SEATS, MAX_TIMINGS, MIN_SEATS, minSeats, orphanedBookings, stepSeats, validateHours } from '../../lib/rules'
import type { Dow, Teacher, TimingDraft } from '../../types'

/** Colour for the n-th timing: swatch, and the pale block used in the preview. */
const COLORS = [
  { swatch: 'bg-brand', block: 'bg-tint text-tint-ink' },
  { swatch: 'bg-swatch-1', block: 'bg-amber text-amber-ink' },
  { swatch: 'bg-swatch-2', block: 'bg-blue text-blue-ink' },
  { swatch: 'bg-swatch-3', block: 'bg-violet text-violet-ink' },
]

const DAYS: Dow[] = [1, 2, 3, 4, 5]

const draftOf = (t: Teacher): TimingDraft[] =>
  t.timings.filter((x) => !x.gone).map((x) => ({ id: x.id, name: x.name, start: x.start, end: x.end, days: [...x.days] }))

let counter = 0
const newId = () => `tm${Date.now().toString(36)}${(counter++).toString(36)}`

function WeekPreview({ list, max }: { list: TimingDraft[]; max: number }) {
  const slots = list.reduce((sum, n) => sum + n.days.length, 0)
  return (
    <>
      <div className="grid grid-cols-5 gap-1.5">
        {DAYS.map((d) => {
          const items = list
            .map((n, i) => ({ n, i }))
            .filter((o) => o.n.days.includes(d))
            .sort((a, b) => (a.n.start || '').localeCompare(b.n.start || ''))
          return (
            <div key={d} className="flex min-w-0 flex-col gap-1.5">
              <div className="px-0.5 text-xs font-bold uppercase tracking-[.05em] text-muted">{DOW_SHORT[d]}</div>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line p-1.5 text-center text-[11.5px] text-muted">None</div>
              ) : (
                items.map((o) => (
                  <div
                    key={o.n.id}
                    className={`flex min-w-0 flex-col gap-px rounded-lg p-1.5 text-[11.5px] leading-[1.3] [overflow-wrap:anywhere] ${COLORS[o.i % 4].block}`}
                  >
                    <b className="text-xs font-extrabold">{o.n.name.trim() || 'Unnamed'}</b>
                    <span className="tabular-nums">{o.n.start ? formatTime(o.n.start) : 'No time'}</span>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
      <div className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold tabular-nums text-tint-ink">
        {plural(slots, 'office hour')} a week, {max} seats each: {slots * max} seats in total.
      </div>
    </>
  )
}

export default function OfficeHourSettings() {
  const { data, now, saveHours } = useTeacherData()
  const { run, error, setError, isPending } = useAction()
  const toast = useToast()
  const navigate = useNavigate()

  const t = data.teacher
  const [list, setList] = useState<TimingDraft[]>(() => draftOf(t))
  const [max, setMax] = useState(t.max)
  const [seatsNote, setSeatsNote] = useState(false)
  const [problem, setProblem] = useState('')
  const [confirm, setConfirm] = useState(0)
  const pendingFocus = useRef<string | null>(null)

  const inputs = useRef(new Map<string, HTMLInputElement | null>())
  const addRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Move focus after an add / remove / confirm, once the new element exists.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    const target = id === 'add' ? addRef.current : id === 'confirm' ? confirmRef.current : inputs.current.get(id)
    target?.focus()
  })

  const world = teacherWorld(data)
  const floor = minSeats(world, t.id, now)

  const touch = () => {
    setConfirm(0)
    setProblem('')
    setError(null)
  }

  const edit = (id: string, patch: Partial<TimingDraft>) => {
    touch()
    setList((l) => l.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }

  const toggleDay = (id: string, day: Dow) => {
    const n = list.find((x) => x.id === id)!
    edit(id, { days: n.days.includes(day) ? n.days.filter((d) => d !== day) : [...n.days, day].sort() as Dow[] })
  }

  const add = () => {
    if (list.length >= MAX_TIMINGS) return
    const id = newId()
    touch()
    setList((l) => [...l, { id, name: '', start: '07:45', end: '08:15', days: [] }])
    pendingFocus.current = id
  }

  const remove = (id: string) => {
    const i = list.findIndex((x) => x.id === id)
    const gone = list[i]
    const rest = list.filter((x) => x.id !== id)
    touch()
    setList(rest)
    pendingFocus.current = rest[i]?.id ?? rest[i - 1]?.id ?? 'add'
    toast(`${gone.name.trim() || 'Timing'} removed. Discard changes to undo.`)
  }

  const step = (delta: -1 | 1) => {
    const r = stepSeats(max, delta, floor)
    setSeatsNote(r.blocked)
    if (!r.blocked) setMax(r.max)
    touch()
  }

  const apply = async () => {
    const saved = await run('save', () => saveHours({ timings: list, max }), 'Office hours saved.')
    if (saved) {
      setConfirm(0)
      setProblem('')
      setList((l) => l.map((n) => ({ ...n, name: n.name.trim() })))
    }
  }

  const save = () => {
    const e = validateHours(list)
    setConfirm(0)
    setError(null)
    if (e) {
      setProblem(e)
      return
    }
    setProblem('')
    const n = orphanedBookings(world, t.id, list, now).length
    if (n > 0) {
      setConfirm(n)
      pendingFocus.current = 'confirm'
      return
    }
    void apply()
  }

  const discard = () => {
    setList(draftOf(t))
    setMax(t.max)
    touch()
    setSeatsNote(false)
    toast('Changes discarded.')
    navigate('/teacher')
  }

  return (
    <>
      <PageHeader
        title="Office hours"
        subtitle="Add each time you hold office hours. Click a name to rename it, then pick the days it runs."
      />

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <div className="flex flex-[3_1_440px] flex-col gap-4">
          {list.length === 0 && <Banner kind="warn">You have no timings yet, so students can&rsquo;t book you.</Banner>}

          {list.map((n, i) => (
            <Card key={n.id} aria-label={`Timing ${i + 1}`} className="flex flex-col gap-[18px]">
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden="true" className={`h-3.5 w-3.5 flex-none rounded ${COLORS[i % 4].swatch}`} />
                <InlineEditableTitle
                  label="Timing name"
                  value={n.name}
                  onChange={(name) => edit(n.id, { name })}
                  inputRef={(el) => {
                    inputs.current.set(n.id, el)
                  }}
                />
                <span className="flex-1" />
                <IconButton ghost aria-label={`Remove ${n.name.trim() || 'this timing'}`} title="Remove" onClick={() => remove(n.id)}>
                  <Icon name="trash" size={18} />
                </IconButton>
              </div>
              <div className="flex flex-wrap gap-3 [&>*]:flex-[1_1_160px]">
                <Field label="Starts">
                  <TextInput type="time" value={n.start} onChange={(e) => edit(n.id, { start: e.target.value })} />
                </Field>
                <Field label="Ends">
                  <TextInput type="time" value={n.end} onChange={(e) => edit(n.id, { end: e.target.value })} />
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold text-ink2">Days</span>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <Pill key={d} pressed={n.days.includes(d)} className="min-w-14 !px-3" onClick={() => toggleDay(n.id, d)}>
                      {DOW_SHORT[d]}
                    </Pill>
                  ))}
                </div>
              </div>
            </Card>
          ))}

          {list.length < MAX_TIMINGS ? (
            <button
              ref={addRef}
              type="button"
              onClick={add}
              className={`flex w-full items-center gap-3.5 rounded-2xl px-5 py-[18px] text-left hover:border-brand ${
                list.length === 0
                  ? 'border-[1.5px] border-solid border-brand bg-tint text-tint-ink'
                  : 'border-[1.5px] border-dashed border-edge bg-transparent text-link hover:bg-surface'
              }`}
            >
              <Icon name="plus" strokeWidth={2} />
              <span>
                <b className="block text-[15px] font-extrabold">{list.length ? 'Add another timing' : 'Create your first timing'}</b>
                <small className="mt-0.5 block text-[13px] text-muted">
                  {list.length ? `For example, before school. You can have up to ${MAX_TIMINGS}.` : 'Name it, set the time and pick its days.'}
                </small>
              </span>
            </button>
          ) : (
            <p className="text-[13px] text-muted">You have the most timings allowed ({MAX_TIMINGS}). Remove one to add another.</p>
          )}
        </div>

        <div className="flex flex-[2_1_300px] flex-col gap-6">
          <Card aria-labelledby="wk-h" className="flex flex-col gap-4">
            <div>
              <CardTitle id="wk-h">Your week</CardTitle>
              <p className="mt-1 text-[13px] text-muted">Updates as you edit. Students see it after you save.</p>
            </div>
            <div className="flex flex-col gap-4">
              <WeekPreview list={list} max={max} />
            </div>
          </Card>

          <Card aria-labelledby="seats-h" className="flex flex-col gap-4">
            <CardTitle id="seats-h">Seats per office hour</CardTitle>
            <Stepper value={max} min={MIN_SEATS} max={MAX_SEATS} onStep={step} lessLabel="One fewer seat" moreLabel="One more seat">
              students at most. The default is 4.
            </Stepper>
            {seatsNote && floor > 1 && max <= floor && (
              <p className="rounded-lg bg-amber px-3 py-2 text-[13px] font-semibold text-amber-ink">
                {floor} is the lowest right now. A student already holds Seat {floor} in an upcoming office hour.
              </p>
            )}
          </Card>
        </div>
      </div>

      <ErrorText>{problem || error}</ErrorText>
      {confirm > 0 && (
        <ConfirmBar message={`${plural(confirm, 'booking is', 'bookings are')} on times you no longer hold. Students will be told and asked to rebook.`}>
          <Button ref={confirmRef} variant="primary" loading={isPending('save')} onClick={() => void apply()}>
            Save and tell students
          </Button>
          <Button disabled={isPending('save')} onClick={() => setConfirm(0)}>
            Go back
          </Button>
        </ConfirmBar>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={discard}>Discard changes</Button>
        <Button variant="primary" className="!px-[22px]" loading={isPending('save') && confirm === 0} onClick={save}>
          Save office hours
        </Button>
      </div>
    </>
  )
}
