// Shared: changes need a PR note and a teammate review.
// Purpose: route table. /teacher/* and /student/* need the matching role and render inside the AppShell.
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { HOME_PATH } from '../components/common/nav'
import StudentLayout from '../components/student/StudentLayout'
import TeacherLayout from '../components/teacher/TeacherLayout'
import { useAuth } from '../hooks/useAuth'
import AdminDashboard from '../pages/admin/AdminDashboard'
import Login from '../pages/auth/Login'
import BookSeat from '../pages/student/BookSeat'
import FindTeacher from '../pages/student/FindTeacher'
import MyBookings from '../pages/student/MyBookings'
import StudentHome from '../pages/student/StudentHome'
import StudentSettings from '../pages/student/StudentSettings'
import BookingRequests from '../pages/teacher/BookingRequests'
import DaysOff from '../pages/teacher/DaysOff'
import OfficeHourSettings from '../pages/teacher/OfficeHourSettings'
import TeacherCalendar from '../pages/teacher/TeacherCalendar'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import TeacherSettings from '../pages/teacher/TeacherSettings'
import type { Role } from '../types'

/** Sends signed-out visitors to /login, and people on the wrong side to their own home. */
function RequireRole({ role }: { role: Role }) {
  const { role: current } = useAuth()
  if (!current) return <Navigate to="/login" replace />
  if (current !== role) return <Navigate to={HOME_PATH[current]} replace />
  return <Outlet />
}

function Landing() {
  const { role } = useAuth()
  return <Navigate to={role ? HOME_PATH[role] : '/login'} replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />

      <Route element={<RequireRole role="teacher" />}>
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="calendar" element={<TeacherCalendar />} />
          <Route path="office-hours" element={<OfficeHourSettings />} />
          <Route path="days-off" element={<DaysOff />} />
          <Route path="requests" element={<BookingRequests />} />
          <Route path="settings" element={<TeacherSettings />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="student" />}>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<StudentHome />} />
          <Route path="teachers" element={<FindTeacher />} />
          <Route path="teachers/:teacherId" element={<BookSeat />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
