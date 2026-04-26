import { useState, useEffect } from 'react'
import Card from '../components/Card'
import { getPatients, getAppointments } from '../services/api'

const stats = [
  { label: 'Upcoming Appointments', value: '3', icon: '📅', color: '#3b82f6' },
  { label: 'Active Prescriptions',  value: '5', icon: '💊', color: '#10b981' },
  { label: 'Unread Messages',       value: '2', icon: '💬', color: '#f59e0b' },
  { label: 'Last Visit',            value: 'Apr 10', icon: '🏥', color: '#8b5cf6' },
]

const STATUS_STYLE = {
  confirmed:  { bg: 'rgba(16,185,129,0.1)',  text: '#10b981' },
  scheduled:  { bg: 'rgba(16,185,129,0.1)',  text: '#10b981' },
  pending:    { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b' },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444' },
  completed:  { bg: 'rgba(30,58,138,0.08)', text: '#1e3a8a' },
}

function statusStyle(status) {
  return STATUS_STYLE[status?.toLowerCase()] ?? { bg: 'var(--primary-bg)', text: 'var(--primary)' }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function formatTime(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text)' }}>
      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="text-sm">Loading...</span>
    </div>
  )
}

export default function PatientDashboard() {
  const [patients,     setPatients]     = useState([])
  const [patientsLoad, setPatientsLoad] = useState(true)
  const [patientsErr,  setPatientsErr]  = useState(null)

  const [appointments, setAppointments] = useState([])
  const [apptLoad,     setApptLoad]     = useState(true)
  const [apptErr,      setApptErr]      = useState(null)

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch((e) => setPatientsErr(e.message))
      .finally(() => setPatientsLoad(false))

    getAppointments()
      .then(setAppointments)
      .catch((e) => setApptErr(e.message))
      .finally(() => setApptLoad(false))
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>Good morning, Alex</h1>
        <p style={{ color: 'var(--text)' }}>Here's an overview of your health activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: s.color + '18' }}>
                {s.icon}
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-h)' }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Appointments from API */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
            Upcoming Appointments
          </h2>
          <div className="flex items-center gap-3">
            {!apptLoad && !apptErr && (
              <span className="badge">{appointments.length} total</span>
            )}
            <a href="/appointments" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              View all
            </a>
          </div>
        </div>

        {apptLoad && <Spinner />}

        {apptErr && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--danger)' }}>
            Failed to load appointments: {apptErr}
          </p>
        )}

        {!apptLoad && !apptErr && appointments.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--text)' }}>
            No appointments found
          </p>
        )}

        {!apptLoad && !apptErr && appointments.length > 0 && (
          <div className="flex flex-col gap-3">
            {appointments.slice(0, 5).map((a) => {
              const doctorLabel = a.doctor_name ? `Dr. ${a.doctor_name}` : '—'
              const { bg, text } = statusStyle(a.status)
              return (
                <div key={a.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--primary-bg)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0"
                      style={{ background: 'var(--primary)' }}>
                      {initials(a.doctor_name)}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                        {doctorLabel}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text)' }}>
                        {a.specialty && `${a.specialty} · `}
                        {formatDate(a.appointment_date)}
                        {a.appointment_date && ` · ${formatTime(a.appointment_date)}`}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full capitalize"
                    style={{ background: bg, color: text }}>
                    {a.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Patients from API */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>Patients</h2>
          {!patientsLoad && !patientsErr && (
            <span className="badge">{patients.length} total</span>
          )}
        </div>

        {patientsLoad && <Spinner />}

        {patientsErr && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--danger)' }}>
            Failed to load patients: {patientsErr}
          </p>
        )}

        {!patientsLoad && !patientsErr && patients.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--text)' }}>
            No patients found
          </p>
        )}

        {!patientsLoad && !patientsErr && patients.length > 0 && (
          <div className="flex flex-col gap-3">
            {patients.map((p) => (
              <div key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--primary-bg)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0"
                  style={{ background: 'var(--primary)' }}>
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                    {p.first_name} {p.last_name}
                  </div>
                  {p.email && (
                    <div className="text-xs" style={{ color: 'var(--text)' }}>{p.email}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
