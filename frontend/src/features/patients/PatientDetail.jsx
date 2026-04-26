import { useState, useEffect } from 'react'
import { getPrescriptions } from '../../services/api'
import PrescriptionForm from '../prescriptions/PrescriptionForm'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5"
        style={{ color: 'var(--text)' }}>
        {label}
      </dt>
      <dd className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
        {value}
      </dd>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

// ─── status normaliser (local copy so this component is self-contained) ───────

function ns(status) {
  const s = status?.toLowerCase() ?? ''
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress'
  if (s === 'completed'   || s === 'done')         return 'completed'
  return 'waiting'
}

// ─── prescriptions list ───────────────────────────────────────────────────────

function RxList({ prescriptions, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text)' }}>
        <Spinner /> Loading prescriptions…
      </div>
    )
  }
  if (prescriptions.length === 0) {
    return <p className="text-sm py-2" style={{ color: 'var(--text)' }}>No prescriptions on file.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {prescriptions.map(rx => (
        <div key={rx.id} className="flex items-start gap-3 p-3 rounded-xl"
          style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
          <span className="text-lg flex-shrink-0">💊</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
              {rx.medication_name}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#0d9488' }}>{rx.dosage}</div>
            {rx.instructions && (
              <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text)' }}>
                {rx.instructions}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {rx.refill_allowed
                ? <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>
                    Refills allowed
                  </span>
                : <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--border)', color: 'var(--text)' }}>
                    No refills
                  </span>
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── PatientDetail ────────────────────────────────────────────────────────────
//
// Props:
//   appt         — enriched appointment row (includes patient JOIN fields)
//   doctorId     — logged-in doctor's ID (for creating prescriptions)
//   onStart      — () => void  fires when doctor clicks "Start Appointment"
//   onComplete   — () => void  fires when doctor clicks "Mark Completed"
//   isStarting   — boolean     shows spinner on the start button
//   isCompleting — boolean     shows spinner on the complete button

export default function PatientDetail({
  appt,
  doctorId,
  onStart,
  onComplete,
  isStarting   = false,
  isCompleting = false,
}) {
  const [prescriptions, setPrescriptions] = useState([])
  const [rxLoading,     setRxLoading]     = useState(true)
  const [showRxForm,    setShowRxForm]    = useState(false)

  const patientAge  = age(appt.date_of_birth)
  const status      = ns(appt.status)
  const isWaiting   = status === 'waiting'
  const isInProgress = status === 'in_progress'
  const isCompleted = status === 'completed'

  // Use the appointment's doctor_id as a fallback if doctorId prop isn't set
  const effectiveDoctorId = doctorId ?? appt.doctor_id ?? 1

  // Reload prescriptions when the selected patient changes
  useEffect(() => {
    setRxLoading(true)
    setShowRxForm(false)
    setPrescriptions([])
    getPrescriptions(appt.patient_id)
      .then(setPrescriptions)
      .catch(() => {})
      .finally(() => setRxLoading(false))
  }, [appt.patient_id])

  function reloadRx() {
    setShowRxForm(false)
    setRxLoading(true)
    getPrescriptions(appt.patient_id)
      .then(setPrescriptions)
      .catch(() => {})
      .finally(() => setRxLoading(false))
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── action bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-h)' }}>
            {appt.patient_name ?? `${appt.first_name ?? ''} ${appt.last_name ?? ''}`.trim()}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
            {appt.reason ?? 'Visit'} · {fmtTime(appt.appointment_date)}
            {appt.doctor_name && ` · Dr. ${appt.doctor_name}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* ── WAITING: Start button ── */}
          {isWaiting && (
            <button
              onClick={onStart}
              disabled={isStarting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{
                background: '#2563eb',
                opacity:    isStarting ? 0.5 : 1,
                cursor:     isStarting ? 'not-allowed' : 'pointer',
              }}>
              {isStarting ? <Spinner /> : '▶'}
              {isStarting ? 'Starting…' : 'Start Appointment'}
            </button>
          )}

          {/* ── IN PROGRESS: Complete button ── */}
          {isInProgress && (
            <button
              onClick={onComplete}
              disabled={isCompleting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{
                background: '#059669',
                opacity:    isCompleting ? 0.5 : 1,
                cursor:     isCompleting ? 'not-allowed' : 'pointer',
              }}>
              {isCompleting ? <Spinner /> : '✓'}
              {isCompleting ? 'Saving…' : 'Mark Completed'}
            </button>
          )}

          {/* ── COMPLETED: badge ── */}
          {isCompleted && (
            <span className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
              ✓ Completed
            </span>
          )}
        </div>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {/* patient info */}
        <section className="bg-white rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-4"
            style={{ color: 'var(--text)' }}>
            Patient Information
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoRow label="Full Name"
              value={appt.patient_name ?? `${appt.first_name ?? ''} ${appt.last_name ?? ''}`.trim()} />
            <InfoRow label="Date of Birth"
              value={appt.date_of_birth
                ? `${fmtDate(appt.date_of_birth)}${patientAge ? ` (${patientAge} yrs)` : ''}`
                : null} />
            <InfoRow label="Blood Type"  value={appt.blood_type} />
            <InfoRow label="Phone"       value={appt.patient_phone} />
            <InfoRow label="Email"       value={appt.patient_email} />
            <InfoRow label="Doctor"      value={appt.doctor_name ? `Dr. ${appt.doctor_name}` : null} />
          </dl>
        </section>

        {/* visit info */}
        <section className="bg-white rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-4"
            style={{ color: 'var(--text)' }}>
            Visit Details
          </h3>
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label="Date & Time"
              value={`${fmtDate(appt.appointment_date)} · ${fmtTime(appt.appointment_date)}`} />
            <InfoRow label="Reason"    value={appt.reason} />
            <InfoRow label="Specialty" value={appt.specialty} />
            <InfoRow label="Status"    value={appt.status} />
          </dl>
        </section>

        {/* prescriptions — always available so Rx can be added after completing */}
        <section className="bg-white rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text)' }}>
              Prescriptions
              {!rxLoading && prescriptions.length > 0 && (
                <span className="ml-2 normal-case font-normal badge">
                  {prescriptions.length}
                </span>
              )}
            </h3>
            {!showRxForm && (
              <button onClick={() => setShowRxForm(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{ background: '#0d9488' }}>
                + Write Prescription
              </button>
            )}
          </div>

          <RxList prescriptions={prescriptions} loading={rxLoading} />

          {showRxForm && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-4"
                style={{ color: 'var(--text)' }}>
                New Prescription
              </p>
              <PrescriptionForm
                patientId={appt.patient_id}
                doctorId={effectiveDoctorId}
                onSuccess={reloadRx}
                onCancel={() => setShowRxForm(false)}
              />
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
