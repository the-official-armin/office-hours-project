// Shared: changes need a PR note and a teammate review.
// Purpose: the Settings pieces both roles use: the email-reminder card (switches + reminder time) and the mail preview.
import type { ReactNode } from 'react'
import type { ReminderLead } from '../../types'
import { Pill } from './Button'
import Card from './Card'
import { Switch } from './controls'

const LEADS: ReminderLead[] = ['30 minutes', '1 hour', '1 day']

interface RemindersProps<K extends string> {
  toggles: { key: K; label: string; hint: string }[]
  values: Record<K, boolean>
  lead: ReminderLead
  /** The reminder time only matters while "reminder before each office hour" is on. */
  showLead: boolean
  onToggle: (key: K, next: boolean) => void
  onLead: (lead: ReminderLead) => void
}

export function EmailReminders<K extends string>({ toggles, values, lead, showLead, onToggle, onLead }: RemindersProps<K>) {
  return (
    <Card aria-labelledby="mail-h">
      <h2 id="mail-h" className="pb-2 text-lg font-extrabold">
        Email reminders
      </h2>
      {toggles.map((x) => (
        <div key={x.key} className="flex items-center gap-4 border-t border-line py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">{x.label}</div>
            <div className="mt-0.5 text-[13px] text-muted">{x.hint}</div>
          </div>
          <Switch label={x.label} checked={values[x.key]} onChange={(v) => onToggle(x.key, v)} />
        </div>
      ))}
      {showLead && (
        <div className="flex flex-col gap-2 border-t border-line pt-3.5">
          <span id="lead-h" className="text-[13px] font-bold text-ink2">
            Send the reminder before the office hour
          </span>
          <div role="group" aria-labelledby="lead-h" className="flex flex-wrap gap-2">
            {LEADS.map((l) => (
              <Pill key={l} pressed={lead === l} onClick={() => onLead(l)}>
                {l}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** A mock email: a subject line over a body. */
export function MailPreview({ subject, children }: { subject: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="bg-soft px-4 py-3 text-[13px] text-muted">
        Subject: <b className="text-ink">{subject}</b>
      </div>
      <div className="flex flex-col gap-2.5 p-4 text-sm leading-[1.6] text-ink2">{children}</div>
    </div>
  )
}
