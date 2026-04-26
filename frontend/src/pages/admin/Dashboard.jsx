import { useState, useEffect, useCallback } from 'react'
import {
  getTodayAppointments,
  getAppointments,
  getPatients,
  updateAppointmentStatus,
} from '../../services/api'
import { getSocket } from '../../services/socket'
import QueueBoard   from '../../features/queue/QueueBoard'
import CheckInModal from '../../features/queue/CheckInModal'

// ─── helpers ──────────────────────────────────────────────────────────────────

// Maps DB status string → UI column key
function toColKey(status) {
  const s = status?.toLowerCase() ?? ''
  if (s === 'completed' || s === 'done')          return 'completed'
  if (s === 'in_progress' || s === 'in-progress') return 'inProgress'
  return 'waiting'
}

// Maps UI column key → next API status string on button press
const NEXT_STATUS = { waiting: 'in_progress', inProgress: 'completed' }

function fmt(iso, opts) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(iso))
}
const fmtTime = iso => fmt(iso, { hour: 'numeric', minute: '2-digit', hour12: true })
const fmtDate = iso => fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' })

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── status badge ─────────────────────────────────────────────────────────────

const BADGE = {
  waiting:    { label: 'Waiting',     bg: 'rgba(245,158,11,0.12)',  color: '#d97706' },
  inProgress: { label: 'In Progress', bg: 'rgba(59,130,246,0.12)',  color: '#2563eb' },
  completed:  { label: 'Completed',   bg: 'rgba(16,185,129,0.12)',  color: '#059669' },
  cancelled:  { label: 'Cancelled',   bg: 'rgba(239,68,68,0.10)',   color: '#dc2626' },
}

function StatusBadge({ status }) {
  const key  = status?.toLowerCase() === 'cancelled' ? 'cancelled' : toColKey(status)
  const spec = BADGE[key] ?? BADGE.waiting
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: spec.bg, color: spec.color }}>
      {spec.label}
    </span>
  )
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, loading }) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-center gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: color + '18' }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold leading-none mb-1" style={{ color: 'var(--text-h)' }}>
          {loading
            ? <span className="inline-block w-8 h-6 rounded animate-pulse"
                style={{ background: 'var(--border)' }} />
            : value}
        </div>
        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      </div>
    </div>
  )
}

// ─── appointments table ───────────────────────────────────────────────────────

