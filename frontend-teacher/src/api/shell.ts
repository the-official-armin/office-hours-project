// Shared: changes need a PR note and a teammate review.
// Purpose: data for the app shell (name, notifications, nav badges). The shell never reads stores directly.
import type { AppNotification, BookingRequest, ShellData, TeacherProfile } from '../types'

export { getStudentShell, markStudentNotesRead, resetStudentShell } from './mocks/shell'

/** Maps the Teacher data already loaded by TeacherDataProvider into what the shell shows. */
export function toTeacherShell(
  profile: TeacherProfile,
  requests: BookingRequest[],
  notifications: AppNotification[],
): ShellData {
  return {
    user: { name: profile.name, subtitle: profile.subject },
    notes: notifications.map((n) => ({
      id: n.id,
      text: `${n.title}: ${n.body}`,
      at: Date.parse(n.createdAt),
      read: n.read,
    })),
    badges: { requests: requests.length, disrupted: 0 },
  }
}
