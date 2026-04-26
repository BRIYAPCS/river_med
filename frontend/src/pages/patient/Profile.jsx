import { useState, useEffect } from 'react'
import { getMyPatient } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

// ─── micro components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>
        {label}
      </dt>
      <dd className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
        {value}
      </dd>
    </div>
  )
}

const BLOOD_TYPE_COLOR = {
  'A+': '#6366f1', 'A-': '#8b5cf6',
  'B+': '#0d9488', 'B-': '#14b8a6',
  'O+': '#f59e0b', 'O-': '#d97706',
  'AB+': '#3b82f6','AB-': '#2563eb',
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export default function PatientProfile() {
  const { user }  = useAuth()
  const patientId = user?.patient_id ?? null

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getMyPatient()
      .then(setPatient)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // ── loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20" style={{ color: 'var(--text)' }}>
        <Spinner /> Loading your profile…
      </div>
    )
  }

  // ── no patient_id in token ──
  if (!patientId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <span className="text-5xl opacity-20">🏥</span>
        <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
          Account not linked to a patient record
        </p>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text)' }}>
          Your login is working, but no patient profile has been linked yet.
          Please contact support at{' '}
          <a href="mailto:support@rivermed.com" className="font-semibold"
            style={{ color: 'var(--primary)' }}>
            support@rivermed.com
          </a>{' '}
          and provide your account email.
        </p>
      </div>
    )
  }

  // ── API error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <span className="text-5xl opacity-20">⚠️</span>
        <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
          Could not load your profile
        </p>
        <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); getMyPatient().then(setPatient).catch(e => setError(e.message)).finally(() => setLoading(false)) }}
          className="text-sm font-semibold px-4 py-2 rounded-xl border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Try again
        </button>
      </div>
    )
  }

  const fullName  = [patient?.first_name, patient?.middle_name, patient?.last_name, patient?.second_last_name]
    .filter(Boolean).join(' ')
  const dob       = patient?.date_of_birth
  const patientAge = age(dob)
  const btColor   = BLOOD_TYPE_COLOR[patient?.blood_type] ?? '#6b7280'
  const initials  = [patient?.first_name?.[0], patient?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
          Your personal health record at River Med
        </p>
      </div>

      {/* identity card */}
      <div className="bg-white rounded-2xl border p-6 flex items-center gap-5"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* avatar */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
          style={{ background: 'var(--primary)' }}>
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-h)' }}>
            {fullName || 'Name not set'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            {patient?.email ?? user?.email ?? '—'}
          </p>
          {patientAge && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
              Age {patientAge}
            </p>
          )}
        </div>
        {patient?.blood_type && (
          <div className="ml-auto flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold"
            style={{ background: btColor + '15' }}>
            <span className="text-xs" style={{ color: btColor }}>Blood</span>
            <span className="text-lg leading-none" style={{ color: btColor }}>
              {patient.blood_type}
            </span>
          </div>
        )}
      </div>

      {/* details */}
      <div className="bg-white rounded-2xl border p-6"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text)' }}>
          Personal Information
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow label="First Name"        value={patient?.first_name} />
          <InfoRow label="Middle Name"       value={patient?.middle_name} />
          <InfoRow label="Last Name"         value={patient?.last_name} />
          <InfoRow label="Second Last Name"  value={patient?.second_last_name} />
          <InfoRow label="Email"             value={patient?.email ?? user?.email} />
          <InfoRow label="Phone"             value={patient?.phone} />
          <InfoRow label="Date of Birth"
            value={dob
              ? `${fmtDate(dob)}${patientAge ? ` (${patientAge} years old)` : ''}`
              : null}
          />
          <InfoRow label="Blood Type"        value={patient?.blood_type} />
        </dl>
      </div>

      {/* account info */}
      <div className="bg-white rounded-2xl border p-6"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text)' }}>
          Account
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow label="Role"       value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : null} />
          <InfoRow label="Patient ID" value={patient?.id ? `#${patient.id}` : null} />
          <InfoRow label="Member Since" value={fmtDate(patient?.created_at)} />
        </dl>
      </div>

      {/* support note */}
      <p className="text-xs text-center pb-2" style={{ color: 'var(--text)' }}>
        To update your personal information, contact your clinic or email{' '}
        <a href="mailto:support@rivermed.com" className="font-semibold"
          style={{ color: 'var(--primary)' }}>
          support@rivermed.com
        </a>
      </p>
    </div>
  )
}
