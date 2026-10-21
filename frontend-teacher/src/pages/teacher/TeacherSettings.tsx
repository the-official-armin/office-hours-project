// Owner: Subgroup B (Teacher desktop UI). Purpose: profile, which emails the teacher gets (simulated in the MVP),
// when the reminder is sent, a preview of the reminder, and the account actions.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Card, { CardTitle } from '../../components/common/Card'
import { ErrorText, Field, TextInput } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { EmailReminders, MailPreview } from '../../components/common/SettingsParts'
import { useToast } from '../../components/common/Toast'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import { useAuth } from '../../hooks/useAuth'
import { formatTime, plural, toISODate } from '../../lib/dates'
import { listSlots } from '../../lib/rules'
import type { TeacherPrefs } from '../../types'

type Toggle = Exclude<keyof TeacherPrefs, 'email' | 'lead'>

const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: 'remind', label: 'Reminder before each office hour', hint: 'Lists the students who booked that slot.' },
  { key: 'booking', label: 'A student books a seat', hint: 'One email each time a seat is taken.' },
  { key: 'cancel', label: 'A student cancels', hint: 'So you know when a seat opens up.' },
  { key: 'request', label: 'A student sends a request', hint: 'For times outside your office hours.' },
  { key: 'morning', label: 'Morning summary', hint: 'One email on days you hold office hours.' },
]

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

          <EmailReminders
            toggles={TOGGLES}
            values={s}
            lead={s.lead}
            showLead={s.remind}
            onToggle={(key, v) => setPref({ [key]: v })}
            onLead={(lead) => setPref({ lead })}
          />
        </div>

        <div className="flex flex-[2_1_320px] flex-col gap-6">
          <Card aria-labelledby="preview-h" className="flex flex-col gap-3">
            <CardTitle id="preview-h">What a reminder looks like</CardTitle>
            {next ? (
              <MailPreview subject={`Office hours at ${formatTime(next.row.timing.start)}, ${plural(next.row.taken, 'student')} booked`}>
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
              </MailPreview>
            ) : (
              <MailPreview subject="Office hours today">
                <p>
                  Hi {s.name}, your office hour starts in {s.lead}. No one has booked yet.
                </p>
                <Link to="/teacher/calendar" className={linkText}>
                  Open calendar
                </Link>
              </MailPreview>
            )}
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
