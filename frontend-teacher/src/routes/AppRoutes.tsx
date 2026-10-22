// Shared: changes need a PR note and a teammate review.
// Purpose: route table. /teacher/* routes render inside TeacherLayout.
import { Navigate, Route, Routes } from 'react-router-dom'
import TeacherLayout from '../components/teacher/TeacherLayout'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import OfficeHourSettings from '../pages/teacher/OfficeHourSettings'
import TeacherCalendar from '../pages/teacher/TeacherCalendar'
import DaysOff from '../pages/teacher/DaysOff'
import BookingRequests from '../pages/teacher/BookingRequests'
import TeacherSettings from '../pages/teacher/TeacherSettings'
import StudentDashboard from '../pages/student/StudentDashboard'
import AdminDashboard from '../pages/admin/AdminDashboard'
import Login from '../pages/auth/Login'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/teacher" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/teacher" element={<TeacherLayout />}>
        <Route index element={<TeacherDashboard />} />
        <Route path="office-hours" element={<OfficeHourSettings />} />
        <Route path="calendar" element={<TeacherCalendar />} />
        <Route path="days-off" element={<DaysOff />} />
        <Route path="requests" element={<BookingRequests />} />
        <Route path="settings" element={<TeacherSettings />} />
      </Route>
    </Routes>
  )
}
