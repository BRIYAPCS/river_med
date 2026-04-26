import { useState, useEffect, useCallback } from 'react'
import {
  getMyPatient,
  getMyAppointments,
  getMyPrescriptions,
  getMyRefillRequests,
  getMessageThreads,
  createRefillRequest,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { getSocket } from '../../services/socket'

// ─── helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

const APPT_STATUS = {
  waiting:     { label: 'Waiting',     bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  in_progress: { label: 'In Progress', bg: 'rgba(37,99,235,0.10)',  color: '#2563eb' },
  completed:   { label: 'Completed',   bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(107,114,128,0.12)',color: '#6b7280' },
}

function statusMeta(s) {
  return APPT_STATUS[s?.toLowerCase()?.replace('-', '_')] ?? APPT_STATUS.waiting
}

// ─── micro components ─────────────────────────────────────────────────────────

function Spinner({ size = 4 }) {
  return (
    <svg className={`animate-spin w-${size} h-${size}`} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  return (
    <div onClick={onDismiss} className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: type === 'error' ? '#dc2626' : '#059669', maxWidth: 340 }}>
      <span>{type === 'error' ? '⚠' : '✓'}</span>
      <span>{message}</span>
    </div>
  )
}

function StatCard({ label, value, icon, color, loading }) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-center gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: color + '18' }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold leading-none mb-1" style={{ color: 'var(--text-h)' }}>
          {loading
            ? <span className="inline-block w-8 h-6 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            : value ?? '—'}
        </div>
        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      </div>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Empty({ text }) {
  return <p className="text-sm py-2" style={{ color: 'var(--text)' }}>{text}</p>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function PatientPortalDashboard() {
  const { user }      = useAuth()
  const patientId     = user?.patient_id ?? null
  const displayName   = user?.first_name ?? null

  const [patient,       setPatient]       = useState(null)
  const [appointments,  setAppointments]  = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [refillReqs,    setRefillReqs]    = useState([])
  const [threads,       setThreads]       = useState([])

  const [loading,  setLoading]  = useState(true)
  const [rxLoading, setRxLoading] = useState(true)
  const [toast,    setToast]    = useState(null)

  // per-prescription loading
  const [requestedIds, setRequestedIds] = useState(new Set())
  const [loadingIds,   setLoadingIds]   = useState(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [appts, rxs, refills, pInfo, thr] = await Promise.allSettled([
        getMyAppointments(),
        getMyPrescriptions(),
        getMyRefillRequests(),
        getMyPatient(),
        getMessageThreads(),
      ])
      if (appts.status  === 'fulfilled') setAppointments(appts.value)
      if (rxs.status    === 'fulfilled') { setPrescriptions(rxs.value); setRxLoading(false) }
      if (refills.status === 'fulfilled') {
        setRefillReqs(refills.value)
        const pids = new Set(
          refills.value
            .filter(r => r.status?.toLowerCase() === 'pending')
            .map(r => r.prescription_id)
        )
        setRequestedIds(pids)
      }
      if (pInfo.status  === 'fulfilled') setPatient(pInfo.value)
      if (thr.status    === 'fulfilled') setThreads(thr.value)
    } finally {
      setLoading(false)
      setRxLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // socket: real-time appointment + refill updates
  useEffect(() => {
    if (!patientId) return
    const s = getSocket()
    s.emit('join_user', { role: 'patient', patient_id: patientId })

    const onApptUpdated = appt => {
      if (Number(appt.patient_id) !== Number(patientId)) return
      setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    }
    const onApptCreated = appt => {
      if (Number(appt.patient_id) !== Number(patientId)) return
      setAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [appt, ...prev])
    }
    const onRefillUpdated = refill => {
      if (Number(refill.patient_id) !== Number(patientId)) return
      setRefillReqs(prev => {
        const exists = prev.some(r => r.id === refill.id)
        return exists ? prev.map(r => r.id === refill.id ? refill : r) : [refill, ...prev]
      })
      if (refill.status?.toLowerCase() !== 'pending') {
        setRequestedIds(prev => { const n = new Set(prev); n.delete(refill.prescription_id); return n })
      }
    }

    s.on('appointment_updated', onApptUpdated)
    s.on('appointment_created', onApptCreated)
    s.on('refill_updated',      onRefillUpdated)
    return () => {
      s.off('appointment_updated', onApptUpdated)
      s.off('appointment_created', onApptCreated)
      s.off('refill_updated',      onRefillUpdated)
    }
  }, [patientId])

  async function handleRequestRefill(prescriptionId) {
    setLoadingIds(s => new Set(s).add(prescriptionId))
    try {
      await createRefillRequest(prescriptionId)
      setRequestedIds(s => new Set(s).add(prescriptionId))
      setToast({ message: 'Refill requested!', type: 'success' })
      load()
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally {
      setLoadingIds(s => { const n = new Set(s); n.delete(prescriptionId); return n })
    }
  }

  // derived
  const upcoming    = appointments.filter(a => !['completed','cancelled'].includes(a.status?.toLowerCase()))
  const pendingRx   = refillReqs.filter(r => r.status?.toLowerCase() === 'pending').length
  const unread      = threads.reduce((s, t) => s + (Number(t.unread_count) || 0), 0)
  const activeMeds  = prescriptions.length

  if (!patientId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="text-5xl opacity-20">🏥</span>
        <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
          Account not linked to a patient record
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          Please contact support to link your account.
        </p>
      </div>
    )
  }

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />

      <div className="flex flex-col gap-6">

        {/* greeting */}
        <div>
          <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-h)' }}>
            {greeting()}, {displayName ?? patient?.first_name ?? 'there'} 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            }).format(new Date())}
            {patient?.blood_type && (
              <> · Blood type <strong style={{ color: 'var(--text-h)' }}>{patient.blood_type}</strong></>
            )}
          </p>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Upcoming Visits"    value={upcoming.length}  icon="📅" color="#6366f1" loading={loading} />
          <StatCard label="Active Medications" value={activeMeds}        icon="💊" color="#0d9488" loading={rxLoading} />
          <StatCard label="Pending Refills"    value={pendingRx}         icon="🔄" color="#d97706" loading={loading} />
          <StatCard label="Unread Messages"    value={unread}            icon="💬" color="#2563eb" loading={loading} />
        </div>

        {/* two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* left: upcoming appointments */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <SectionCard title="Upcoming Appointments">
              {loading ? (
                <div className="flex items-center gap-2 py-3" style={{ color: 'var(--text)' }}>
                  <Spinner /> Loading…
                </div>
              ) : upcoming.length === 0 ? (
                <Empty text="No upcoming appointments." />
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                  {upcoming.slice(0, 5).map(a => {
                    const m = statusMeta(a.status)
                    return (
                      <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
                            {a.reason ?? 'Visit'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                            {fmtDate(a.appointment_date)} · {fmtTime(a.appointment_date)}
                            {a.doctor_name && ` · Dr. ${a.doctor_name}`}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: m.bg, color: m.color }}>
                          {m.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            {/* recent refill requests */}
            <SectionCard title="Refill Requests">
              {loading ? (
                <div className="flex items-center gap-2 py-3" style={{ color: 'var(--text)' }}>
                  <Spinner /> Loading…
                </div>
              ) : refillReqs.length === 0 ? (
                <Empty text="No refill requests yet." />
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                  {refillReqs.slice(0, 5).map(r => {
                    const s = r.status?.toLowerCase()
                    const color = s === 'approved' ? '#059669' : s === 'denied' ? '#dc2626' : '#d97706'
                    const bg    = s === 'approved' ? 'rgba(16,185,129,0.10)' : s === 'denied' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.10)'
                    return (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>{r.medication_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text)' }}>{r.dosage}</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: bg, color }}>
                          {r.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* right: prescriptions */}
          <div className="lg:col-span-2">
            <SectionCard title="My Prescriptions">
              {rxLoading ? (
                <div className="flex items-center gap-2 py-3" style={{ color: 'var(--text)' }}>
                  <Spinner /> Loading…
                </div>
              ) : prescriptions.length === 0 ? (
                <Empty text="No prescriptions on file." />
              ) : (
                <div className="flex flex-col gap-3">
                  {prescriptions.map(rx => {
                    const isPending  = requestedIds.has(rx.id)
                    const isLoading  = loadingIds.has(rx.id)
                    return (
                      <div key={rx.id} className="p-3 rounded-xl border flex flex-col gap-2"
                        style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
                            {rx.medication_name}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#0d9488' }}>{rx.dosage}</p>
                          {rx.instructions && (
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text)' }}>
                              {rx.instructions}
                            </p>
                          )}
                        </div>
                        {rx.refill_allowed && (
                          <button
                            disabled={isPending || isLoading}
                            onClick={() => handleRequestRefill(rx.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white self-start"
                            style={{
                              background: isPending ? '#6b7280' : '#0d9488',
                              opacity:    (isPending || isLoading) ? 0.7 : 1,
                              cursor:     (isPending || isLoading) ? 'not-allowed' : 'pointer',
                            }}>
                            {isLoading ? 'Requesting…' : isPending ? '✓ Requested' : 'Request Refill'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          </div>

        </div>
      </div>
    </>
  )
}
