// Shared: changes need a PR note and a teammate review.
// Purpose: route table. /teacher/* routes require login and render inside TeacherLayout.
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import TeacherLayout from '../components/teacher/TeacherLayout'
import { useAuth } from '../hooks/useAuth'
import AdminDashboard from '../pages/admin/AdminDashboard'
import Login from '../pages/auth/Login'
import StudentDashboard from '../pages/student/StudentDashboard'
import BookingRequests from '../pages/teacher/BookingRequests'
import DaysOff from '../pages/teacher/DaysOff'
import DemoTools from '../pages/teacher/DemoTools'
import OfficeHourSettings from '../pages/teacher/OfficeHourSettings'
import TeacherCalendar from '../pages/teacher/TeacherCalendar'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import TeacherSettings from '../pages/teacher/TeacherSettings'

function RequireAuth() {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/teacher" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route element={<RequireAuth />}>
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="calendar" element={<TeacherCalendar />} />
          <Route path="office-hours" element={<OfficeHourSettings />} />
          <Route path="days-off" element={<DaysOff />} />
          <Route path="requests" element={<BookingRequests />} />
          <Route path="settings" element={<TeacherSettings />} />
          <Route path="demo" element={<DemoTools />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/teacher" replace />} />
    </Routes>
  )
}
