import { useState, useEffect, useCallback } from 'react'
import {
  saveAppointmentNotes,
  getAppointmentVitals,
  recordAppointmentVitals,
  updateAppointmentStatus,
} from '../../services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

const inp = {
  width: '100%', padding: '8px 11px', borderRadius: 9,
  border: '1px solid var(--border)', background: '#f8fafc',
  fontSize: 13, color: 'var(--text-h)', outline: 'none',
}
const lbl = {
  display: 'block', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text)', marginBottom: 3,
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

// ─── VitalsForm ───────────────────────────────────────────────────────────────

function VitalsForm({ appointmentId, existing, onSaved }) {
  const blank = {
    weight_kg: '', height_cm: '', bp_systolic: '', bp_diastolic: '',
    heart_rate: '', temperature_c: '', oxygen_sat: '', notes: '',
  }
  const [form,    setForm]    = useState(existing ? {
    weight_kg:     existing.weight_kg     ?? '',
    height_cm:     existing.height_cm     ?? '',
    bp_systolic:   existing.bp_systolic   ?? '',
    bp_diastolic:  existing.bp_diastolic  ?? '',
    heart_rate:    existing.heart_rate    ?? '',
    temperature_c: existing.temperature_c ?? '',
    oxygen_sat:    existing.oxygen_sat    ?? '',
    notes:         existing.notes         ?? '',
  } : blank)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {}
      Object.entries(form).forEach(([k, v]) => {
        payload[k] = v === '' ? null : (k === 'notes' ? v : Number(v))
      })
      payload.notes = form.notes || null
      const res = await recordAppointmentVitals(appointmentId, payload)
      onSaved(res.vitals)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'weight_kg',     label: 'Weight (kg)',     placeholder: '70.5' },
    { key: 'height_cm',     label: 'Height (cm)',     placeholder: '175' },
    { key: 'bp_systolic',   label: 'BP Systolic',     placeholder: '120' },
    { key: 'bp_diastolic',  label: 'BP Diastolic',    placeholder: '80' },
    { key: 'heart_rate',    label: 'Heart Rate (bpm)', placeholder: '72' },
    { key: 'temperature_c', label: 'Temp (°C)',        placeholder: '36.6' },
    { key: 'oxygen_sat',    label: 'O₂ Sat (%)',       placeholder: '98' },
  ]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <input type="number" step="any" placeholder={placeholder}
              style={inp} value={form[key]}
              onChange={e => set(key, e.target.value)} />
          </div>
        ))}
      </div>
      <div>
        <label style={lbl}>Notes</label>
        <textarea rows={2} placeholder="Observations…" style={{ ...inp, resize: 'vertical' }}
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
      <button type="submit" disabled={saving}
        className="self-end flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
        style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
        {saving ? <><Spinner /> Saving…</> : 'Save Vitals'}
      </button>
    </form>
  )
}

// ─── VisitPanel ───────────────────────────────────────────────────────────────

export default function VisitPanel({ appointment, onClose, onUpdated }) {
  const [notes,       setNotes]       = useState(appointment?.notes ?? '')
  const [vitals,      setVitals]      = useState(null)
  const [vitalsLoad,  setVitalsLoad]  = useState(true)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesMsg,    setNotesMsg]    = useState(null)
  const [statusSaving,setStatusSaving]= useState(false)

  const apptId = appointment?.id

  const loadVitals = useCallback(async () => {
    if (!apptId) return
    try {
      const v = await getAppointmentVitals(apptId)
      setVitals(v)
    } catch { /* none recorded yet */ }
    finally { setVitalsLoad(false) }
  }, [apptId])

  useEffect(() => { loadVitals() }, [loadVitals])
  useEffect(() => { setNotes(appointment?.notes ?? '') }, [appointment])

  async function handleSaveNotes() {
    setNotesSaving(true)
    setNotesMsg(null)
    try {
      const res = await saveAppointmentNotes(apptId, notes)
      setNotesMsg({ ok: true, text: 'Notes saved.' })
      onUpdated?.(res.appointment)
    } catch (err) {
      setNotesMsg({ ok: false, text: err.message })
    } finally {
      setNotesSaving(false)
      setTimeout(() => setNotesMsg(null), 3000)
    }
  }

  async function handleStatus(status) {
    setStatusSaving(true)
    try {
      const res = await updateAppointmentStatus(apptId, status)
      onUpdated?.(res.appointment)
    } catch { /* ignore */ }
    finally { setStatusSaving(false) }
  }

  const status = appointment?.status?.toLowerCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-start justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>
              Visit — {appointment?.patient_name ?? 'Patient'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
              {fmtDate(appointment?.appointment_date)} · {appointment?.reason ?? 'No reason stated'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === 'waiting' && (
              <button onClick={() => handleStatus('in_progress')} disabled={statusSaving}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: '#2563eb' }}>
                Start Visit
              </button>
            )}
            {status === 'in_progress' && (
              <button onClick={() => handleStatus('completed')} disabled={statusSaving}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: '#059669' }}>
                Complete Visit
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100"
              style={{ color: 'var(--text)' }}>
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* vitals */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text)' }}>
              Vitals
            </h3>
            {vitalsLoad ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                <Spinner /> Loading vitals…
              </div>
            ) : (
              <VitalsForm
                appointmentId={apptId}
                existing={vitals}
                onSaved={v => setVitals(v)}
              />
            )}
          </section>

          {/* clinical notes */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text)' }}>
              Clinical Notes
            </h3>
            <textarea
              rows={5}
              placeholder="Enter clinical observations, diagnosis, treatment plan…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div className="flex items-center justify-between mt-2">
              {notesMsg && (
                <span className="text-xs font-medium" style={{ color: notesMsg.ok ? '#059669' : '#dc2626' }}>
                  {notesMsg.text}
                </span>
              )}
              <button onClick={handleSaveNotes} disabled={notesSaving}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: '#0d9488', opacity: notesSaving ? 0.6 : 1 }}>
                {notesSaving ? <><Spinner /> Saving…</> : 'Save Notes'}
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
