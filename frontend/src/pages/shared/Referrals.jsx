import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getReferrals, createReferral, updateReferralStatus, getPatients } from '../../services/api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

function Toast({ msg, onDismiss }) {
  if (!msg) return null
  const err = msg.startsWith('Error')
  return (
    <div onClick={onDismiss} className="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: err ? '#dc2626' : '#059669' }}>
      {err ? '⚠ ' : '✓ '}{msg}
    </div>
  )
}

const STATUS_COLOR = {
  pending:   { background: '#fef3c7', color: '#92400e' },
  accepted:  { background: '#dbeafe', color: '#1d4ed8' },
  completed: { background: '#d1fae5', color: '#065f46' },
  cancelled: { background: '#fee2e2', color: '#991b1b' },
}

const inp = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#f8fafc', fontSize: 14, color: 'var(--text-h)', outline: 'none' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: 4 }

const SPECIALTIES = ['Cardiology','Dermatology','Endocrinology','Gastroenterology','Neurology',
  'Oncology','Ophthalmology','Orthopedics','Psychiatry','Pulmonology','Rheumatology','Urology','Other']

// ─── CreateReferralForm ───────────────────────────────────────────────────────

function CreateReferralForm({ patients, onCreated, onCancel }) {
  const [form, setForm] = useState({ patient_id: '', referred_to_name: '', referred_specialty: '', reason: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await createReferral({
        patient_id:        Number(form.patient_id),
        referred_to_name:  form.referred_to_name   || null,
        referred_specialty:form.referred_specialty  || null,
        reason:            form.reason             || null,
        notes:             form.notes              || null,
      })
      onCreated(res.referral)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

      <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>New Referral</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={lbl}>Patient *</label>
          <select required style={inp} value={form.patient_id} onChange={e => set('patient_id', e.target.value)}>
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Specialty</label>
          <select style={inp} value={form.referred_specialty} onChange={e => set('referred_specialty', e.target.value)}>
            <option value="">— Select specialty —</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Referred To (Name / Clinic)</label>
          <input style={inp} placeholder="Dr. Smith / City Cardiology Center" value={form.referred_to_name} onChange={e => set('referred_to_name', e.target.value)} />
        </div>
      </div>

      <div>
        <label style={lbl}>Reason for Referral *</label>
        <textarea required rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Clinical reason for this referral…"
          value={form.reason} onChange={e => set('reason', e.target.value)} />
      </div>

      <div>
        <label style={lbl}>Additional Notes</label>
        <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</p>}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-5 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Create Referral'}
        </button>
      </div>
    </form>
  )
}

// ─── ReferralCard ─────────────────────────────────────────────────────────────

function ReferralCard({ referral: r, canEdit, onStatusChange }) {
  const [editing, setEditing] = useState(false)
  const [status,  setStatus]  = useState(r.status)
  const [saving,  setSaving]  = useState(false)
  const sc = STATUS_COLOR[r.status] ?? STATUS_COLOR.pending

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateReferralStatus(r.id, status)
      onStatusChange(res.referral)
      setEditing(false)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
              {r.referred_specialty || r.referred_to_name || 'Referral'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={sc}>{r.status}</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text)' }}>
            {r.patient_name && <span>Patient: {r.patient_name} · </span>}
            {r.referred_to_name && <span>To: {r.referred_to_name} · </span>}
            {fmtDate(r.created_at)}
          </div>
        </div>
      </div>

      {r.reason && <p className="text-sm" style={{ color: 'var(--text-h)' }}>{r.reason}</p>}
      {r.notes && <p className="text-xs italic" style={{ color: 'var(--text)' }}>{r.notes}</p>}
      {r.doctor_name?.trim() && <p className="text-xs" style={{ color: 'var(--text)' }}>Referring: Dr. {r.doctor_name}</p>}

      {canEdit && (
        <div className="flex gap-2 flex-wrap items-center">
          {editing ? (
            <>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', outline: 'none' }}>
                {['pending','accepted','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleSave} disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>
              Update Status
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export default function Referrals({ patientIdOverride }) {
  const { user }   = useAuth()
  const isDoctor   = user?.role === 'doctor' || user?.role === 'admin'
  const [refs,     setRefs]     = useState([])
  const [patients, setPatients] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast,    setToast]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReferrals(patientIdOverride ?? null)
      setRefs(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [patientIdOverride])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (isDoctor) getPatients().then(setPatients).catch(() => {}) }, [isDoctor])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function handleCreated(r) { setRefs(prev => [r, ...prev]); setShowForm(false); setToast('Referral created.') }
  function handleUpdate(r)  { setRefs(prev => prev.map(x => x.id === r.id ? r : x)) }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Toast msg={toast} onDismiss={() => setToast(null)} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Referrals</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
            {isDoctor ? 'Referrals you have issued' : 'Your specialist referrals'}
          </p>
        </div>
        {isDoctor && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: '#0d9488' }}>
            + New Referral
          </button>
        )}
      </div>

      {showForm && (
        <CreateReferralForm patients={patients} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text)' }}><Spinner /> Loading…</div>}

      {!loading && refs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl opacity-20">📋</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No referrals yet</p>
        </div>
      )}

      {!loading && refs.length > 0 && (
        <div className="flex flex-col gap-4">
          {refs.map(r => (
            <ReferralCard key={r.id} referral={r} canEdit={isDoctor} onStatusChange={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
