// Shared: changes need a PR note and a teammate review.
// Purpose: navigation tree, phone tab bar and "which item is current" logic for both roles.
import type { Role, ShellBadges } from '../../types'
import type { IconName } from './Icon'

export type BadgeKey = keyof ShellBadges

export interface NavLeaf {
  id: string
  label: string
  /** May carry a tab, e.g. /teacher/requests?tab=bookings. */
  to: string
  badge?: BadgeKey
  /** Current when the URL has no ?tab= at all. */
  defaultTab?: boolean
  /** Also current on nested paths, e.g. /student/teachers/rivera. */
  prefix?: boolean
}

export interface NavItem extends NavLeaf {
  icon: IconName
}

export interface NavGroup {
  id: string
  label: string
  icon: IconName
  kids: NavLeaf[]
}

export type NavNode = NavItem | NavGroup

export const isGroup = (n: NavNode): n is NavGroup => 'kids' in n

export const NAV_TREE: Record<Role, NavNode[]> = {
  teacher: [
    { id: 'dashboard', label: 'Dashboard', to: '/teacher', icon: 'grid' },
    {
      id: 'sched',
      label: 'Schedule',
      icon: 'cal',
      kids: [
        { id: 'calendar', label: 'Calendar', to: '/teacher/calendar' },
        { id: 'hours', label: 'Office hours', to: '/teacher/office-hours' },
        { id: 'daysoff', label: 'Days off', to: '/teacher/days-off' },
      ],
    },
    {
      id: 'stu',
      label: 'Students',
      icon: 'inbox',
      kids: [
        { id: 'requests', label: 'Booking requests', to: '/teacher/requests?tab=requests', defaultTab: true, badge: 'requests' },
        { id: 'booked', label: 'Booked seats', to: '/teacher/requests?tab=bookings' },
      ],
    },
    { id: 'settings', label: 'Settings', to: '/teacher/settings', icon: 'sliders' },
  ],
  student: [
    { id: 'home', label: 'Home', to: '/student', icon: 'grid' },
    { id: 'teachers', label: 'Find a teacher', to: '/student/teachers', icon: 'user', prefix: true },
    {
      id: 'mybk',
      label: 'My bookings',
      icon: 'calcheck',
      kids: [
        { id: 'up', label: 'Upcoming', to: '/student/bookings?tab=up', defaultTab: true, badge: 'disrupted' },
        { id: 'past', label: 'Past', to: '/student/bookings?tab=past' },
        { id: 'req', label: 'Requests', to: '/student/bookings?tab=req' },
      ],
    },
    { id: 'settings', label: 'Settings', to: '/student/settings', icon: 'sliders' },
  ],
}

export interface TabItem {
  id: string
  label: string
  to: string
  icon: IconName
  badge?: BadgeKey
  prefix?: boolean
}

export const TAB_ITEMS: Record<Role, TabItem[]> = {
  teacher: [
    { id: 'dashboard', label: 'Home', to: '/teacher', icon: 'grid' },
    { id: 'calendar', label: 'Calendar', to: '/teacher/calendar', icon: 'cal' },
    { id: 'hours', label: 'Hours', to: '/teacher/office-hours', icon: 'clock' },
    { id: 'daysoff', label: 'Days off', to: '/teacher/days-off', icon: 'off' },
    { id: 'requests', label: 'Requests', to: '/teacher/requests', icon: 'inbox', badge: 'requests' },
    { id: 'settings', label: 'Settings', to: '/teacher/settings', icon: 'sliders' },
  ],
  student: [
    { id: 'home', label: 'Home', to: '/student', icon: 'grid' },
    { id: 'teachers', label: 'Teachers', to: '/student/teachers', icon: 'user', prefix: true },
    { id: 'bookings', label: 'Bookings', to: '/student/bookings', icon: 'calcheck', badge: 'disrupted' },
    { id: 'settings', label: 'Settings', to: '/student/settings', icon: 'sliders' },
  ],
}

export const HOME_PATH: Record<Role, string> = { teacher: '/teacher', student: '/student' }

export const ROLE_LABEL: Record<Role, string> = { teacher: 'Teacher', student: 'Student' }

/** Is this nav target the page (and tab) the user is on? */
export function isCurrent(
  target: { to: string; prefix?: boolean; defaultTab?: boolean },
  pathname: string,
  search: string,
): boolean {
  const [path, query = ''] = target.to.split('?')
  const pathOk = target.prefix ? pathname === path || pathname.startsWith(`${path}/`) : pathname === path
  if (!pathOk) return false
  const tab = new URLSearchParams(query).get('tab')
  if (!tab) return true
  const current = new URLSearchParams(search).get('tab')
  return current === tab || (current === null && !!target.defaultTab)
}
