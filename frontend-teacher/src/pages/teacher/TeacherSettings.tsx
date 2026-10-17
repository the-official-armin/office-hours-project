// Owner: Subgroup B (Teacher desktop UI). Purpose: profile and email reminder preferences (emails are simulated in the MVP).
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/teacher/Button'
import FormInput from '../../components/teacher/FormInput'
import { Card, FeedbackMessage, PageHeader } from '../../components/teacher/ui'
import { useAuth } from '../../hooks/useAuth'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { combine, formatTime } from '../../lib/dates'
import type { ReminderPrefs, TeacherProfile } from '../../types'

type BooleanPref = Exclude<keyof ReminderPrefs, 'leadMinutes'>

const TOGGLES: { key: BooleanPref; title: string; hint: string }[] = [
  { key: 'beforeOfficeHour', title: 'Reminder before each office hour', hint: 'Lists the students who booked that slot.' },
  { key: 'studentBooks', title: 'A student books a seat', hint: 'One email each time a seat is taken.' },
  { key: 'studentCancels', title: 'A student cancels', hint: 'So you know when a seat opens up.' },
  { key: 'studentRequests', title: 'A student sends a request', hint: 'For times outside your office hours.' },
  { key: 'morningSummary', title: 'Morning summary', hint: 'One email on days you hold office hours.' },
]

const LEADS = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 1440, label: '1 day' },
]

function leadText(minutes: number): string {
  return minutes === 1440 ? '1 day' : minutes === 60 ? '1 hour' : `${minutes} minutes`
}

export default function TeacherSettings() {
  const { data, now, saveSettings } = useTeacherData()
  const { run, feedback, isPending } = useAsyncAction()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<TeacherProfile>(data.profile)
  const [prefs, setPrefs] = useState<ReminderPrefs>(data.prefs)

  const dirty =
    JSON.stringify({ profile, prefs }) !== JSON.stringify({ profile: data.profile, prefs: data.prefs })

  // Preview uses the next real office hour that has bookings.
  const sample = data.slots.find((s) => s.booked > 0 && combine(s.date, s.start) > now)
  const sampleStudents = sample ? data.bookings.filter((b) => b.slotId === sample.id).slice(0, 3) : []

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and which emails you get." />

      <div className="grid grid-cols-[1.4fr_1fr] items-start gap-5">
        <div className="space-y-5">
          <Card>
            <h2 className="mb-4 text-lg font-extrabold">Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <FormInput
                label="Subject"
                value={profile.subject}
                onChange={(e) => setProfile({ ...profile, subject: e.target.value })}
              />
              <div className="col-span-2">
                <FormInput
                  label="Email for reminders"
                  type="email"
                  placeholder="your school email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-extrabold">Email reminders</h2>
            <ul>
              {TOGGLES.map((t) => (
                <li key={t.key} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0">
                  <div>
                    <p id={`pref-${t.key}`} className="font-bold">{t.title}</p>
                    <p className="text-sm text-muted">{t.hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[t.key]}
                    aria-labelledby={`pref-${t.key}`}
                    onClick={() => setPrefs({ ...prefs, [t.key]: !prefs[t.key] })}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs[t.key] ? 'bg-brand' : 'bg-muted/50'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface transition-all ${prefs[t.key] ? 'left-[22px]' : 'left-0.5'}`}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <fieldset className="mt-3 border-t border-line pt-4">
              <legend className="mb-2 text-sm font-semibold">Send the reminder before the office hour</legend>
              <div className="flex gap-2">
                {LEADS.map((l) => (
                  <button
                    key={l.minutes}
                    type="button"
                    aria-pressed={prefs.leadMinutes === l.minutes}
                    onClick={() => setPrefs({ ...prefs, leadMinutes: l.minutes })}
                    className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                      prefs.leadMinutes === l.minutes ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:bg-canvas'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg font-extrabold">What a reminder looks like</h2>
            <div className="rounded-xl border border-line text-sm">
              {sample ? (
                <>
                  <p className="rounded-t-xl bg-canvas px-4 py-2 text-muted">
                    Subject:{' '}
                    <span className="font-bold text-ink">
                      Office hours at {formatTime(sample.start)}, {sample.booked} student{sample.booked === 1 ? '' : 's'} booked
                    </span>
                  </p>
                  <div className="space-y-1 px-4 py-3">
                    <p>
                      Hi {profile.name}, your {sample.name.toLowerCase()} office hour starts in {leadText(prefs.leadMinutes)}.
                    </p>
                    {sampleStudents.map((b) => (
                      <p key={b.id}>
                        <span className="font-bold">{b.studentName}</span> <span className="text-muted">&middot; {b.reason}</span>
                      </p>
                    ))}
                    <Link to="/teacher/calendar" className="inline-block pt-1 font-bold text-brand hover:underline">
                      Open calendar
                    </Link>
                  </div>
                </>
              ) : (
                <p className="px-4 py-4 text-muted">
                  No upcoming office hour has bookings yet. A preview appears here once a student books.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-extrabold">Account</h2>
            <p className="text-sm text-muted">Signed in as {data.profile.name}.</p>
            <div className="mt-3 flex gap-3">
              <Button variant="secondary" disabled title="Password changes are handled by the auth team.">
                Change password
              </Button>
              <Button variant="danger" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <FeedbackMessage feedback={feedback} />
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={!dirty || isPending('save')}
            onClick={() => {
              setProfile(data.profile)
              setPrefs(data.prefs)
            }}
          >
            Discard changes
          </Button>
          <Button
            disabled={!dirty}
            loading={isPending('save')}
            onClick={() => run('save', () => saveSettings({ profile, prefs }), 'Settings saved.')}
          >
            Save settings
          </Button>
        </div>
      </div>
    </div>
  )
}
