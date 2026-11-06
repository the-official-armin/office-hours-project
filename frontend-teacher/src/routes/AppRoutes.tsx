// Shared: changes need a PR note and a teammate review.
// Purpose: route table. /teacher/* and /student/* need the matching role and render inside the AppShell.
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import RequireRole from '../auth/RequireRole'
import AuthSplash from '../components/auth/AuthSplash'
import { HOME_PATH } from '../components/common/nav'
import StudentLayout from '../components/student/StudentLayout'
import TeacherLayout from '../components/teacher/TeacherLayout'
import AdminDashboard from '../pages/admin/AdminDashboard'
import LoginPage from '../pages/auth/LoginPage'
import RoleChooser from '../pages/auth/RoleChooser'
import BookSpot from '../pages/student/BookSpot'
import FindTeacher from '../pages/student/FindTeacher'
import MyBookings from '../pages/student/MyBookings'
import MyCalendar from '../pages/student/MyCalendar'
import StudentHome from '../pages/student/StudentHome'
import StudentSettings from '../pages/student/StudentSettings'
import BookingRequests from '../pages/teacher/BookingRequests'
import DaysOff from '../pages/teacher/DaysOff'
import OfficeHourSettings from '../pages/teacher/OfficeHourSettings'
import TeacherCalendar from '../pages/teacher/TeacherCalendar'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import TeacherSettings from '../pages/teacher/TeacherSettings'

/** "/" and unknown paths: your home when signed in, else the sign-in chooser. */
function Landing() {
  const { status, role } = useAuth()
  if (status === 'loading') return <AuthSplash />
  return <Navigate to={role ? HOME_PATH[role] : '/login'} replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<RoleChooser />} />
      <Route path="/student/login" element={<LoginPage role="student" />} />
      <Route path="/teacher/login" element={<LoginPage role="teacher" />} />
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
          <Route path="calendar" element={<MyCalendar />} />
          <Route path="teachers" element={<FindTeacher />} />
          <Route path="teachers/:teacherId" element={<BookSpot />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
