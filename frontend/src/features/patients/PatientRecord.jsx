import { useState, useEffect } from 'react'
import { getPrescriptions, getAppointments } from '../../services/api'
import PrescriptionForm from '../prescriptions/PrescriptionForm'

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(iso))
}

const STATUS_STYLE = {
  confirmed:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
  scheduled:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
  pending:     { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  completed:   { bg: 'rgba(30,58,138,0.08)', color: '#1e3a8a' },
  cancelled:   { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444' },
}
function statusStyle(s) {
  return STATUS_STYLE[s?.toLowerCase()] ?? { bg: 'var(--primary-bg)', color: 'var(--primary)' }
}

export default function PatientRecord({ patient, onClose }) {
  const [prescriptions, setPrescriptions] = useState([])
  const [history,       setHistory]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showRxForm,    setShowRxForm]    = useState(false)

  useEffect(() => {
    if (!patient?.id) return
    Promise.all([
      getPrescriptions(patient.id).catch(() => []),
      getAppointments().catch(() => []),
    ]).then(([rxs, appts]) => {
      setPrescriptions(rxs)
      setHistory(appts.filter(a => a.patient_id === patient.id || a.patient_name?.includes(patient.last_name)))
    }).finally(() => setLoading(false))
  }, [patient?.id])

  if (!patient) return null

  const initials = `${patient.first_name?.[0] ?? ''}${patient.last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white"
              style={{ background: 'var(--primary)' }}>
              {initials}
            </div>
            <div>
              <div className="font-bold" style={{ color: 'var(--text-h)' }}>
                {patient.first_name} {patient.last_name}
              </div>
              <div className="text-xs" style={{ color: 'var(--text)' }}>
                {patient.email} · {patient.blood_type ?? 'Blood type unknown'}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'var(--primary-bg)', color: 'var(--text)' }}>
            ×
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {loading && (
            <p className="text-center text-sm py-8" style={{ color: 'var(--text)' }}>Loading record…</p>
          )}

          {!loading && (
            <>
              {/* patient info grid */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-3"
                  style={{ color: 'var(--text)' }}>
                  Personal Info
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Phone',       patient.phone],
                    ['Date of Birth', patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'],
                    ['Blood Type',  patient.blood_type ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs" style={{ color: 'var(--text)' }}>{label}</div>
                      <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-h)' }}>{value || '—'}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* appointment history */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-3"
                  style={{ color: 'var(--text)' }}>
                  Visit History
                </h3>
                {history.length === 0
                  ? <p className="text-sm" style={{ color: 'var(--text)' }}>No visits recorded.</p>
                  : (
                    <div className="flex flex-col gap-2">
                      {history.slice(0, 5).map(a => {
                        const { bg, color } = statusStyle(a.status)
                        return (
                          <div key={a.id} className="flex items-center justify-between p-3 rounded-xl"
                            style={{ background: 'var(--primary-bg)' }}>
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                                {a.reason ?? 'Visit'}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text)' }}>
                                {formatDate(a.appointment_date)} · Dr. {a.doctor_name ?? '—'}
                              </div>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                              style={{ background: bg, color }}>
                              {a.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </section>

              {/* prescriptions */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text)' }}>
                    Prescriptions
                  </h3>
                  <button onClick={() => setShowRxForm(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: 'var(--primary)' }}>
                    + Write Prescription
                  </button>
                </div>
                {prescriptions.length === 0
                  ? <p className="text-sm" style={{ color: 'var(--text)' }}>No prescriptions on file.</p>
                  : (
                    <div className="flex flex-col gap-2">
                      {prescriptions.map(rx => (
                        <div key={rx.id} className="flex items-start gap-3 p-3 rounded-xl"
                          style={{ background: 'var(--primary-bg)' }}>
                          <span className="text-xl">💊</span>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
                              {rx.medication_name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--accent)' }}>{rx.dosage}</div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{rx.instructions}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </section>
            </>
          )}
        </div>
      </div>

      {/* prescription form — own modal overlay since PrescriptionForm is now inline-only */}
      {showRxForm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-4"
          style={{ background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(2px)' }}
          onClick={e => e.target === e.currentTarget && setShowRxForm(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
            style={{ background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold" style={{ color: 'var(--text-h)' }}>
                Write Prescription
              </h3>
              <button onClick={() => setShowRxForm(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--primary-bg)', color: 'var(--text)' }}>×</button>
            </div>
            <PrescriptionForm
              patientId={patient.id}
              doctorId={1}
              onSuccess={() => {
                setShowRxForm(false)
                getPrescriptions(patient.id).then(setPrescriptions).catch(() => {})
              }}
              onCancel={() => setShowRxForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
