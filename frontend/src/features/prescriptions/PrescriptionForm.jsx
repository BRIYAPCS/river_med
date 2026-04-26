import { useState } from 'react'
import { createPrescription } from '../../services/api'

const EMPTY = {
  medication_name: '',
  dosage:          '',
  instructions:    '',
  refill_allowed:  false,
}

const inputCls   = 'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors'
const inputStyle = { borderColor: 'var(--border)', background: 'white', color: 'var(--text-h)' }

// Pure inline form — no modal wrapper.
// Callers that need a modal must supply their own overlay.
export default function PrescriptionForm({ patientId, doctorId = 1, onSuccess, onCancel }) {
  const [form,       setForm]       = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)
  const [saved,      setSaved]      = useState(false)

  function field(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createPrescription({
        patient_id: patientId,
        doctor_id:  doctorId,
        ...form,
      })
      setSaved(true)
      setTimeout(() => onSuccess?.(), 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
        style={{ background: 'rgba(16,185,129,0.10)' }}>
        <span className="text-xl">✓</span>
        <p className="text-sm font-semibold" style={{ color: '#059669' }}>
          Prescription saved successfully
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* medication + dosage */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text)' }}>
            Medication Name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            required
            value={form.medication_name}
            onChange={e => field('medication_name', e.target.value)}
            placeholder="e.g. Metformin 500mg"
            className={inputCls} style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text)' }}>
            Dosage <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            required
            value={form.dosage}
            onChange={e => field('dosage', e.target.value)}
            placeholder="e.g. 500mg twice daily"
            className={inputCls} style={inputStyle}
          />
        </div>
      </div>

      {/* instructions */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
          style={{ color: 'var(--text)' }}>
          Instructions
        </label>
        <textarea
          rows={3}
          value={form.instructions}
          onChange={e => field('instructions', e.target.value)}
          placeholder="Take with food. Avoid alcohol. Monitor blood sugar daily…"
          className={`${inputCls} resize-none`} style={inputStyle}
        />
      </div>

      {/* refill checkbox */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.refill_allowed}
          onChange={e => field('refill_allowed', e.target.checked)}
          className="w-4 h-4 rounded accent-blue-600"
        />
        <span className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
          Allow patient to request refills
        </span>
      </label>

      {/* error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
          <span>⚠</span> {error}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Cancel
          </button>
        )}
        <button type="submit"
          disabled={!form.medication_name || !form.dosage || submitting}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity flex items-center justify-center gap-2"
          style={{
            background: '#0d9488',
            opacity: (!form.medication_name || !form.dosage || submitting) ? 0.45 : 1,
            cursor:  submitting ? 'not-allowed' : 'pointer',
          }}>
          {submitting && <SpinIcon />}
          {submitting ? 'Saving…' : 'Save Prescription'}
        </button>
      </div>
    </form>
  )
}

function SpinIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}
