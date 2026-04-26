import { useState, useEffect, useCallback } from 'react'
import {
  getMyPrescriptions,
  getMyRefillRequests,
  createRefillRequest,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { getSocket } from '../../services/socket'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function RefillBadge({ status }) {
  const s = status?.toLowerCase()
  const style = s === 'approved'
    ? { bg: 'rgba(16,185,129,0.12)', color: '#059669' }
    : s === 'denied'
    ? { bg: 'rgba(220,38,38,0.08)',  color: '#dc2626' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#d97706' }

  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  )
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
      <span>{type === 'error' ? '⚠' : '✓'}</span>
      <span>{message}</span>
    </div>
  )
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export default function PatientPrescriptions() {
  const { user }  = useAuth()
  const patientId = user?.patient_id ?? null

  const [prescriptions, setPrescriptions] = useState([])
  const [refillReqs,    setRefillReqs]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [requestedIds,  setRequestedIds]  = useState(new Set())  // pending prescription_ids
  const [loadingIds,    setLoadingIds]    = useState(new Set())
  const [toast,         setToast]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rxs, refills] = await Promise.all([
        getMyPrescriptions(),
        getMyRefillRequests(),
      ])
      setPrescriptions(rxs)
      setRefillReqs(refills)
      const pids = new Set(
        refills
          .filter(r => r.status?.toLowerCase() === 'pending')
          .map(r => r.prescription_id)
      )
      setRequestedIds(pids)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // socket: update refill status in real-time
  useEffect(() => {
    if (!patientId) return
    const s = getSocket()
    const onRefillUpdated = refill => {
      if (Number(refill.patient_id) !== Number(patientId)) return
      setRefillReqs(prev => {
        const exists = prev.some(r => r.id === refill.id)
        return exists ? prev.map(r => r.id === refill.id ? refill : r) : [refill, ...prev]
      })
      if (refill.status?.toLowerCase() !== 'pending') {
        setRequestedIds(prev => { const n = new Set(prev); n.delete(refill.prescription_id); return n })
      }
    }
    s.on('refill_updated', onRefillUpdated)
    return () => s.off('refill_updated', onRefillUpdated)
  }, [patientId])

  async function handleRefill(prescriptionId) {
    setLoadingIds(s => new Set(s).add(prescriptionId))
    try {
      await createRefillRequest(prescriptionId)
      setRequestedIds(s => new Set(s).add(prescriptionId))
      setToast({ message: 'Refill request submitted!', type: 'success' })
      load()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setLoadingIds(s => { const n = new Set(s); n.delete(prescriptionId); return n })
    }
  }

  // Map prescription_id → latest refill request for quick lookup
  const refillMap = {}
  refillReqs.forEach(r => {
    const prev = refillMap[r.prescription_id]
    if (!prev || new Date(r.created_at) > new Date(prev.created_at)) {
      refillMap[r.prescription_id] = r
    }
  })

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />

      <div className="flex flex-col gap-6">

        {/* header */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Prescriptions</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
            View your medications and request refills
          </p>
        </div>

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
            <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No prescriptions on file</p>
            <p className="text-xs" style={{ color: 'var(--text)' }}>
              Your doctor will add prescriptions after your visit.
            </p>
          </div>
        )}

        {/* prescriptions list */}
        {!loading && !error && prescriptions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prescriptions.map(rx => {
              const latestRefill = refillMap[rx.id]
              const isPending    = requestedIds.has(rx.id)
              const isLoading    = loadingIds.has(rx.id)

              return (
                <div key={rx.id}
                  className="bg-white rounded-2xl border p-5 flex flex-col gap-4"
                  style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

                  {/* drug info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'rgba(13,148,136,0.10)' }}>
                      💊
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-h)' }}>
                        {rx.medication_name}
                      </p>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: '#0d9488' }}>
                        {rx.dosage}
                      </p>
                      {rx.instructions && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text)' }}>
                          {rx.instructions}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* meta */}
                  <div className="flex items-center justify-between text-xs gap-2 flex-wrap"
                    style={{ color: 'var(--text)' }}>
                    <span>
                      Prescribed {fmtDate(rx.created_at)}
                      {rx.doctor_name && ` by Dr. ${rx.doctor_name}`}
                    </span>
                    <span className="font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: rx.refill_allowed ? 'rgba(16,185,129,0.10)' : 'var(--border)',
                        color:       rx.refill_allowed ? '#059669'                : 'var(--text)',
                      }}>
                      {rx.refill_allowed ? 'Refills allowed' : 'No refills'}
                    </span>
                  </div>

                  {/* refill section */}
                  {rx.refill_allowed && (
                    <div className="border-t pt-3 flex items-center justify-between gap-3"
                      style={{ borderColor: 'var(--border)' }}>
                      <div>
                        {latestRefill ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--text)' }}>
                              Last request:
                            </span>
                            <RefillBadge status={latestRefill.status} />
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text)' }}>
                            No refill requests yet
                          </span>
                        )}
                      </div>

                      <button
                        disabled={isPending || isLoading}
                        onClick={() => handleRefill(rx.id)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                        style={{
                          background: isPending ? '#6b7280' : '#0d9488',
                          opacity:    (isPending || isLoading) ? 0.7 : 1,
                          cursor:     (isPending || isLoading) ? 'not-allowed' : 'pointer',
                        }}>
                        {isLoading
                          ? <><Spinner size={3} /> Requesting…</>
                          : isPending
                          ? '✓ Pending'
                          : '↻ Request Refill'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* refill history */}
        {!loading && refillReqs.length > 0 && (
          <section>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-h)' }}>
              Refill History
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                style={{ background: 'var(--border)', color: 'var(--text)' }}>
                {refillReqs.length}
              </span>
            </h2>
            <div className="bg-white rounded-2xl border overflow-hidden"
              style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {refillReqs.map((r, i) => (
                <div key={r.id}
                  className="flex items-center justify-between px-5 py-3 gap-3"
                  style={{ borderBottom: i < refillReqs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
                      {r.medication_name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text)' }}>
                      {r.dosage} · {fmtDate(r.created_at)}
                    </p>
                    {r.doctor_notes && (
                      <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text)' }}>
                        "{r.doctor_notes}"
                      </p>
                    )}
                  </div>
                  <RefillBadge status={r.status} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
