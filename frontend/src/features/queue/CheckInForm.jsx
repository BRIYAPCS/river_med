import { useState, useEffect } from 'react'
import { getPatients, createPatient, createAppointment } from '../../services/api'

const EMPTY_NEW = {
  first_name: '', last_name: '', email: '', phone: '',
  date_of_birth: '', blood_type: '',
}

export default function CheckInForm({ onSuccess, onCancel }) {
  const [mode,        setMode]        = useState('search')  // 'search' | 'new'
  const [query,       setQuery]       = useState('')
  const [patients,    setPatients]    = useState([])
  const [pLoad,       setPLoad]       = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [newForm,     setNewForm]     = useState(EMPTY_NEW)
  const [apptDate,    setApptDate]    = useState('')
  const [reason,      setReason]      = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch(e => setError(e.message))
      .finally(() => setPLoad(false))
  }, [])

  const filtered = patients.filter(p => {
    const q = query.toLowerCase()
    return (
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q)  ||
      p.email?.toLowerCase().includes(q)
    )
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      let patientId = selected?.id

      if (mode === 'new') {
        const created = await createPatient(newForm)
        patientId = created.id
      }

      await createAppointment({
        patient_id:       patientId,
        doctor_id:        1,
        appointment_date: apptDate,
        reason,
        status:           'scheduled',
      })
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    apptDate &&
    reason &&
    (mode === 'new'
      ? newForm.first_name && newForm.last_name
      : selected !== null)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* mode toggle */}
      <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {['search', 'new'].map(m => (
          <button key={m} type="button"
            onClick={() => { setMode(m); setSelected(null); setError(null) }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{
              background: mode === m ? 'var(--primary)' : 'transparent',
              color:      mode === m ? '#fff'           : 'var(--text)',
            }}>
            {m === 'search' ? 'Existing Patient' : 'New Patient'}
          </button>
        ))}
      </div>

      {/* ── search mode ── */}
      {mode === 'search' && (
        <div>
          <input
            placeholder="Search by name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none mb-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
          />
          {pLoad && <p className="text-xs text-center py-4" style={{ color: 'var(--text)' }}>Loading…</p>}
          <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
            {!pLoad && filtered.slice(0, 12).map(p => (
              <button key={p.id} type="button"
                onClick={() => setSelected(p)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-left border transition-all"
                style={{
                  borderColor: selected?.id === p.id ? 'var(--primary)' : 'var(--border)',
                  background:  selected?.id === p.id ? 'var(--primary-bg)' : 'transparent',
                }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: 'var(--primary)' }}>
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text)' }}>{p.email}</div>
                </div>
              </button>
            ))}
            {!pLoad && filtered.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text)' }}>
                No patients found.{' '}
                <button type="button" className="underline" style={{ color: 'var(--accent)' }}
                  onClick={() => setMode('new')}>
                  Create new?
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── new patient mode ── */}
      {mode === 'new' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'first_name', label: 'First Name', required: true },
            { key: 'last_name',  label: 'Last Name',  required: true },
            { key: 'email',      label: 'Email',      span: 2 },
            { key: 'phone',      label: 'Phone' },
            { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
            { key: 'blood_type', label: 'Blood Type', placeholder: 'e.g. O+' },
          ].map(({ key, label, span, type = 'text', required, placeholder }) => (
            <div key={key} className={span === 2 ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
                {label}{required && ' *'}
              </label>
              <input
                type={type}
                required={required}
                placeholder={placeholder}
                value={newForm[key]}
                onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* appointment fields */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
            Date & Time *
          </label>
          <input type="datetime-local" required value={apptDate}
            onChange={e => setApptDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
            Reason *
          </label>
          <input placeholder="Chief complaint…" required value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-opacity hover:opacity-70"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!canSubmit || submitting}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
          style={{
            background: 'var(--primary)',
            opacity: (!canSubmit || submitting) ? 0.5 : 1,
            cursor: (!canSubmit || submitting) ? 'not-allowed' : 'pointer',
          }}>
          {submitting ? 'Checking in…' : 'Check In'}
        </button>
      </div>
    </form>
  )
}
