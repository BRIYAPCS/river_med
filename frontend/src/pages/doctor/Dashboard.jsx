import { useState, useEffect, useCallback } from 'react'
import { getTodayAppointments, updateAppointmentStatus } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { getSocket } from '../../services/socket'
import PatientDetail from '../../features/patients/PatientDetail'

// ─── status helpers ───────────────────────────────────────────────────────────

function normalise(status) {
  const s = status?.toLowerCase() ?? ''
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress'
  if (s === 'completed'   || s === 'done')         return 'completed'
  if (s === 'cancelled')                           return 'cancelled'
  return 'waiting'
}

const STATUS_META = {
  waiting:     { label: 'Waiting',     bg: 'rgba(245,158,11,0.12)',  color: '#d97706', dot: '#f59e0b' },
  in_progress: { label: 'In Progress', bg: 'rgba(37,99,235,0.10)',   color: '#2563eb', dot: '#3b82f6' },
  completed:   { label: 'Completed',   bg: 'rgba(16,185,129,0.12)',  color: '#059669', dot: '#10b981' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(107,114,128,0.12)', color: '#6b7280', dot: '#9ca3af' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[normalise(status)] ?? STATUS_META.waiting
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      {m.label}
    </span>
  )
}

// ─── formatters ───────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── queue card ───────────────────────────────────────────────────────────────

