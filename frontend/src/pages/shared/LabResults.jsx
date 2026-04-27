import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getLabResults, createLabResult, updateLabResult, deleteLabResult, getPatients } from '../../services/api'

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
  pending:  { background: '#fef3c7', color: '#92400e' },
  resulted: { background: '#dbeafe', color: '#1d4ed8' },
  reviewed: { background: '#d1fae5', color: '#065f46' },
}

const inp = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#f8fafc', fontSize: 14, color: 'var(--text-h)', outline: 'none' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: 4 }

// ─── CreateForm ───────────────────────────────────────────────────────────────

function CreateForm({ patients, onCreated, onCancel }) {
  const [form, setForm] = useState({
    patient_id: '', test_name: '', result_value: '', unit: '',
    reference_range: '', status: 'pending', notes: '', resulted_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await createLabResult({
        patient_id:     Number(form.patient_id),
        test_name:      form.test_name,
        result_value:   form.result_value  || null,
        unit:           form.unit          || null,
        reference_range:form.reference_range || null,
        status:         form.status,
        notes:          form.notes         || null,
        resulted_at:    form.resulted_at   || null,
      })
      onCreated(res.lab_result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

      <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>New Lab Result</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={lbl}>Patient *</label>
          <select required style={inp} value={form.patient_id} onChange={e => set('patient_id', e.target.value)}>
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Test Name *</label>
          <input required style={inp} placeholder="e.g. Complete Blood Count" value={form.test_name} onChange={e => set('test_name', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Result Value</label>
          <input style={inp} placeholder="e.g. 12.5" value={form.result_value} onChange={e => set('result_value', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Unit</label>
          <input style={inp} placeholder="e.g. g/dL" value={form.unit} onChange={e => set('unit', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Reference Range</label>
          <input style={inp} placeholder="e.g. 12–17 g/dL" value={form.reference_range} onChange={e => set('reference_range', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="resulted">Resulted</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Result Date</label>
          <input type="datetime-local" style={inp} value={form.resulted_at} onChange={e => set('resulted_at', e.target.value)} />
        </div>
      </div>

      <div>
        <label style={lbl}>Notes</label>
        <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</p>}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-5 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Add Lab Result'}
        </button>
      </div>
    </form>
  )
}

// ─── LabResultCard ────────────────────────────────────────────────────────────

function LabResultCard({ lr, canEdit, onDelete, onStatusChange }) {
  const [editing, setEditing] = useState(false)
  const [status,  setStatus]  = useState(lr.status)
  const [saving,  setSaving]  = useState(false)
  const sc = STATUS_COLOR[lr.status] ?? STATUS_COLOR.pending

  async function handleStatusSave() {
    setSaving(true)
    try {
      const res = await updateLabResult(lr.id, { status })
      onStatusChange(res.lab_result)
      setEditing(false)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${lr.test_name}"?`)) return
    try { await deleteLabResult(lr.id); onDelete(lr.id) } catch { /* silent */ }
  }

  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>{lr.test_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={sc}>{lr.status}</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text)' }}>
            {lr.patient_name && <span>Patient: {lr.patient_name} · </span>}
            {fmtDate(lr.resulted_at ?? lr.created_at)}
          </div>
        </div>
        {lr.result_value && (
          <div className="flex-shrink-0 text-right">
            <div className="text-base font-bold" style={{ color: '#0d9488' }}>
              {lr.result_value} {lr.unit}
            </div>
            {lr.reference_range && (
              <div className="text-xs" style={{ color: 'var(--text)' }}>Ref: {lr.reference_range}</div>
            )}
          </div>
        )}
      </div>

      {lr.notes && <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{lr.notes}</p>}

      {canEdit && (
        <div className="flex gap-2 flex-wrap items-center">
          {editing ? (
            <>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', outline: 'none' }}>
                <option value="pending">Pending</option>
                <option value="resulted">Resulted</option>
                <option value="reviewed">Reviewed</option>
              </select>
              <button onClick={handleStatusSave} disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>Update Status</button>
              <button onClick={handleDelete} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ color: '#dc2626' }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── LabResults ───────────────────────────────────────────────────────────────

export default function LabResults({ patientIdOverride }) {
  const { user }  = useAuth()
  const isDoctor  = user?.role === 'doctor' || user?.role === 'admin'
  const [results, setResults]   = useState([])
  const [patients,setPatients]  = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm,setShowForm]  = useState(false)
  const [toast,   setToast]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLabResults(patientIdOverride ?? null)
      setResults(Array.isArray(data) ? data : [])
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

  function handleCreated(lr) { setResults(prev => [lr, ...prev]); setShowForm(false); setToast('Lab result added.') }
  function handleDelete(id)  { setResults(prev => prev.filter(r => r.id !== id)); setToast('Deleted.') }
  function handleUpdate(lr)  { setResults(prev => prev.map(r => r.id === lr.id ? lr : r)) }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Toast msg={toast} onDismiss={() => setToast(null)} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Lab Results</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
            {isDoctor ? 'Lab results for your patients' : 'Your laboratory test results'}
          </p>
        </div>
        {isDoctor && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: '#0d9488' }}>
            + Add Result
          </button>
        )}
      </div>

      {showForm && (
        <CreateForm patients={patients} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text)' }}><Spinner /> Loading…</div>}

      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl opacity-20">🧪</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No lab results yet</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-4">
          {results.map(lr => (
            <LabResultCard key={lr.id} lr={lr} canEdit={isDoctor}
              onDelete={handleDelete} onStatusChange={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
