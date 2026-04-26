import { useState, useEffect, useRef } from 'react'
import { getPatients, getDoctors, createPatient, createAppointment } from '../../services/api'

const BLOOD_TYPES = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']

const EMPTY_PATIENT = {
  first_name:    '',
  last_name:     '',
  phone:         '',
  date_of_birth: '',
  blood_type:    '',
  email:         '',
}

// ─── reusable form field ──────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
        style={{ color: 'var(--text)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-2'
const inputStyle = { borderColor: 'var(--border)', background: 'white', color: 'var(--text-h)' }

// ─── tab: find existing patient ───────────────────────────────────────────────

function FindPatientTab({ onSelect, selected }) {
  const [query,    setQuery]    = useState('')
  const [patients, setPatients] = useState([])
  const [loading,  setLoading]  = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    getPatients()
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const results = query.length < 1
    ? patients.slice(0, 8)
    : patients.filter(p => {
        const q = query.toLowerCase()
        return (
          p.first_name?.toLowerCase().includes(q) ||
          p.last_name?.toLowerCase().includes(q)  ||
          p.email?.toLowerCase().includes(q)      ||
          p.phone?.includes(q)
        )
      }).slice(0, 10)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text)' }}>
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, email or phone…"
          className={`${inputCls} pl-10`}
          style={inputStyle}
        />
      </div>

      <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: 280 }}>
        {loading && (
          <p className="text-center text-xs py-6" style={{ color: 'var(--text)' }}>Loading patients…</p>
        )}
        {!loading && results.length === 0 && (
          <p className="text-center text-xs py-6" style={{ color: 'var(--text)' }}>
            No patients found for "{query}"
          </p>
        )}
        {!loading && results.map(p => (
          <button key={p.id} type="button"
            onClick={() => onSelect(p)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border-2 transition-all"
            style={{
              borderColor: selected?.id === p.id ? '#6366f1' : 'transparent',
              background:  selected?.id === p.id ? 'rgba(99,102,241,0.06)' : '#f8fafc',
            }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: '#6366f1' }}>
              {p.first_name?.[0]}{p.last_name?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
                {p.first_name} {p.last_name}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text)' }}>
                {[p.email, p.phone, p.blood_type].filter(Boolean).join(' · ')}
              </div>
            </div>
            {selected?.id === p.id && (
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#6366f1' }}>✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── tab: new patient form ────────────────────────────────────────────────────

function NewPatientTab({ form, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="First Name" required>
        <input required value={form.first_name}
          onChange={e => onChange('first_name', e.target.value)}
          placeholder="Jane"
          className={inputCls} style={inputStyle} />
      </Field>

      <Field label="Last Name" required>
        <input required value={form.last_name}
          onChange={e => onChange('last_name', e.target.value)}
          placeholder="Smith"
          className={inputCls} style={inputStyle} />
      </Field>

      <Field label="Phone">
        <input type="tel" value={form.phone}
          onChange={e => onChange('phone', e.target.value)}
          placeholder="+1 (555) 000-0000"
          className={inputCls} style={inputStyle} />
      </Field>

      <Field label="Date of Birth">
        <input type="date" value={form.date_of_birth}
          onChange={e => onChange('date_of_birth', e.target.value)}
          className={inputCls} style={inputStyle} />
      </Field>

      <Field label="Blood Type">
        <select value={form.blood_type}
          onChange={e => onChange('blood_type', e.target.value)}
          className={inputCls} style={inputStyle}>
          <option value="">— Select —</option>
          {BLOOD_TYPES.map(bt => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      </Field>

      <Field label="Email">
        <input type="email" value={form.email}
          onChange={e => onChange('email', e.target.value)}
          placeholder="jane@email.com"
          className={inputCls} style={inputStyle} />
      </Field>
    </div>
  )
}

// ─── main modal ───────────────────────────────────────────────────────────────

export default function CheckInModal({ onClose, onSuccess }) {
  const [tab,         setTab]         = useState('find')   // 'find' | 'new'
  const [selected,    setSelected]    = useState(null)     // existing patient
  const [newForm,     setNewForm]     = useState(EMPTY_PATIENT)
  const [doctors,     setDoctors]     = useState([])
  const [doctorId,    setDoctorId]    = useState('')
  const [apptDate,    setApptDate]    = useState('')
  const [reason,      setReason]      = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState(null)
  const [success,     setSuccess]     = useState(false)

  useEffect(() => {
    getDoctors().then(setDoctors).catch(() => {})
  }, [])

  function setField(key, val) {
    setNewForm(f => ({ ...f, [key]: val }))
  }

  const isNewValid   = newForm.first_name && newForm.last_name
  const isFindValid  = selected !== null
  const canSubmit    = apptDate && reason && (tab === 'new' ? isNewValid : isFindValid)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)

    try {
      let patientId = selected?.id

      if (tab === 'new') {
        const created = await createPatient(newForm)
        patientId = created.id
      }

      await createAppointment({
        patient_id:       patientId,
        doctor_id:        doctorId || 1,
        appointment_date: apptDate,
        reason,
        status:           'scheduled',
      })

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── success screen ────────────────────────────────────────────────────────
  if (success) {
    const name = tab === 'new'
      ? `${newForm.first_name} ${newForm.last_name}`
      : `${selected?.first_name} ${selected?.last_name}`

    return (
      <Overlay onClose={() => { onClose(); onSuccess() }}>
        <div className="flex flex-col items-center text-center py-6 gap-4 px-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: 'rgba(16,185,129,0.12)' }}>
            ✓
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-h)' }}>
              Patient Checked In
            </h3>
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              <strong style={{ color: 'var(--text-h)' }}>{name}</strong> has been added to the queue.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button type="button"
              onClick={() => { setSuccess(false); setSelected(null); setNewForm(EMPTY_PATIENT); setReason(''); setApptDate('') }}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              Check In Another
            </button>
            <button type="button"
              onClick={() => { onClose(); onSuccess() }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#6366f1' }}>
              Done
            </button>
          </div>
        </div>
      </Overlay>
    )
  }

  // ── main form ─────────────────────────────────────────────────────────────
  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* modal header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>Check-In Patient</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
              Find an existing patient or register a new one
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none"
            style={{ background: '#f1f5f9', color: 'var(--text)' }}>
            ×
          </button>
        </div>

        {/* tab switcher */}
        <div className="flex rounded-xl border p-1 gap-1" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          {[{ key: 'find', label: '🔍 Find Patient' }, { key: 'new', label: '➕ New Patient' }].map(t => (
            <button key={t.key} type="button"
              onClick={() => { setTab(t.key); setSelected(null); setError(null) }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t.key ? 'white'         : 'transparent',
                color:      tab === t.key ? 'var(--text-h)' : 'var(--text)',
                boxShadow:  tab === t.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* patient selection */}
        {tab === 'find'
          ? <FindPatientTab selected={selected} onSelect={setSelected} />
          : <NewPatientTab  form={newForm} onChange={setField} />
        }

        {/* appointment section */}
        <div className="rounded-xl border p-4 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>
            Appointment Details
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date & Time" required>
              <input type="datetime-local" required value={apptDate}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setApptDate(e.target.value)}
                className={inputCls} style={inputStyle} />
            </Field>

            <Field label="Reason / Chief Complaint" required>
              <input placeholder="e.g. Annual checkup, Chest pain…" required value={reason}
                onChange={e => setReason(e.target.value)}
                className={inputCls} style={inputStyle} />
            </Field>

            <Field label="Assign Doctor">
              <select value={doctorId} onChange={e => setDoctorId(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="">— Any available —</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name}
                    {d.specialty ? ` (${d.specialty})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)' }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* actions */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit || submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{
              background: '#6366f1',
              opacity: (!canSubmit || submitting) ? 0.45 : 1,
              cursor:  (!canSubmit || submitting) ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Checking in…' : 'Check In Patient'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}

// ─── overlay wrapper ──────────────────────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto"
        style={{
          background:  'white',
          maxHeight:   '92vh',
          boxShadow:   '0 25px 50px -12px rgba(0,0,0,0.35)',
        }}>
        {children}
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
