// Owner: Subgroup B (Teacher desktop UI). Simulated email notifications; stored in the demo state, never sent.
import type { NotificationType } from '../../types'
import { nextId } from './store'
import type { DemoState } from './seed'

const PREF_FOR_TYPE = {
  booking: 'studentBooks',
  cancellation: 'studentCancels',
  request: 'studentRequests',
  reminder: 'beforeOfficeHour',
} as const

/** Adds a notification unless the teacher turned that type off, or a reminder with the same key exists. */
export function notify(
  draft: DemoState,
  type: NotificationType,
  title: string,
  body: string,
  options: { key?: string; pref?: keyof DemoState['prefs'] } = {},
): boolean {
  const pref = options.pref ?? PREF_FOR_TYPE[type]
  if (pref !== 'leadMinutes' && !draft.prefs[pref]) return false
  if (options.key && draft.notifications.some((n) => n.key === options.key)) return false
  draft.notifications.unshift({
    id: nextId(draft, 'n'),
    type,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    key: options.key,
  })
  return true
}
