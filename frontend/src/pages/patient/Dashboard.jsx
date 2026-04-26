import { useState, useEffect, useCallback } from 'react'
import {
  getPatient,
  getPatientAppointments,
  getPrescriptions,
  createRefillRequest,
  getRefillRequests,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { getSocket } from '../../services/socket'
import AppointmentList  from '../../features/patient/AppointmentList'
import PrescriptionList from '../../features/prescriptions/PrescriptionList'
import RefillList       from '../../features/refills/RefillList'

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  const isError = type === 'error'
  return (
    <div
      onClick={onDismiss}
      className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: isError ? '#dc2626' : '#059669', maxWidth: 340 }}>
      <span>{isError ? '⚠' : '✓'}</span>
      <span>{message}</span>
    </div>
  )
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, loading }) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-center gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: color + '18' }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold leading-none mb-1" style={{ color: 'var(--text-h)' }}>
          {loading
            ? <span className="inline-block w-8 h-6 rounded-lg animate-pulse"
                style={{ background: 'var(--border)' }} />
            : value}
        </div>
        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      </div>
    </div>
  )
}

// ─── section wrapper ──────────────────────────────────────────────────────────

function Section({ title, count, loading, children }) {
  return (
    <section className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>{title}</h2>
        {!loading && count != null && (
          <span className="badge text-xs">{count}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ─── greeting ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── main dashboard ───────────────────────────────────────────────────────────

export default function PatientPortalDashboard() {
  const { user }                         = useAuth()
  const patientId                        = user?.patient_id ?? null

  const [patient,       setPatient]       = useState(null)
  const [appointments,  setAppointments]  = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [refillReqs,    setRefillReqs]    = useState([])

  const [patientLoad,   setPatientLoad]   = useState(true)
  const [apptLoad,      setApptLoad]      = useState(true)
  const [rxLoad,        setRxLoad]        = useState(true)
  const [refillLoad,    setRefillLoad]    = useState(true)

  const [apptError,     setApptError]     = useState(null)
  const [rxError,       setRxError]       = useState(null)
  const [refillError,   setRefillError]   = useState(null)

  // per-prescription refill state
  const [requestedIds,  setRequestedIds]  = useState(new Set())
  const [loadingIds,    setLoadingIds]    = useState(new Set())

  // toast
  const [toast,         setToast]         = useState(null)

  // ── load all data on mount ──────────────────────────────────────────────────
  const loadRefillRequests = useCallback(async () => {
    if (!patientId) return
    setRefillLoad(true)
    setRefillError(null)
    try {
      const data = await getRefillRequests(patientId)
      setRefillReqs(data)
      const pendingIds = new Set(
        data
          .filter(r => ['Pending', 'pending'].includes(r.status))
          .map(r => r.prescription_id)
      )
      setRequestedIds(pendingIds)
    } catch (e) {
      setRefillError(e.message)
    } finally {
      setRefillLoad(false)
    }
  }, [patientId])

  useEffect(() => {
    if (!patientId) {
      setPatientLoad(false)
      setApptLoad(false)
      setRxLoad(false)
      setRefillLoad(false)
      return
    }

    getPatient(patientId)
      .then(setPatient)
      .catch(() => {})
      .finally(() => setPatientLoad(false))

    getPatientAppointments(patientId)
      .then(setAppointments)
      .catch(e => setApptError(e.message))
      .finally(() => setApptLoad(false))

    getPrescriptions(patientId)
      .then(setPrescriptions)
      .catch(e => setRxError(e.message))
      .finally(() => setRxLoad(false))

    loadRefillRequests()
  }, [patientId, loadRefillRequests])

  // ── real-time socket ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return
    const s = getSocket()
    s.emit('join_user', { role: 'patient', patient_id: patientId })

    function onApptUpdated(appt) {
      if (Number(appt.patient_id) !== Number(patientId)) return
      setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    }

    function onApptCreated(appt) {
      if (Number(appt.patient_id) !== Number(patientId)) return
      setAppointments(prev => {
        if (prev.some(a => a.id === appt.id)) return prev
        return [appt, ...prev]
      })
    }

    function onRefillUpdated(refill) {
      if (Number(refill.patient_id) !== Number(patientId)) return
      setRefillReqs(prev => {
        const exists = prev.some(r => r.id === refill.id)
        if (exists) return prev.map(r => r.id === refill.id ? refill : r)
        return [refill, ...prev]
      })
      // sync requestedIds: if approved/denied, remove from pending set
      if (refill.status?.toLowerCase() !== 'pending') {
        setRequestedIds(prev => {
          const next = new Set(prev)
          next.delete(refill.prescription_id)
          return next
        })
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

  // auto-dismiss toast after 4 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── request refill ──────────────────────────────────────────────────────────
  async function handleRequestRefill(prescriptionId) {
    setLoadingIds(s => new Set(s).add(prescriptionId))
    try {
      await createRefillRequest(prescriptionId)
      setRequestedIds(s => new Set(s).add(prescriptionId))
      setToast({ message: 'Refill requested successfully', type: 'success' })
      // reload refill list so the new entry appears immediately
      loadRefillRequests()
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally {
      setLoadingIds(s => { const n = new Set(s); n.delete(prescriptionId); return n })
    }
  }

  // ── derived data ────────────────────────────────────────────────────────────
  const upcoming = appointments.filter(
    a => !['completed', 'cancelled'].includes(a.status?.toLowerCase())
  )
  const past = appointments.filter(
    a => ['completed', 'cancelled'].includes(a.status?.toLowerCase())
  )
  const pending    = refillReqs.filter(r => r.status?.toLowerCase() === 'pending').length
  const anyLoading = apptLoad || rxLoad

  // Prefer JWT name (available immediately) over patient API call
  const displayName = user?.first_name ?? patient?.first_name ?? null

  const stats = [
    { label: 'Upcoming Visits',    value: upcoming.length,       icon: '📅', color: '#6366f1' },
    { label: 'Active Medications', value: prescriptions.length,  icon: '💊', color: '#0d9488' },
    { label: 'Pending Refills',    value: pending,               icon: '🔄', color: '#d97706' },
  ]

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

        {/* ── welcome ── */}
        <div>
          <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-h)' }}>
            {greeting()}, {displayName ?? 'there'} 👋
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

        {/* ── stat cards ── */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map(s => (
            <StatCard key={s.label} loading={anyLoading || refillLoad} {...s} />
          ))}
        </div>

        {/* ── two-column layout on desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* left column: appointments + refills (3/5) */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <Section
              title="Upcoming Appointments"
              count={upcoming.length}
              loading={apptLoad}>
              <AppointmentList
                appointments={upcoming}
                loading={apptLoad}
                error={apptError}
              />
            </Section>

            {!apptLoad && past.length > 0 && (
              <Section
                title="Past Appointments"
                count={past.length}
                loading={apptLoad}>
                <AppointmentList
                  appointments={past}
                  loading={false}
                  error={null}
                />
              </Section>
            )}

            <Section
              title="Refill Requests"
              count={refillReqs.length}
              loading={refillLoad}>
              <RefillList
                refillRequests={refillReqs}
                loading={refillLoad}
                error={refillError}
              />
            </Section>
          </div>

          {/* right column: prescriptions (2/5) */}
          <div className="lg:col-span-2">
            <Section
              title="My Prescriptions"
              count={prescriptions.length}
              loading={rxLoad}>
              <PrescriptionList
                prescriptions={prescriptions}
                loading={rxLoad}
                error={rxError}
                requestedIds={requestedIds}
                loadingIds={loadingIds}
                onRequestRefill={handleRequestRefill}
              />
            </Section>
          </div>

        </div>
      </div>
    </>
  )
}
