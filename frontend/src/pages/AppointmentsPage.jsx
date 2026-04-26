import { useState, useEffect } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { getDoctors, createAppointment } from '../services/api'

// ─── static mock list (replaced by real data once GET /api/appointments is wired) ───
const appointments = [
  { id: 1, doctor: 'Dr. Sarah Chen',   specialty: 'Cardiologist',    date: 'May 2, 2026',  time: '10:00 AM', status: 'Confirmed' },
  { id: 2, doctor: 'Dr. James Osei',   specialty: 'General Practice', date: 'May 9, 2026',  time: '2:30 PM',  status: 'Pending'   },
  { id: 3, doctor: 'Dr. Priya Nair',   specialty: 'Dermatologist',    date: 'May 15, 2026', time: '11:15 AM', status: 'Confirmed' },
  { id: 4, doctor: 'Dr. Marco Ruiz',   specialty: 'Neurologist',      date: 'Apr 10, 2026', time: '9:00 AM',  status: 'Completed' },
  { id: 5, doctor: 'Dr. Aisha Kamara', specialty: 'Endocrinologist',  date: 'Mar 28, 2026', time: '3:00 PM',  status: 'Cancelled' },
]

const statusStyle = {
  Confirmed: { bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
  Pending:   { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  Completed: { bg: 'rgba(30,58,138,0.08)', color: '#1e3a8a' },
  Cancelled: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444' },
}

const SERVICES = [
  'General Checkup',
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Endocrinology',
  'Mental Health',
  'Orthopedics',
  'Pediatrics',
]

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
]

const EMPTY_FORM = {
  service:    '',
  doctorId:   null,
  doctorName: '',
  date:       '',
  time:       '',
}

// ─── booking modal ────────────────────────────────────────────────────────────
function BookingModal({ onClose, onBooked }) {
  const [step,           setStep]           = useState(1)
  const [form,           setForm]           = useState(EMPTY_FORM)
  const [doctors,        setDoctors]        = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [doctorsError,   setDoctorsError]   = useState(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [bookingError,   setBookingError]   = useState(null)
  const [success,        setSuccess]        = useState(false)

  // fetch doctors when reaching step 2
  useEffect(() => {
    if (step !== 2) return
    setDoctorsLoading(true)
    setDoctorsError(null)
    getDoctors()
      .then(setDoctors)
      .catch((e) => setDoctorsError(e.message))
      .finally(() => setDoctorsLoading(false))
  }, [step])

  function reset() {
    setStep(1)
    setForm(EMPTY_FORM)
    setSuccess(false)
    setBookingError(null)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setBookingError(null)
    try {
      await createAppointment({
        patient_id:       1,
        doctor_id:        form.doctorId,
        appointment_date: `${form.date}T${form.time}:00`,
        reason:           form.service,
        status:           'scheduled',
      })
      setSuccess(true)
      onBooked?.()
    } catch (e) {
      setBookingError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: 'rgba(16,185,129,0.12)' }}>
            ✓
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-h)' }}>
            Appointment booked successfully
          </h2>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            {form.service} with {form.doctorName}<br />
            {new Date(`${form.date}T${form.time}`).toLocaleString([], {
              weekday: 'long', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="ghost" onClick={reset}>Book another</Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay onClose={onClose}>
      {/* progress */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: step >= n ? 'var(--primary)' : 'var(--primary-bg)',
                color:      step >= n ? 'white'          : 'var(--primary)',
              }}>
              {n}
            </div>
            <span className="text-xs font-medium hidden sm:block"
              style={{ color: step >= n ? 'var(--text-h)' : 'var(--text)' }}>
              {['Select Service', 'Select Doctor', 'Select Time'][n - 1]}
            </span>
            {n < 3 && <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* ── step 1: service ── */}
      {step === 1 && (
        <div>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
            What do you need help with?
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {SERVICES.map((s) => (
              <button key={s}
                onClick={() => setForm((f) => ({ ...f, service: s }))}
                className="p-3 rounded-xl text-sm font-medium text-left border transition-all"
                style={{
                  borderColor: form.service === s ? 'var(--primary)' : 'var(--border)',
                  background:  form.service === s ? 'var(--primary-bg)' : 'transparent',
                  color:       form.service === s ? 'var(--primary)'    : 'var(--text-h)',
                }}>
                {s}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={!form.service}>
            Continue
          </Button>
        </div>
      )}

      {/* ── step 2: doctor ── */}
      {step === 2 && (
        <div>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
            Choose a doctor
          </h3>

          {doctorsLoading && (
            <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text)' }}>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Loading doctors...
            </div>
          )}

          {doctorsError && (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--danger)' }}>
              {doctorsError}
            </p>
          )}

          {!doctorsLoading && !doctorsError && doctors.length === 0 && (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text)' }}>
              No doctors available
            </p>
          )}

          {!doctorsLoading && !doctorsError && doctors.length > 0 && (
            <div className="flex flex-col gap-2 mb-6 max-h-64 overflow-y-auto">
              {doctors.map((d) => {
                const name = `${d.first_name} ${d.last_name}`
                return (
                  <button key={d.id}
                    onClick={() => setForm((f) => ({ ...f, doctorId: d.id, doctorName: `Dr. ${name}` }))}
                    className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                    style={{
                      borderColor: form.doctorId === d.id ? 'var(--primary)' : 'var(--border)',
                      background:  form.doctorId === d.id ? 'var(--primary-bg)' : 'transparent',
                    }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs text-white flex-shrink-0"
                      style={{ background: 'var(--primary)' }}>
                      {d.first_name?.[0]}{d.last_name?.[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                        Dr. {name}
                      </div>
                      {d.specialty && (
                        <div className="text-xs" style={{ color: 'var(--text)' }}>{d.specialty}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(3)} disabled={!form.doctorId}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── step 3: date + time ── */}
      {step === 3 && (
        <div>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
            Pick a date & time
          </h3>

          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
            Date
          </label>
          <input
            type="date"
            min={new Date().toISOString().split('T')[0]}
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border text-sm mb-4 outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
          />

          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>
            Time
          </label>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {TIME_SLOTS.map((t) => (
              <button key={t}
                onClick={() => setForm((f) => ({ ...f, time: t }))}
                className="py-2 rounded-xl text-xs font-medium border transition-all"
                style={{
                  borderColor: form.time === t ? 'var(--primary)' : 'var(--border)',
                  background:  form.time === t ? 'var(--primary)' : 'transparent',
                  color:       form.time === t ? 'white'          : 'var(--text-h)',
                }}>
                {t}
              </button>
            ))}
          </div>

          {bookingError && (
            <p className="text-sm mb-4 text-center" style={{ color: 'var(--danger)' }}>
              {bookingError}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!form.date || !form.time || submitting}>
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

// ─── reusable overlay wrapper ─────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl"
        style={{ background: 'var(--bg)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
            New Appointment
          </span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none"
            style={{ color: 'var(--text)', background: 'var(--primary-bg)' }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const [filter,      setFilter]      = useState('All')
  const [showBooking, setShowBooking] = useState(false)

  const tabs     = ['All', 'Confirmed', 'Pending', 'Completed', 'Cancelled']
  const filtered = filter === 'All' ? appointments : appointments.filter((a) => a.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>Appointments</h1>
          <p style={{ color: 'var(--text)' }}>Manage and track all your visits.</p>
        </div>
        <Button onClick={() => setShowBooking(true)}>+ New Appointment</Button>
      </div>

      {/* filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map((t) => (
          <button key={t}
            onClick={() => setFilter(t)}
            className="px-4 py-1.5 rounded-full text-sm font-medium border transition-all"
            style={{
              background:  filter === t ? 'var(--primary)' : 'transparent',
              color:       filter === t ? 'white'          : 'var(--text)',
              borderColor: filter === t ? 'var(--primary)' : 'var(--border)',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* appointment list */}
      <div className="flex flex-col gap-3">
        {filtered.map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-white text-sm"
                  style={{ background: 'var(--primary)' }}>
                  {a.doctor.split(' ')[1][0]}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-h)' }}>{a.doctor}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{a.specialty}</div>
                </div>
              </div>
              <div className="text-center hidden sm:block">
                <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{a.date}</div>
                <div className="text-xs" style={{ color: 'var(--text)' }}>{a.time}</div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: statusStyle[a.status].bg, color: statusStyle[a.status].color }}>
                {a.status}
              </span>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-12" style={{ color: 'var(--text)' }}>
            No {filter.toLowerCase()} appointments.
          </p>
        )}
      </div>

      {/* booking modal */}
      {showBooking && (
        <BookingModal
          onClose={() => setShowBooking(false)}
          onBooked={() => {}}
        />
      )}
    </div>
  )
}
