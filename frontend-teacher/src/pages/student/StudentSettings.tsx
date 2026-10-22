// Owner: Subgroup B (Teacher desktop UI). Purpose: the student's profile, which emails they get (simulated in the MVP),
// when the reminder is sent, a preview of the reminder, and the account actions.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Card, { CardTitle } from '../../components/common/Card'
import { ErrorText, Field, SelectInput, TextInput } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import AppearanceCard from '../../components/common/AppearanceCard'
import { EmailReminders, MailPreview } from '../../components/common/SettingsParts'
import { useToast } from '../../components/common/Toast'
import { myWorld, useStudentData } from '../../hooks/StudentData'
import { useAction } from '../../hooks/useAction'
import { useAuth } from '../../hooks/useAuth'
import { formatTime } from '../../lib/dates'
import { findTeacher, timingOf, upcomingBookings } from '../../lib/rules'
import type { StudentPrefs } from '../../types'

type Toggle = Exclude<keyof StudentPrefs, 'id' | 'name' | 'grade' | 'email' | 'lead'>

const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: 'remind', label: 'Reminder before each office hour', hint: 'So you remember your seat.' },
  { key: 'booked', label: 'My booking is confirmed', hint: 'One email each time you book a seat.' },
  { key: 'answer', label: 'A teacher answers my request', hint: 'Accepted or declined.' },
  { key: 'out', label: 'A teacher cancels or is out', hint: 'So you can rebook another time.' },
]

const GRADES = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
const linkText = 'font-bold text-link'

export default function StudentSettings() {
  const { data, now, saveSettings } = useStudentData()
  const { run, error, isPending } = useAction()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const s = data.settings

  const [name, setName] = useState(s.name)
  const [grade, setGrade] = useState(s.grade)
  const [email, setEmail] = useState(s.email)

  const world = myWorld(data)
  const next = upcomingBookings(world, () => true, now)[0]
  const nextTeacher = next ? findTeacher(world, next.teacherId) : undefined
  const nextTiming = next ? timingOf(world, next) : undefined
  const first = s.name.split(' ')[0]

  // Switches and the reminder time save as soon as they change, as in the design.
  const setPref = (patch: Partial<StudentPrefs>) => void run('pref', () => saveSettings({ ...s, ...patch }))

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
              <Field label="Grade">
                <SelectInput value={grade} onChange={(e) => setGrade(e.target.value)}>
                  {(GRADES.includes(grade) ? GRADES : [grade, ...GRADES]).map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </SelectInput>
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

          <AppearanceCard />
        </div>

        <div className="flex flex-[2_1_320px] flex-col gap-6">
          <Card aria-labelledby="preview-h" className="flex flex-col gap-3">
            <CardTitle id="preview-h">What a reminder looks like</CardTitle>
            {next && nextTeacher && nextTiming ? (
              <MailPreview subject={`Reminder: ${nextTeacher.group} office hour at ${formatTime(nextTiming.start)}`}>
                <p>
                  Hi {first}, your {nextTiming.name.toLowerCase()} office hour with {nextTeacher.name} starts in {s.lead}.
                </p>
                <div>
                  <strong className="text-ink">Seat {next.seat}</strong> &middot; {next.reason}
                </div>
                <Link to="/student/bookings" className={linkText}>
                  Open my bookings
                </Link>
              </MailPreview>
            ) : (
              <MailPreview subject="Reminder: office hour">
                <p>
                  Hi {first}, your office hour starts in {s.lead}.
                </p>
                <Link to="/student/bookings" className={linkText}>
                  Open my bookings
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
          onClick={() => void run('save', () => saveSettings({ ...s, name, grade, email }), 'Settings saved.')}
        >
          Save settings
        </Button>
      </div>
    </>
  )
}
