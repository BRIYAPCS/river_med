import { useState, useEffect } from 'react'
import { getMyPatient, updateMyPatient, getInsurance, upsertInsurance } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(iso))
}

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
const BLOOD_COLOR = {
  'A+': '#6366f1','A-': '#8b5cf6','B+': '#0d9488','B-': '#14b8a6',
  'O+': '#f59e0b','O-': '#d97706','AB+': '#3b82f6','AB-': '#2563eb',
}

const field = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: '#f8fafc',
  fontSize: 14, color: 'var(--text-h)', outline: 'none',
}
const label = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 4,
}

// ─── micro components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function InfoRow({ label: lbl, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{lbl}</dt>
      <dd className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{value}</dd>
    </div>
  )
}

// ─── EditForm ─────────────────────────────────────────────────────────────────

function EditForm({ patient, onSave, onCancel }) {
  const [form, setForm]       = useState({
    first_name:       patient?.first_name       ?? '',
    middle_name:      patient?.middle_name      ?? '',
    last_name:        patient?.last_name        ?? '',
    second_last_name: patient?.second_last_name ?? '',
    phone:            patient?.phone            ?? '',
    date_of_birth:    patient?.date_of_birth?.slice(0,10) ?? '',
    blood_type:       patient?.blood_type       ?? '',
  })
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState(null)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateMyPatient({
        first_name:       form.first_name       || undefined,
        middle_name:      form.middle_name      || null,
        last_name:        form.last_name        || undefined,
        second_last_name: form.second_last_name || null,
        phone:            form.phone            || null,
        date_of_birth:    form.date_of_birth    || null,
        blood_type:       form.blood_type       || null,
      })
      onSave(updated.patient)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          ['first_name',       'First Name *'],
          ['middle_name',      'Middle Name'],
          ['last_name',        'Last Name *'],
          ['second_last_name', 'Second Last Name'],
          ['phone',            'Phone Number'],
        ].map(([key, lbl]) => (
          <div key={key}>
            <label style={label}>{lbl}</label>
            <input
              style={field}
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              required={key === 'first_name' || key === 'last_name'}
            />
          </div>
        ))}

        <div>
          <label style={label}>Date of Birth</label>
          <input type="date" style={field}
            value={form.date_of_birth}
            onChange={e => set('date_of_birth', e.target.value)}
          />
        </div>

        <div>
          <label style={label}>Blood Type</label>
          <select style={field} value={form.blood_type} onChange={e => set('blood_type', e.target.value)}>
            <option value="">— Not set —</option>
            {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'var(--primary)', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ─── InsuranceSection ─────────────────────────────────────────────────────────

function InsuranceSection({ patientId }) {
  const [ins,     setIns]     = useState(null)
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)

  useEffect(() => {
    getInsurance(null).then(data => {
      setIns(data)
      setForm({
        carrier:          data?.carrier          ?? '',
        policy_number:    data?.policy_number    ?? '',
        group_number:     data?.group_number     ?? '',
        subscriber_name:  data?.subscriber_name  ?? '',
        valid_from:       data?.valid_from?.slice(0,10)  ?? '',
        valid_until:      data?.valid_until?.slice(0,10) ?? '',
      })
    }).catch(() => {})
  }, [patientId])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const res = await upsertInsurance({ carrier: form.carrier, policy_number: form.policy_number, group_number: form.group_number, subscriber_name: form.subscriber_name, valid_from: form.valid_from || null, valid_until: form.valid_until || null, patient_id: patientId })
      setIns(res.insurance)
      setEditing(false)
      setMsg({ ok: true, text: 'Insurance saved.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3500)
    }
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#f8fafc', fontSize: 14, color: 'var(--text-h)', outline: 'none' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: 4 }

  return (
    <div className="bg-white rounded-2xl border p-6"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text)' }}>Insurance</h3>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg border font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>
            {ins?.provider_name ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {msg && (
        <p className="text-xs font-medium mb-3" style={{ color: msg.ok ? '#059669' : '#dc2626' }}>{msg.text}</p>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['carrier',         'Insurance Carrier *', true],
              ['policy_number',   'Policy Number *', true],
              ['group_number',    'Group Number', false],
              ['subscriber_name', 'Subscriber Name', false],
            ].map(([k, l, req]) => (
              <div key={k}>
                <label style={lbl}>{l}</label>
                <input style={inp} required={req} value={form[k] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={lbl}>Effective Date</label>
              <input type="date" style={inp} value={form.valid_from ?? ''}
                onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Expiry Date</label>
              <input type="date" style={inp} value={form.valid_until ?? ''}
                onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditing(false)}
              className="px-5 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--primary)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save Insurance'}
            </button>
          </div>
        </form>
      ) : ins?.provider_name ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ['Carrier',      ins.carrier],
            ['Policy #',     ins.policy_number],
            ['Group #',      ins.group_number],
            ['Subscriber',   ins.subscriber_name],
            ['Effective',    ins.valid_from?.slice(0,10)],
            ['Expires',      ins.valid_until?.slice(0,10)],
          ].filter(([,v]) => v).map(([lbl2, val]) => (
            <div key={lbl2} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{lbl2}</dt>
              <dd className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{val}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text)' }}>No insurance information on file.</p>
      )}
    </div>
  )
}

// ─── PatientProfile ───────────────────────────────────────────────────────────

export default function PatientProfile() {
  const { user }      = useAuth()
  const patientId     = user?.patient_id ?? null
  const [patient,  setPatient]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [editing,  setEditing]  = useState(false)
  const [toast,    setToast]    = useState(null)

  useEffect(() => {
    getMyPatient()
      .then(setPatient)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function handleSaved(updated) {
    setPatient(updated)
    setEditing(false)
    setToast('Profile updated successfully.')
  }

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-20" style={{ color: 'var(--text)' }}>
      <Spinner /> Loading your profile…
    </div>
  )

  if (!patientId) return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="text-5xl opacity-20">🏥</span>
      <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>Account not linked to a patient record</p>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text)' }}>Contact support at{' '}
        <a href="mailto:support@rivermed.com" className="font-semibold" style={{ color: 'var(--primary)' }}>support@rivermed.com</a>
      </p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>Could not load your profile</p>
      <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
      <button onClick={() => { setError(null); setLoading(true); getMyPatient().then(setPatient).catch(e => setError(e.message)).finally(() => setLoading(false)) }}
        className="text-sm font-semibold px-4 py-2 rounded-xl border"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
        Try again
      </button>
    </div>
  )

  const fullName   = [patient?.first_name, patient?.middle_name, patient?.last_name, patient?.second_last_name].filter(Boolean).join(' ')
  const dob        = patient?.date_of_birth
  const patientAge = age(dob)
  const btColor    = BLOOD_COLOR[patient?.blood_type] ?? '#6b7280'
  const initials   = [patient?.first_name?.[0], patient?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* success toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white"
          style={{ background: '#059669' }}>
          ✓ {toast}
        </div>
      )}

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Profile</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Your personal health record at River Med</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>
            <EditIcon /> Edit Profile
          </button>
        )}
      </div>

      {/* identity card */}
      <div className="bg-white rounded-2xl border p-6 flex items-center gap-5"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
          style={{ background: 'var(--primary)' }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-h)' }}>{fullName || 'Name not set'}</h2>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{patient?.email ?? user?.email ?? '—'}</p>
          {patientAge && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>Age {patientAge}</p>}
        </div>
        {patient?.blood_type && (
          <div className="ml-auto flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold"
            style={{ background: btColor + '15' }}>
            <span className="text-xs" style={{ color: btColor }}>Blood</span>
            <span className="text-lg leading-none" style={{ color: btColor }}>{patient.blood_type}</span>
          </div>
        )}
      </div>

      {/* edit form or read view */}
      <div className="bg-white rounded-2xl border p-6"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text)' }}>
          Personal Information
        </h3>

        {editing ? (
          <EditForm patient={patient} onSave={handleSaved} onCancel={() => setEditing(false)} />
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="First Name"       value={patient?.first_name} />
            <InfoRow label="Middle Name"      value={patient?.middle_name} />
            <InfoRow label="Last Name"        value={patient?.last_name} />
            <InfoRow label="Second Last Name" value={patient?.second_last_name} />
            <InfoRow label="Email"            value={patient?.email ?? user?.email} />
            <InfoRow label="Phone"            value={patient?.phone} />
            <InfoRow label="Date of Birth"
              value={dob ? `${fmtDate(dob)}${patientAge ? ` (${patientAge} years old)` : ''}` : null} />
            <InfoRow label="Blood Type"       value={patient?.blood_type} />
          </dl>
        )}
      </div>

      {/* account info */}
      {!editing && (
        <div className="bg-white rounded-2xl border p-6"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text)' }}>Account</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="Role"        value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : null} />
            <InfoRow label="Patient ID"  value={patient?.id ? `#${patient.id}` : null} />
            <InfoRow label="Member Since" value={fmtDate(patient?.created_at)} />
          </dl>
        </div>
      )}

      {/* insurance */}
      {!editing && patientId && <InsuranceSection patientId={patientId} />}
    </div>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}