function QueueCard({ appt, active, onClick }) {
  const ns = normalise(appt.status)
  const m  = STATUS_META[ns]

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b transition-all"
      style={{
        borderColor: 'var(--border)',
        background:  active ? 'rgba(13,148,136,0.07)' : 'white',
        borderLeft:  active ? '3px solid #0d9488' : '3px solid transparent',
      }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: active ? '#0d9488' : '#94a3b8' }}>
        {initials(appt.patient_name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
          {appt.patient_name ?? '—'}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
          {fmtTime(appt.appointment_date)}{appt.reason && ` · ${appt.reason}`}
        </div>
        <div className="mt-1.5"><StatusBadge status={appt.status} /></div>
      </div>
    </button>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyDetail({ queueLen, loading }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12"
      style={{ color: 'var(--text)' }}>
      <span className="text-6xl opacity-20">🩺</span>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
          {loading ? 'Loading queue…' : queueLen === 0 ? 'Queue is empty' : 'Select a patient'}
        </p>
        <p className="text-sm mt-1">
          {loading
            ? 'Fetching today\'s appointments'
            : queueLen === 0
              ? 'No active patients today'
              : 'Choose a patient from the queue to open their record'}
        </p>
      </div>
    </div>
  )
}

// ─── DoctorDashboard ──────────────────────────────────────────────────────────

export default function DoctorDashboard() {
  const { user }                         = useAuth()
  const [appointments, setAppointments]  = useState([])
  const [selectedId,   setSelectedId]    = useState(null)
  const [loading,      setLoading]       = useState(true)
  const [updatingIds,  setUpdatingIds]   = useState(new Set())

  // Doctor's own ID — falls back to the appointment's doctor_id when clicking
  const doctorId = user?.doctor_id ?? null

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getTodayAppointments().catch(() => [])
    setAppointments(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── real-time socket ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket()
    s.emit('join_user', { role: 'doctor', doctor_id: doctorId })

    function isToday(iso) {
      if (!iso) return false
      const d = new Date(iso), t = new Date()
      return d.getFullYear() === t.getFullYear() &&
             d.getMonth()    === t.getMonth()    &&
             d.getDate()     === t.getDate()
    }

    function onApptUpdated(appt) {
      setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    }

    function onApptCreated(appt) {
      if (!isToday(appt.appointment_date)) return
      setAppointments(prev => {
        if (prev.some(a => a.id === appt.id)) return prev
        return [...prev, appt].sort((a, b) =>
          new Date(a.appointment_date) - new Date(b.appointment_date))
      })
    }

    s.on('appointment_updated', onApptUpdated)
    s.on('appointment_created', onApptCreated)

    return () => {
      s.off('appointment_updated', onApptUpdated)
      s.off('appointment_created', onApptCreated)
    }
  }, [doctorId])

  // ── derived lists ──
  // Active queue: waiting → in_progress (shown in top section)
  const activeQueue = appointments
    .filter(a => ['waiting', 'in_progress'].includes(normalise(a.status)))
    .sort((a, b) => {
      const order = { in_progress: 0, waiting: 1 }
      return (order[normalise(a.status)] ?? 9) - (order[normalise(b.status)] ?? 9)
    })

  // Completed today: accessible for late Rx writing
  const completedToday = appointments.filter(a => normalise(a.status) === 'completed')

  const selectedAppt = appointments.find(a => a.id === selectedId) ?? null

  // ── actions ──

  async function handleStart(id) {
    setUpdatingIds(s => new Set(s).add(id))
    try {
      await updateAppointmentStatus(id, 'in_progress')
      await load()
    } finally {
      setUpdatingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function handleComplete(id) {
    setUpdatingIds(s => new Set(s).add(id))
    try {
      await updateAppointmentStatus(id, 'completed')
      // Keep the patient selected so the doctor can still write Rx after completing
      await load()
    } finally {
      setUpdatingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  // ── stats bar ──
  const stats = [
    { label: 'Waiting',     value: activeQueue.filter(a => normalise(a.status) === 'waiting').length,     color: '#d97706' },
    { label: 'In Progress', value: activeQueue.filter(a => normalise(a.status) === 'in_progress').length, color: '#2563eb' },
    { label: 'Completed',   value: completedToday.length,                                                 color: '#059669' },
    { label: 'Total Today', value: appointments.length,                                                   color: '#0d9488' },
  ]

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 68px)' }}>

      {/* ── top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-h)' }}>
            Clinical Workspace
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            }).format(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-5">
          {stats.map(s => (
            <div key={s.label} className="text-center hidden sm:block">
              <div className="text-xl font-bold leading-none" style={{ color: s.color }}>
                {loading ? '—' : s.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{s.label}</div>
            </div>
          ))}
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ml-4 transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <RefreshIcon /> Refresh
          </button>
        </div>
      </div>

      {/* ── split panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── left: queue ── */}
        <aside className="flex flex-col border-r flex-shrink-0 overflow-hidden"
          style={{ width: '30%', minWidth: 260, maxWidth: 340, borderColor: 'var(--border)', background: 'white' }}>

          {/* ── active section ── */}
          <div className="px-4 py-2.5 border-b flex items-center justify-between flex-shrink-0"
            style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text)' }}>
              Patient Queue
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: activeQueue.length > 0 ? '#0d9488' : 'var(--border)',
                color:      activeQueue.length > 0 ? 'white'   : 'var(--text)',
              }}>
              {loading ? '…' : activeQueue.length}
            </span>
          </div>

          <div className="overflow-y-auto" style={{ flex: activeQueue.length > 0 ? '1 1 auto' : '0 0 auto' }}>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10" style={{ color: 'var(--text)' }}>
                <SpinIcon /> Loading…
              </div>
            )}
            {!loading && activeQueue.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                <span className="text-3xl opacity-20">⏳</span>
                <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No active patients</p>
              </div>
            )}
            {!loading && activeQueue.map(appt => (
              <QueueCard
                key={appt.id}
                appt={appt}
                active={appt.id === selectedId}
                onClick={() => setSelectedId(appt.id)}
              />
            ))}
          </div>

          {/* ── completed today section ── */}
          {!loading && completedToday.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-b flex items-center justify-between flex-shrink-0"
                style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                  Completed Today
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#059669' }}>
                  {completedToday.length}
                </span>
              </div>
              <div className="overflow-y-auto flex-1">
                {completedToday.map(appt => (
                  <QueueCard
                    key={appt.id}
                    appt={appt}
                    active={appt.id === selectedId}
                    onClick={() => setSelectedId(appt.id)}
                  />
                ))}
              </div>
            </>
          )}
        </aside>

        {/* ── right: patient detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#f8fafc' }}>
          {selectedAppt ? (
            <PatientDetail
              appt={selectedAppt}
              doctorId={doctorId ?? selectedAppt.doctor_id}
              onStart={()    => handleStart(selectedAppt.id)}
              onComplete={()  => handleComplete(selectedAppt.id)}
              isStarting={updatingIds.has(selectedAppt.id)}
              isCompleting={updatingIds.has(selectedAppt.id)}
            />
          ) : (
            <EmptyDetail queueLen={activeQueue.length + completedToday.length} loading={loading} />
          )}
        </div>

      </div>
    </div>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────

function SpinIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
