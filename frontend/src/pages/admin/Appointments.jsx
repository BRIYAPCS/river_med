import { useState, useEffect, useCallback } from 'react'
import {
  getAppointments,
  getDoctors,
  updateAppointmentStatus,
  assignAppointment,
  createAppointment,
  getPatients,
} from '../../services/api'
import { getSocket } from '../../services/socket'

// ─── helpers ──────────────────────────────────────────────────────────────────

function ns(s) {
  const v = s?.toLowerCase() ?? ''
  if (v === 'in_progress' || v === 'in-progress') return 'in_progress'
  if (v === 'completed' || v === 'done')           return 'completed'
  if (v === 'cancelled')                           return 'cancelled'
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
    month: 'short', day: 'numeric', year: 'numeric',
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

const VALID_STATUSES = ['waiting', 'in_progress', 'completed', 'cancelled']

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
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 14px', borderRadius: 12,
  border: '1px solid var(--border)', color: 'var(--text-h)',
  background: '#fff', fontSize: 14, outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 6,
}

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'waiting',   label: 'Waiting' },
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

// ─── AssignDoctorModal ────────────────────────────────────────────────────────

function AssignDoctorModal({ appointment, doctors, onAssign, onClose, loading }) {
  const [doctorId, setDoctorId] = useState(appointment?.doctor_id ?? '')

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.40)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>Assign Doctor</h2>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          Patient: <strong style={{ color: 'var(--text-h)' }}>{appointment?.patient_name}</strong>
          <br />
          {appointment?.reason && `Reason: ${appointment.reason}`}
        </p>

        <div>
          <label style={labelStyle}>Select Doctor</label>
          <select value={doctorId} onChange={e => setDoctorId(e.target.value)} style={inputStyle}>
            <option value="">— Unassigned —</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                Dr. {d.first_name} {d.last_name}
                {d.specialty ? ` · ${d.specialty}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            disabled={!doctorId || loading}
            onClick={() => onAssign(appointment.id, Number(doctorId))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white flex-1"
            style={{ background: '#6366f1', opacity: (!doctorId || loading) ? 0.5 : 1, cursor: (!doctorId || loading) ? 'not-allowed' : 'pointer' }}>
            {loading ? <><Spinner size={3} /> Assigning…</> : 'Assign Doctor'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CreateAppointmentModal ───────────────────────────────────────────────────

function CreateAppointmentModal({ patients, doctors, onCreate, onClose, loading }) {
  const [form, setForm] = useState({
    patient_id: '', doctor_id: '', appointment_date: '', reason: '', status: 'waiting',
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const minDate = (() => {
    const d = new Date(Date.now() + 30 * 60 * 1000)
    d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0, 16)
  })()

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.40)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={e => { e.preventDefault(); onCreate(form) }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>New Appointment</h2>

        <div>
          <label style={labelStyle}>Patient *</label>
          <select required value={form.patient_id} onChange={e => set('patient_id', e.target.value)} style={inputStyle}>
            <option value="">Select patient…</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Doctor (optional)</label>
          <select value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)} style={inputStyle}>
            <option value="">Any available doctor</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Date &amp; Time *</label>
            <input required type="datetime-local" min={minDate}
              value={form.appointment_date} onChange={e => set('appointment_date', e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
              {VALID_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Reason</label>
          <input type="text" placeholder="e.g. Annual checkup"
            value={form.reason} onChange={e => set('reason', e.target.value)} style={inputStyle} />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white flex-1"
            style={{ background: '#6366f1', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? <><Spinner size={3} /> Creating…</> : 'Create Appointment'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export default function AdminAppointments() {
  const [appointments,  setAppointments]  = useState([])
  const [doctors,       setDoctors]       = useState([])
  const [patients,      setPatients]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [tab,           setTab]           = useState('all')
  const [search,        setSearch]        = useState('')
  const [assigning,     setAssigning]     = useState(null)   // appointment being assigned
  const [assignLoading, setAssignLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(new Set())
  const [showCreate,    setShowCreate]    = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [toast,         setToast]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAppointments()
      setAppointments(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getDoctors().then(setDoctors).catch(() => {})
    getPatients().then(setPatients).catch(() => {})
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // real-time socket updates
  useEffect(() => {
    const s = getSocket()
    const onUpdated = appt => setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    const onCreated = appt => setAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [appt, ...prev])
    s.on('appointment_updated', onUpdated)
    s.on('appointment_created', onCreated)
    return () => {
      s.off('appointment_updated', onUpdated)
      s.off('appointment_created', onCreated)
    }
  }, [])

  async function handleAssign(id, doctor_id) {
    setAssignLoading(true)
    try {
      await assignAppointment(id, doctor_id)
      setAssigning(null)
      setToast({ message: 'Doctor assigned.', type: 'success' })
      await load()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setAssignLoading(false)
    }
  }

  async function handleStatus(id, status) {
    setStatusLoading(s => new Set(s).add(id))
    try {
      await updateAppointmentStatus(id, status)
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      setToast({ message: 'Status updated.', type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setStatusLoading(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function handleCreate(form) {
    setCreating(true)
    try {
      await createAppointment({
        patient_id:       Number(form.patient_id),
        doctor_id:        form.doctor_id ? Number(form.doctor_id) : undefined,
        appointment_date: form.appointment_date,
        reason:           form.reason || undefined,
        status:           form.status,
      })
      setShowCreate(false)
      setToast({ message: 'Appointment created.', type: 'success' })
      await load()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  // filter + search
  const filtered = appointments
    .filter(a => {
      if (tab === 'waiting')   return ns(a.status) === 'waiting'
      if (tab === 'active')    return ns(a.status) === 'in_progress'
      if (tab === 'completed') return ns(a.status) === 'completed'
      if (tab === 'cancelled') return ns(a.status) === 'cancelled'
      return true
    })
    .filter(a => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        a.patient_name?.toLowerCase().includes(q) ||
        a.doctor_name?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q)
      )
    })

  const counts = {
    all:       appointments.length,
    waiting:   appointments.filter(a => ns(a.status) === 'waiting').length,
    active:    appointments.filter(a => ns(a.status) === 'in_progress').length,
    completed: appointments.filter(a => ns(a.status) === 'completed').length,
    cancelled: appointments.filter(a => ns(a.status) === 'cancelled').length,
  }

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
      {assigning && (
        <AssignDoctorModal
          appointment={assigning}
          doctors={doctors}
          onAssign={handleAssign}
          onClose={() => setAssigning(null)}
          loading={assignLoading}
        />
      )}
      {showCreate && (
        <CreateAppointmentModal
          patients={patients}
          doctors={doctors}
          onCreate={handleCreate}
          onClose={() => setShowCreate(false)}
          loading={creating}
        />
      )}

      <div className="flex flex-col gap-6">

        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Appointments</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
              {appointments.length} total · real-time updates
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              ↻ Refresh
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: '#6366f1' }}>
              + New
            </button>
          </div>
        </div>

        {/* filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit flex-wrap" style={{ background: '#f1f5f9' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: tab === t.key ? '#fff'          : 'transparent',
                color:      tab === t.key ? 'var(--text-h)' : 'var(--text)',
                boxShadow:  tab === t.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === t.key ? 'rgba(99,102,241,0.12)' : 'var(--border)',
                  color:      tab === t.key ? '#6366f1'               : 'var(--text)',
                }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {/* search */}
        <div style={{ position: 'relative', maxWidth: 340 }}>
          <input type="text" placeholder="Search patient, doctor, reason…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36 }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text)' }}>
            🔍
          </span>
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

        {/* empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-5xl opacity-20">📅</span>
            <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No appointments found</p>
          </div>
        )}

        {/* table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                    {['Patient', 'Date · Time', 'Doctor', 'Reason', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const isLast = i === filtered.length - 1
                    const busy   = statusLoading.has(a.id)
                    return (
                      <tr key={a.id}
                        style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>

                        {/* patient */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: '#6366f1' }}>
                              {initials(a.patient_name)}
                            </div>
                            <span className="font-medium whitespace-nowrap" style={{ color: 'var(--text-h)' }}>
                              {a.patient_name ?? '—'}
                            </span>
                          </div>
                        </td>

                        {/* date/time */}
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums" style={{ color: 'var(--text-h)' }}>
                          <span className="block text-xs" style={{ color: 'var(--text)' }}>{fmtDate(a.appointment_date)}</span>
                          <span>{fmtTime(a.appointment_date)}</span>
                        </td>

                        {/* doctor */}
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text)' }}>
                          {a.doctor_name
                            ? `Dr. ${a.doctor_name}`
                            : <span className="italic text-xs" style={{ color: '#94a3b8' }}>Unassigned</span>}
                        </td>

                        {/* reason */}
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="block truncate text-xs" style={{ color: 'var(--text)' }}>
                            {a.reason ?? '—'}
                          </span>
                        </td>

                        {/* status badge */}
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>

                        {/* actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {/* status dropdown */}
                            <select
                              disabled={busy}
                              value={ns(a.status)}
                              onChange={e => handleStatus(a.id, e.target.value)}
                              className="text-xs rounded-lg px-2 py-1 border"
                              style={{
                                borderColor: 'var(--border)', color: 'var(--text-h)',
                                background: '#f8fafc', opacity: busy ? 0.5 : 1,
                                cursor: busy ? 'not-allowed' : 'pointer',
                              }}>
                              {VALID_STATUSES.map(s => (
                                <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                              ))}
                            </select>

                            {/* assign doctor */}
                            <button
                              onClick={() => setAssigning(a)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                              style={{ borderColor: '#c4b5fd', color: '#7c3aed', background: 'rgba(124,58,237,0.06)' }}
                              title="Assign Doctor">
                              {a.doctor_name ? '↻ Reassign' : '+ Doctor'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
