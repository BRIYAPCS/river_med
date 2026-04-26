import { useState, useEffect } from 'react'
import {
  getPatients,
  getDoctors,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from '../../services/api'

// Convert any Date to the value required by <input type="datetime-local">
function toDatetimeLocal(date) {
  const d   = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

// Convert datetime-local string to MySQL DATETIME string
function toMysqlDatetime(datetimeLocal) {
  return datetimeLocal.replace('T', ' ') + ':00'
}

const STATUS_OPTIONS = [
  { value: 'waiting',     label: 'Waiting' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

// ─── AppointmentModal ──────────────────────────────────────────────────────────
// Props:
//   mode      'create' | 'edit'
//   slot      { start: Date }        — create mode: pre-fills the datetime
//   event     calendar event object  — edit mode: { id, resource: appt row }
//   onSave    (savedAppt) => void
//   onDelete  (id) => void
//   onClose   () => void

export default function AppointmentModal({ mode, slot, event, onSave, onDelete, onClose }) {
  const appt = event?.resource ?? null

  const [patients, setPatients] = useState([])
  const [doctors,  setDoctors]  = useState([])
  const [fetching, setFetching] = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [confirm,  setConfirm]  = useState(false)

  // controlled form
  const [patientId, setPatientId] = useState(String(appt?.patient_id ?? ''))
  const [doctorId,  setDoctorId]  = useState(String(appt?.doctor_id  ?? ''))
  const [datetime,  setDatetime]  = useState(
    appt
      ? toDatetimeLocal(new Date(appt.appointment_date))
      : toDatetimeLocal(slot?.start ?? new Date())
  )
  const [reason, setReason] = useState(appt?.reason ?? '')
  const [status, setStatus] = useState(appt?.status ?? 'waiting')

  // load patient + doctor lists once
  useEffect(() => {
    Promise.all([getPatients(), getDoctors()])
      .then(([p, d]) => { setPatients(p); setDoctors(d) })
      .catch(err => setError(err.message))
      .finally(() => setFetching(false))
  }, [])

  // reset two-click confirm when appointment changes
  useEffect(() => { setConfirm(false) }, [event?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body = {
        patient_id:       Number(patientId),
        doctor_id:        Number(doctorId),
        appointment_date: toMysqlDatetime(datetime),
        reason:           reason.trim() || null,
        status,
      }

      if (mode === 'create') {
        const res = await createAppointment(body)
        onSave({ ...body, id: res.id })
      } else {
        const res = await updateAppointment(event.id, body)
        onSave(res.appointment)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    setLoading(true)
    try {
      await deleteAppointment(event.id)
      onDelete(event.id)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={handleBackdrop}>

      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        style={{ border: '1px solid var(--border)' }}>

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>
            {mode === 'create' ? 'New Appointment' : 'Edit Appointment'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none transition-colors hover:bg-gray-100"
            style={{ color: 'var(--text)' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

          {/* patient */}
          <Field label="Patient">
            <select
              required
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              disabled={fetching}
              style={selectStyle}>
              <option value="">Select patient…</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </Field>

          {/* doctor */}
          <Field label="Doctor">
            <select
              required
              value={doctorId}
              onChange={e => setDoctorId(e.target.value)}
              disabled={fetching}
              style={selectStyle}>
              <option value="">Select doctor…</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.first_name} {d.last_name}{d.specialty ? ` — ${d.specialty}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {/* date + time */}
          <Field label="Date & Time">
            <input
              type="datetime-local"
              required
              value={datetime}
              onChange={e => setDatetime(e.target.value)}
              style={selectStyle}
            />
          </Field>

          {/* reason */}
          <Field label="Reason (optional)">
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Annual check-up"
              style={selectStyle}
            />
          </Field>

          {/* status — edit only */}
          {mode === 'edit' && (
            <Field label="Status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={selectStyle}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          )}

          {/* error */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* actions */}
          <div className="flex items-center justify-between pt-1">
            {/* delete (edit mode only) */}
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: confirm ? '#ef4444' : 'rgba(239,68,68,0.08)',
                  color:      confirm ? '#fff'     : '#dc2626',
                }}>
                {confirm ? 'Confirm delete?' : 'Delete'}
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl border text-sm font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || fetching}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-opacity"
                style={{
                  background: 'var(--primary)',
                  opacity:    loading || fetching ? 0.6 : 1,
                  cursor:     loading || fetching ? 'not-allowed' : 'pointer',
                }}>
                {loading ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--text)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const selectStyle = {
  width:        '100%',
  padding:      '10px 14px',
  borderRadius: '12px',
  border:       '1px solid var(--border)',
  color:        'var(--text-h)',
  background:   '#f8fafc',
  fontSize:     '14px',
  outline:      'none',
}
