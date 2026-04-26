import { useState, useEffect, useCallback } from 'react'
import { getMyPrescriptions, createPrescription, getDoctors, getPatients } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

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

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border)', color: 'var(--text-h)',
  background: '#f8fafc', fontSize: 14, outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 6,
}

// ─── WritePrescriptionForm ────────────────────────────────────────────────────

function WritePrescriptionForm({ patients, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    patient_id: '', medication_name: '', dosage: '',
    instructions: '', refill_allowed: false,
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="bg-white rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

      <h2 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
        Write New Prescription
      </h2>

      <div>
        <label style={labelStyle}>Patient *</label>
        <select required value={form.patient_id} onChange={e => set('patient_id', e.target.value)}
          style={inputStyle}>
          <option value="">Select patient…</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>
              {p.first_name} {p.last_name}
              {p.email ? ` — ${p.email}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Medication Name *</label>
          <input required type="text" placeholder="e.g. Amoxicillin"
            value={form.medication_name} onChange={e => set('medication_name', e.target.value)}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Dosage *</label>
          <input required type="text" placeholder="e.g. 500mg twice daily"
            value={form.dosage} onChange={e => set('dosage', e.target.value)}
            style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Instructions <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <textarea rows={3} placeholder="Take with food. Complete the full course."
          value={form.instructions} onChange={e => set('instructions', e.target.value)}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={form.refill_allowed}
          onChange={e => set('refill_allowed', e.target.checked)}
          className="w-4 h-4 rounded" style={{ accentColor: '#0d9488' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
          Allow patient to request refills
        </span>
      </label>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: '#0d9488', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? <><Spinner size={3} /> Writing…</> : '💊 Write Prescription'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── PrescriptionCard ─────────────────────────────────────────────────────────

function PrescriptionCard({ rx }) {
  return (
    <div className="bg-white rounded-2xl border p-4 flex items-start gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* patient avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: '#6366f1' }}>
        {initials(rx.patient_name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
            {rx.medication_name}
          </span>
          {rx.refill_allowed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>
              Refills ✓
            </span>
          )}
        </div>
        <p className="text-xs font-medium" style={{ color: '#0d9488' }}>{rx.dosage}</p>
        {rx.instructions && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text)' }}>
            {rx.instructions}
          </p>
        )}
        <p className="text-xs mt-1.5" style={{ color: 'var(--text)' }}>
          Patient: <span className="font-semibold" style={{ color: 'var(--text-h)' }}>
            {rx.patient_name ?? '—'}
          </span>
          {' · '}{fmtDate(rx.created_at)}
        </p>
      </div>
    </div>
  )
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export default function DoctorPrescriptions() {
  const { user } = useAuth()

  const [prescriptions, setPrescriptions] = useState([])
  const [patients,      setPatients]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [showForm,      setShowForm]      = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [search,        setSearch]        = useState('')
  const [toast,         setToast]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyPrescriptions()
      setPrescriptions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { getPatients().then(setPatients).catch(() => {}) }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleCreate(form) {
    setCreating(true)
    try {
      await createPrescription({
        patient_id:      Number(form.patient_id),
        medication_name: form.medication_name,
        dosage:          form.dosage,
        instructions:    form.instructions || undefined,
        refill_allowed:  form.refill_allowed,
      })
      setToast({ message: 'Prescription written successfully.', type: 'success' })
      setShowForm(false)
      await load()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const filtered = search.trim()
    ? prescriptions.filter(rx =>
        rx.medication_name?.toLowerCase().includes(search.toLowerCase()) ||
        rx.patient_name?.toLowerCase().includes(search.toLowerCase())
      )
    : prescriptions

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />

      <div className="flex flex-col gap-6">

        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Prescriptions</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
              Medications you have prescribed
            </p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#0d9488' }}>
              + Write Prescription
            </button>
          )}
        </div>

        {/* write form */}
        {showForm && (
          <WritePrescriptionForm
            patients={patients}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={creating}
          />
        )}

        {/* search */}
        {!loading && prescriptions.length > 0 && (
          <div style={{ position: 'relative', maxWidth: 360 }}>
            <input
              type="text"
              placeholder="Search by medication or patient…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px 9px 36px',
                borderRadius: 12, border: '1px solid var(--border)',
                color: 'var(--text-h)', background: '#fff',
                fontSize: 13, outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text)', fontSize: 14 }}>
              🔍
            </span>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div className="flex items-center gap-2 py-10 justify-center" style={{ color: 'var(--text)' }}>
            <Spinner size={5} /> Loading prescriptions…
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
        {!loading && !error && prescriptions.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-5xl opacity-20">💊</span>
            <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
              No prescriptions written yet
            </p>
            <p className="text-xs" style={{ color: 'var(--text)' }}>
              Write a prescription using the button above, or via a patient's record in the queue.
            </p>
          </div>
        )}

        {/* list */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {search && filtered.length !== prescriptions.length && (
              <p className="text-xs" style={{ color: 'var(--text)' }}>
                {filtered.length} of {prescriptions.length} prescriptions
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(rx => <PrescriptionCard key={rx.id} rx={rx} />)}
            </div>
          </>
        )}

        {!loading && !error && search && filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text)' }}>
            No results for "{search}"
          </p>
        )}
      </div>
    </>
  )
}
