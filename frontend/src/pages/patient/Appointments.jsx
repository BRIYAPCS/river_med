import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  getMyAppointments,
  createAppointment,
  cancelAppointment,
  getDoctors,
} from '../../services/api'
import { getSocket } from '../../services/socket'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

const STATUS_META = {
  waiting:     { label: 'Waiting',     bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  in_progress: { label: 'In Progress', bg: 'rgba(37,99,235,0.10)',  color: '#2563eb' },
  completed:   { label: 'Completed',   bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(107,114,128,0.12)',color: '#6b7280' },
}

function statusMeta(s) {
  const key = s?.toLowerCase()?.replace('-', '_')
  return STATUS_META[key] ?? STATUS_META.waiting
}

// ─── micro components ─────────────────────────────────────────────────────────

function Spinner({ size = 4 }) {
  return (
    <svg className={`animate-spin w-${size} h-${size} flex-shrink-0`} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  return (
    <div onClick={onDismiss}
      className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: type === 'error' ? '#dc2626' : '#059669', maxWidth: 340 }}>
      <span>{type === 'error' ? '⚠' : '✓'}</span>
      <span>{message}</span>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border)', color: 'var(--text-h)',
  background: '#f8fafc', fontSize: 14, outline: 'none',
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 6,
}

// ─── AppointmentCard ──────────────────────────────────────────────────────────

function AppointmentCard({ appt, onCancel, cancelling }) {
  const m   = statusMeta(appt.status)
  const can = appt.status?.toLowerCase() === 'waiting'

  return (
    <div className="bg-white rounded-2xl border p-4 flex items-start justify-between gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
            {appt.reason ?? 'General Visit'}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: m.bg, color: m.color }}>
            {m.label}
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          {fmtDate(appt.appointment_date)} · {fmtTime(appt.appointment_date)}
        </p>
        {appt.doctor_name && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
            Dr. {appt.doctor_name}
            {appt.specialty && ` · ${appt.specialty}`}
          </p>
        )}
        {!appt.doctor_name && (
          <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text)' }}>
            Doctor not yet assigned
          </p>
        )}
      </div>

      {can && (
        <button
          disabled={cancelling}
          onClick={() => onCancel(appt.id)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border flex-shrink-0 transition-colors"
          style={{
            borderColor: '#fca5a5', color: '#dc2626',
            background:  'rgba(220,38,38,0.06)',
            opacity:      cancelling ? 0.5 : 1,
            cursor:       cancelling ? 'not-allowed' : 'pointer',
          }}>
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
    </div>
  )
}

// ─── BookingForm ─────────────────────────────────────────────────────────────

function BookingForm({ doctors, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ appointment_date: '', reason: '', doctor_id: '' })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(form)
  }

  // minimum datetime = now + 30 min, rounded to next hour
  const minDate = (() => {
    const d = new Date(Date.now() + 30 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0, 16)
  })()

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h2 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>Book an Appointment</h2>

      <div>
        <label style={labelStyle}>Date &amp; Time</label>
        <input
          type="datetime-local"
          required
          min={minDate}
          value={form.appointment_date}
          onChange={e => set('appointment_date', e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Reason for visit</label>
        <input
          type="text"
          required
          placeholder="e.g. Annual checkup, Follow-up"
          value={form.reason}
          onChange={e => set('reason', e.target.value)}
          style={inputStyle}
        />
      </div>

      {doctors.length > 0 && (
        <div>
          <label style={labelStyle}>Preferred Doctor <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <select
            value={form.doctor_id}
            onChange={e => set('doctor_id', e.target.value)}
            style={inputStyle}>
            <option value="">Any available doctor</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                Dr. {d.first_name} {d.last_name}{d.specialty ? ` · ${d.specialty}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{
            background: 'var(--primary)',
            opacity:    loading ? 0.6 : 1,
            cursor:     loading ? 'not-allowed' : 'pointer',
          }}>
          {loading ? <><Spinner size={3} /> Booking…</> : 'Confirm Booking'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export default function PatientAppointments() {
  const { user }   = useAuth()
  const patientId  = user?.patient_id ?? null

  const [appointments,  setAppointments]  = useState([])
  const [doctors,       setDoctors]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [showForm,      setShowForm]      = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [cancellingId,  setCancellingId]  = useState(null)
  const [toast,         setToast]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyAppointments()
      setAppointments(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { getDoctors().then(setDoctors).catch(() => {}) }, [])

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // real-time socket updates
  useEffect(() => {
    if (!patientId) return
    const s = getSocket()
    const onUpdated = appt => {
      if (Number(appt.patient_id) !== Number(patientId)) return
      setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    }
    const onCreated = appt => {
      if (Number(appt.patient_id) !== Number(patientId)) return
      setAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [appt, ...prev])
    }
    s.on('appointment_updated', onUpdated)
    s.on('appointment_created', onCreated)
    return () => {
      s.off('appointment_updated', onUpdated)
      s.off('appointment_created', onCreated)
    }
  }, [patientId])

  async function handleCreate(form) {
    setCreating(true)
    try {
      await createAppointment({
        appointment_date: form.appointment_date,
        reason:           form.reason || undefined,
        doctor_id:        form.doctor_id || undefined,
      })
      setToast({ message: 'Appointment requested!', type: 'success' })
      setShowForm(false)
      await load()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  async function handleCancel(id) {
    setCancellingId(id)
    try {
      await cancelAppointment(id)
      setToast({ message: 'Appointment cancelled.', type: 'success' })
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setCancellingId(null)
    }
  }

  const upcoming = appointments.filter(a => !['completed','cancelled'].includes(a.status?.toLowerCase()))
  const past     = appointments.filter(a =>  ['completed','cancelled'].includes(a.status?.toLowerCase()))

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />

      <div className="flex flex-col gap-6">

        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Appointments</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
              Manage your upcoming and past visits
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--primary)' }}>
              + Book Appointment
            </button>
          )}
        </div>

        {/* booking form */}
        {showForm && (
          <BookingForm
            doctors={doctors}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={creating}
          />
        )}

        {/* loading */}
        {loading && (
          <div className="flex items-center gap-2 py-10 justify-center" style={{ color: 'var(--text)' }}>
            <Spinner size={5} /> Loading appointments…
          </div>
        )}

        {/* error */}
        {!loading && error && (
          <div className="px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            ⚠ {error}
          </div>
        )}

        {/* upcoming */}
        {!loading && !error && (
          <>
            <section>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-h)' }}>
                Upcoming
                {upcoming.length > 0 && (
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}>
                    {upcoming.length}
                  </span>
                )}
              </h2>
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-4xl opacity-20">📅</span>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No upcoming appointments</p>
                  <p className="text-xs" style={{ color: 'var(--text)' }}>
                    Click "Book Appointment" to schedule a visit.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcoming.map(a => (
                    <AppointmentCard
                      key={a.id}
                      appt={a}
                      onCancel={handleCancel}
                      cancelling={cancellingId === a.id}
                    />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-h)' }}>
                  Past
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--border)', color: 'var(--text)' }}>
                    {past.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {past.map(a => (
                    <AppointmentCard
                      key={a.id}
                      appt={a}
                      onCancel={handleCancel}
                      cancelling={cancellingId === a.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
