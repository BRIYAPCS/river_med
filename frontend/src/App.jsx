import { Routes, Route, Navigate } from 'react-router-dom'

// ─── auth ─────────────────────────────────────────────────────────────────────
import Login            from './pages/auth/Login'
import RegisterPatient  from './pages/auth/RegisterPatient'
import ForgotPassword   from './pages/auth/ForgotPassword'
import ResetPassword    from './pages/auth/ResetPassword'
import Unauthorized     from './pages/auth/Unauthorized'
import ProtectedRoute   from './components/ProtectedRoute'

// ─── existing patient layout + pages ─────────────────────────────────────────
import Layout            from './layout/Layout'
import LandingPage       from './pages/LandingPage'
import PatientDashboard  from './pages/PatientDashboard'
import AppointmentsPage  from './pages/AppointmentsPage'
import MessagesPage      from './pages/MessagesPage'
import ProfilePage       from './pages/ProfilePage'
import PrescriptionsPage from './pages/PrescriptionsPage'

// ─── role layouts ─────────────────────────────────────────────────────────────
import AdminLayout   from './layouts/AdminLayout'
import DoctorLayout  from './layouts/DoctorLayout'
import PatientLayout from './layouts/PatientLayout'

// ─── admin pages ──────────────────────────────────────────────────────────────
import AdminDashboard      from './pages/admin/Dashboard'
import AdminRefillDash     from './pages/admin/RefillDashboard'
import AdminAnalytics      from './pages/admin/Analytics'
import AdminQueue          from './pages/admin/Queue'
import AdminPatients       from './pages/admin/Patients'
import AdminAppointments   from './pages/admin/Appointments'
import CalendarPage        from './pages/calendar/CalendarPage'

// ─── doctor pages ─────────────────────────────────────────────────────────────
import DoctorDashboard      from './pages/doctor/Dashboard'
import DoctorRefills        from './pages/doctor/Refills'
import DoctorAppointments   from './pages/doctor/Appointments'
import DoctorPrescriptions  from './pages/doctor/Prescriptions'
import DoctorProfile        from './pages/doctor/Profile'
import DoctorPatientSearch  from './pages/doctor/PatientSearch'

// ─── patient portal pages ────────────────────────────────────────────────────
import PatientPortalDashboard from './pages/patient/Dashboard'
import PatientAppointments    from './pages/patient/Appointments'
import PatientPrescriptions   from './pages/patient/Prescriptions'
import PatientProfile         from './pages/patient/Profile'
import PatientDocuments       from './pages/patient/Documents'

// ─── shared pages ─────────────────────────────────────────────────────────────
import ChatPage        from './pages/chat/ChatPage'
import MedicalHistory  from './pages/shared/MedicalHistory'

export default function App() {
  return (
    <Routes>
      {/* ── public ── */}
      <Route path="/"                element={<LandingPage />} />
      <Route path="/login"           element={<Login />} />
      <Route path="/register"        element={<RegisterPatient />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/unauthorized"    element={<Unauthorized />} />

      {/* ── admin portal — requires role: admin ── */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index                element={<AdminDashboard />} />
          <Route path="queue"         element={<AdminQueue />} />
          <Route path="refills"       element={<AdminRefillDash />} />
          <Route path="patients"      element={<AdminPatients />} />
          <Route path="appointments"  element={<AdminAppointments />} />
          <Route path="analytics"     element={<AdminAnalytics />} />
          <Route path="calendar"      element={<CalendarPage />} />
        </Route>
      </Route>

      {/* ── doctor portal — requires role: doctor ── */}
      <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index                  element={<DoctorDashboard />} />
          <Route path="appointments"    element={<DoctorAppointments />} />
          <Route path="prescriptions"   element={<DoctorPrescriptions />} />
          <Route path="refills"         element={<DoctorRefills />} />
          <Route path="search"          element={<DoctorPatientSearch />} />
          <Route path="messages"        element={<ChatPage />} />
          <Route path="profile"         element={<DoctorProfile />} />
        </Route>
      </Route>

      {/* ── patient portal — requires role: patient ── */}
      <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
        <Route path="/patient" element={<PatientLayout />}>
          <Route index                element={<PatientPortalDashboard />} />
          <Route path="appointments"  element={<PatientAppointments />} />
          <Route path="prescriptions" element={<PatientPrescriptions />} />
          <Route path="history"       element={<MedicalHistory />} />
          <Route path="documents"     element={<PatientDocuments />} />
          <Route path="messages"      element={<ChatPage />} />
          <Route path="profile"       element={<PatientProfile />} />
        </Route>
      </Route>

      {/* ── legacy patient routes (any authenticated user) ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"     element={<PatientDashboard />} />
          <Route path="/appointments"  element={<AppointmentsPage />} />
          <Route path="/prescriptions" element={<PrescriptionsPage />} />
          <Route path="/messages"      element={<MessagesPage />} />
          <Route path="/profile"       element={<ProfilePage />} />
        </Route>
      </Route>

      {/* ── catch-all ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
