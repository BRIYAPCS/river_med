import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getMyAppointments, updateAppointmentStatus } from '../../services/api'
import { getSocket } from '../../services/socket'

// ─── helpers ──────────────────────────────────────────────────────────────────

function ns(status) {
  const s = status?.toLowerCase() ?? ''
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress'
  if (s === 'completed' || s === 'done')           return 'completed'
  if (s === 'cancelled')                           return 'cancelled'
  return 'waiting'
}

const STATUS_META = {
  waiting:     { label: 'Waiting',     bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  in_progress: { label: 'In Progress', bg: 'rgba(37,99,235,0.10)',  color: '#2563eb' },
  completed:   { label: 'Completed',   bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(107,114,128,0.12)',color: '#6b7280' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
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
      <span>{type === 'error' ? '⚠' : '✓'}</span><span>{message}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[ns(status)] ?? STATUS_META.waiting
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

// ─── AppointmentRow ───────────────────────────────────────────────────────────

function AppointmentRow({ appt, onStart, onComplete, updating }) {
  const status = ns(appt.status)

  return (
    <div className="bg-white rounded-2xl border p-4 flex items-center gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: '#0d9488' }}>
        {initials(appt.patient_name)}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
            {appt.patient_name ?? '—'}
          </span>
          <StatusBadge status={appt.status} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
          {fmtDate(appt.appointment_date)} · {fmtTime(appt.appointment_date)}
          {appt.reason && ` · ${appt.reason}`}
        </p>
        {appt.patient_email && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{appt.patient_email}</p>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {status === 'waiting' && (
          <button
            disabled={updating}
            onClick={() => onStart(appt.id)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
            style={{ background: '#2563eb', opacity: updating ? 0.6 : 1, cursor: updating ? 'not-allowed' : 'pointer' }}>
            {updating ? <Spinner size={3} /> : '▶'} Start
          </button>
        )}
        {status === 'in_progress' && (
          <button
            disabled={updating}
            onClick={() => onComplete(appt.id)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
            style={{ background: '#059669', opacity: updating ? 0.6 : 1, cursor: updating ? 'not-allowed' : 'pointer' }}>
            {updating ? <Spinner size={3} /> : '✓'} Complete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export default function DoctorAppointments() {
  const { user }   = useAuth()
  const doctorId   = user?.doctor_id ?? null

  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [tab,          setTab]          = useState('all')
  const [updatingIds,  setUpdatingIds]  = useState(new Set())
  const [toast,        setToast]        = useState(null)

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

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // real-time socket
  useEffect(() => {
    const s = getSocket()
    const onUpdated = appt => setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    const onCreated = appt => {
      if (Number(appt.doctor_id) !== Number(doctorId)) return
      setAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [appt, ...prev])
    }
    s.on('appointment_updated', onUpdated)
    s.on('appointment_created', onCreated)
    return () => {
      s.off('appointment_updated', onUpdated)
      s.off('appointment_created', onCreated)
    }
  }, [doctorId])

  async function handleStart(id) {
    setUpdatingIds(s => new Set(s).add(id))
    try {
      await updateAppointmentStatus(id, 'in_progress')
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'in_progress' } : a))
      setToast({ message: 'Appointment started.', type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setUpdatingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function handleComplete(id) {
    setUpdatingIds(s => new Set(s).add(id))
    try {
      await updateAppointmentStatus(id, 'completed')
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a))
      setToast({ message: 'Appointment completed.', type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setUpdatingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  // filter by tab
  const filtered = appointments.filter(a => {
    if (tab === 'all')       return true
    if (tab === 'active')    return ['waiting', 'in_progress'].includes(ns(a.status))
    if (tab === 'completed') return ns(a.status) === 'completed'
    if (tab === 'cancelled') return ns(a.status) === 'cancelled'
    return true
  })

  const counts = {
    all:       appointments.length,
    active:    appointments.filter(a => ['waiting','in_progress'].includes(ns(a.status))).length,
    completed: appointments.filter(a => ns(a.status) === 'completed').length,
    cancelled: appointments.filter(a => ns(a.status) === 'cancelled').length,
  }

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />

      <div className="flex flex-col gap-6">

        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Appointments</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
              All appointments assigned to you
            </p>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            ↻ Refresh
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f1f5f9' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: tab === t.key ? '#fff'           : 'transparent',
                color:      tab === t.key ? 'var(--text-h)'  : 'var(--text)',
                boxShadow:  tab === t.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === t.key ? 'rgba(13,148,136,0.12)' : 'var(--border)',
                  color:      tab === t.key ? '#0d9488'               : 'var(--text)',
                }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

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

        {/* list */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-5xl opacity-20">📋</span>
            <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
              No appointments {tab !== 'all' ? `in "${TABS.find(t => t.key === tab)?.label}"` : ''}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-3">
            {filtered.map(a => (
              <AppointmentRow
                key={a.id}
                appt={a}
                onStart={handleStart}
                onComplete={handleComplete}
                updating={updatingIds.has(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