function AppointmentsTable({ rows, dateCol = 'time', loading, emptyMsg }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12"
          style={{ color: 'var(--text)' }}>
          <Spinner /> Loading…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="py-14 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{emptyMsg}</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                {['Patient', dateCol === 'time' ? 'Time' : 'Date', 'Doctor', 'Reason', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.id}
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: '#6366f1' }}>
                        {initials(a.patient_name)}
                      </div>
                      <span className="font-medium whitespace-nowrap"
                        style={{ color: 'var(--text-h)' }}>
                        {a.patient_name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap tabular-nums"
                    style={{ color: 'var(--text-h)' }}>
                    {dateCol === 'time'
                      ? fmtTime(a.appointment_date)
                      : fmtDate(a.appointment_date)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: 'var(--text)' }}>
                    {a.doctor_name ? `Dr. ${a.doctor_name}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <span className="block truncate" style={{ color: 'var(--text)' }}>
                      {a.reason ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [todayAppts,   setTodayAppts]   = useState([])   // queue source of truth
  const [allAppts,     setAllAppts]     = useState([])   // full table below
  const [patients,     setPatients]     = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [updatingIds,  setUpdatingIds]  = useState(new Set())
  const [advanceError, setAdvanceError] = useState(null)
  const [showCheckIn,  setShowCheckIn]  = useState(false)

  // ── load all data on mount ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setQueueLoading(true)
    setTableLoading(true)
    const [today, all, pats] = await Promise.all([
      getTodayAppointments().catch(() => []),
      getAppointments().catch(() => []),
      getPatients().catch(() => []),
    ])
    setTodayAppts(today)
    setAllAppts(all)
    setPatients(pats)
    setQueueLoading(false)
    setTableLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── real-time socket ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket()
    s.emit('join_user', { role: 'admin' })

    function isToday(iso) {
      if (!iso) return false
      const d = new Date(iso), t = new Date()
      return d.getFullYear() === t.getFullYear() &&
             d.getMonth()    === t.getMonth()    &&
             d.getDate()     === t.getDate()
    }

    function onApptCreated(appt) {
      if (isToday(appt.appointment_date)) {
        setTodayAppts(prev => {
          if (prev.some(a => a.id === appt.id)) return prev
          return [...prev, appt].sort((a, b) =>
            new Date(a.appointment_date) - new Date(b.appointment_date))
        })
      }
      setAllAppts(prev => {
        if (prev.some(a => a.id === appt.id)) return prev
        return [appt, ...prev]
      })
    }

    function onApptUpdated(appt) {
      setTodayAppts(prev => prev.map(a => a.id === appt.id ? appt : a))
      setAllAppts(prev => prev.map(a => a.id === appt.id ? appt : a))
    }

    s.on('appointment_created', onApptCreated)
    s.on('appointment_updated', onApptUpdated)

    return () => {
      s.off('appointment_created', onApptCreated)
      s.off('appointment_updated', onApptUpdated)
    }
  }, [])

  // ── refresh only today's queue (after status change — faster than full reload) ──
  const refreshQueue = useCallback(async () => {
    const fresh = await getTodayAppointments().catch(() => null)
    if (fresh) setTodayAppts(fresh)
  }, [])

  // ── advance a card: call API → refresh queue ────────────────────────────────
  async function advance(id, colKey) {
    const nextStatus = NEXT_STATUS[colKey]
    if (!nextStatus) return

    setAdvanceError(null)
    setUpdatingIds(prev => new Set(prev).add(id))

    try {
      await updateAppointmentStatus(id, nextStatus)
      await refreshQueue()
    } catch (err) {
      setAdvanceError(`Failed to update: ${err.message}`)
    } finally {
      setUpdatingIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ── derive queue columns from today's appointments ──────────────────────────
  const waiting    = todayAppts.filter(a => toColKey(a.status) === 'waiting')
  const inProgress = todayAppts.filter(a => toColKey(a.status) === 'inProgress')
  const completed  = todayAppts.filter(a => toColKey(a.status) === 'completed')

  // ── non-today rows for the full table ──────────────────────────────────────
  const todayIds    = new Set(todayAppts.map(a => a.id))
  const historicAll = allAppts.filter(a => !todayIds.has(a.id)).slice(0, 15)

  const stats = [
    { label: "Today's Appointments", value: todayAppts.length,   icon: '📅', color: '#6366f1' },
    { label: 'Waiting',              value: waiting.length,      icon: '⏳', color: '#d97706' },
    { label: 'In Progress',          value: inProgress.length,   icon: '🔄', color: '#2563eb' },
    { label: 'Completed',            value: completed.length,    icon: '✅', color: '#059669' },
  ]

  return (
    <div className="flex flex-col gap-8">

      {/* ── header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>
            Front Desk Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            {fmt(new Date(), {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
            &nbsp;·&nbsp;{patients.length} patients on file
          </p>
        </div>
        <button
          onClick={() => setShowCheckIn(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: '#6366f1' }}>
          <span className="text-lg leading-none">+</span>
          Check-In Patient
        </button>
      </div>

      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(s => (
          <StatCard key={s.label} loading={queueLoading} {...s} />
        ))}
      </div>

      {/* ── queue board ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
            Live Queue
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text)' }}>
              live · updates in real-time
            </span>
          </h2>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <RefreshIcon /> Refresh
          </button>
        </div>

        {advanceError && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
            <span>⚠</span>
            <span className="flex-1">{advanceError}</span>
            <button onClick={() => setAdvanceError(null)} className="font-bold">×</button>
          </div>
        )}

        <QueueBoard
          waiting={waiting}
          inProgress={inProgress}
          completed={completed}
          onAdvance={advance}
          updatingIds={updatingIds}
          loading={queueLoading}
        />
      </section>

      {/* ── today's appointments table ── */}
      <section>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
          Today's Appointments
          {!queueLoading && todayAppts.length > 0 && (
            <span className="ml-2 text-xs font-normal badge">{todayAppts.length} total</span>
          )}
        </h2>
        <AppointmentsTable
          rows={todayAppts}
          dateCol="time"
          loading={queueLoading}
          emptyMsg="No appointments scheduled for today"
        />
      </section>

      {/* ── all appointments table (non-today) ── */}
      {!tableLoading && historicAll.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-h)' }}>
            All Appointments
            <span className="ml-2 text-xs font-normal badge">{allAppts.length} total</span>
          </h2>
          <AppointmentsTable
            rows={historicAll}
            dateCol="date"
            loading={false}
            emptyMsg=""
          />
        </section>
      )}

      {/* ── check-in modal ── */}
      {showCheckIn && (
        <CheckInModal
          onClose={() => setShowCheckIn(false)}
          onSuccess={() => { setShowCheckIn(false); loadAll() }}
        />
      )}
    </div>
  )
}

// ─── micro components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
