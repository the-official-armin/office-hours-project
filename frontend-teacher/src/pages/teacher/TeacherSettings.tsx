// Owner: Subgroup B (Teacher desktop UI). Purpose: profile, which emails the teacher gets (simulated in the MVP),
// when the reminder is sent, a preview of the reminder, and the account actions.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button, { Pill } from '../../components/common/Button'
import Card, { CardTitle } from '../../components/common/Card'
import { Switch } from '../../components/common/controls'
import { ErrorText, Field, TextInput } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { useToast } from '../../components/common/Toast'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import { useAuth } from '../../hooks/useAuth'
import { formatTime, plural, toISODate } from '../../lib/dates'
import { listSlots } from '../../lib/rules'
import type { ReminderLead, TeacherPrefs } from '../../types'

type Toggle = Exclude<keyof TeacherPrefs, 'email' | 'lead'>

const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: 'remind', label: 'Reminder before each office hour', hint: 'Lists the students who booked that slot.' },
  { key: 'booking', label: 'A student books a seat', hint: 'One email each time a seat is taken.' },
  { key: 'cancel', label: 'A student cancels', hint: 'So you know when a seat opens up.' },
  { key: 'request', label: 'A student sends a request', hint: 'For times outside your office hours.' },
  { key: 'morning', label: 'Morning summary', hint: 'One email on days you hold office hours.' },
]

const LEADS: ReminderLead[] = ['30 minutes', '1 hour', '1 day']

const linkText = 'font-bold text-link'

export default function TeacherSettings() {
  const { data, now, saveSettings } = useTeacherData()
  const { run, error, isPending } = useAction()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const s = data.settings

  const [name, setName] = useState(s.name)
  const [subject, setSubject] = useState(s.subject)
  const [email, setEmail] = useState(s.email)

  const world = teacherWorld(data)
  const next = listSlots(world, data.teacher, toISODate(now), 60, now).find((o) => o.row.taken > 0)

  // Switches and the reminder time save as soon as they change, as in the design.
  const setPref = (patch: Partial<TeacherPrefs>) => void run('pref', () => saveSettings({ ...s, ...patch }))

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile and which emails you get." />

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <div className="flex flex-[3_1_460px] flex-col gap-6">
          <Card aria-labelledby="profile-h" className="flex flex-col gap-4">
            <CardTitle id="profile-h">Profile</CardTitle>
            <div className="flex flex-wrap gap-4 [&>*]:flex-[1_1_200px]">
              <Field label="Name">
                <TextInput type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Subject">
                <TextInput type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
            </div>
            <Field label="Email for reminders">
              <TextInput type="email" placeholder="your school email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </Card>

          <Card aria-labelledby="mail-h">
            <h2 id="mail-h" className="pb-2 text-lg font-extrabold">
              Email reminders
            </h2>
            {TOGGLES.map((x) => (
              <div key={x.key} className="flex items-center gap-4 border-t border-line py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{x.label}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{x.hint}</div>
                </div>
                <Switch label={x.label} checked={s[x.key]} onChange={(v) => setPref({ [x.key]: v })} />
              </div>
            ))}
            {s.remind && (
              <div className="flex flex-col gap-2 border-t border-line pt-3.5">
                <span id="lead-h" className="text-[13px] font-bold text-ink2">
                  Send the reminder before the office hour
                </span>
                <div role="group" aria-labelledby="lead-h" className="flex flex-wrap gap-2">
                  {LEADS.map((l) => (
                    <Pill key={l} pressed={s.lead === l} onClick={() => setPref({ lead: l })}>
                      {l}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-[2_1_320px] flex-col gap-6">
          <Card aria-labelledby="preview-h" className="flex flex-col gap-3">
            <CardTitle id="preview-h">What a reminder looks like</CardTitle>
            <div className="overflow-hidden rounded-xl border border-line">
              {next ? (
                <>
                  <div className="bg-soft px-4 py-3 text-[13px] text-muted">
                    Subject:{' '}
                    <b className="text-ink">
                      Office hours at {formatTime(next.row.timing.start)}, {plural(next.row.taken, 'student')} booked
                    </b>
                  </div>
                  <div className="flex flex-col gap-2.5 p-4 text-sm leading-[1.6] text-ink2">
                    <p>
                      Hi {s.name}, your {next.row.timing.name.toLowerCase()} office hour starts in {s.lead}.
                    </p>
                    <div className="flex flex-col gap-1">
                      {next.row.bookings.map((b) => (
                        <span key={b.id}>
                          <strong className="text-ink">{b.studentName}</strong> &middot; {b.reason}
                        </span>
                      ))}
                    </div>
                    <Link to="/teacher/calendar" className={linkText}>
                      Open calendar
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-soft px-4 py-3 text-[13px] text-muted">
                    Subject: <b className="text-ink">Office hours today</b>
                  </div>
                  <div className="flex flex-col gap-2.5 p-4 text-sm leading-[1.6] text-ink2">
                    <p>
                      Hi {s.name}, your office hour starts in {s.lead}. No one has booked yet.
                    </p>
                    <Link to="/teacher/calendar" className={linkText}>
                      Open calendar
                    </Link>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card aria-labelledby="acct-h" className="flex flex-col gap-3">
            <CardTitle id="acct-h">Account</CardTitle>
            <p className="text-muted">Signed in as {s.name}.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => toast('Changing a password isn’t part of this preview.')}>Change password</Button>
              <Button
                variant="danger"
                onClick={() => {
                  logout()
                  navigate('/login', { replace: true })
                }}
              >
                Log out
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button
          variant="primary"
          className="!px-[22px]"
          loading={isPending('save')}
          onClick={() => void run('save', () => saveSettings({ ...s, name, subject, email }), 'Settings saved.')}
        >
          Save settings
        </Button>
      </div>
    </>
  )
}
