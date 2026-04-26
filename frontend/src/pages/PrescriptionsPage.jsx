import { useState, useEffect, useCallback } from 'react'
import Card from '../components/Card'
import { getPrescriptions, requestRefill } from '../services/api'

const PATIENT_ID = 1

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--text)' }}>
      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="text-sm">Loading prescriptions...</span>
    </div>
  )
}

function RefillButton({ prescription, requested, loading, onRequest }) {
  if (!prescription.refill_allowed) {
    return (
      <span className="text-xs font-medium px-3 py-1.5 rounded-xl"
        style={{ background: 'var(--border)', color: 'var(--text)' }}>
        No Refill
      </span>
    )
  }

  if (requested) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Refill Requested
      </div>
    )
  }

  return (
    <button
      onClick={() => onRequest(prescription.id)}
      disabled={loading}
      className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all"
      style={{
        borderColor: 'var(--primary)',
        color:       loading ? 'var(--text)' : 'var(--primary)',
        background:  'transparent',
        cursor:      loading ? 'not-allowed' : 'pointer',
        opacity:     loading ? 0.6 : 1,
      }}>
      {loading ? 'Sending...' : 'Request Refill'}
    </button>
  )
}

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)

  // track per-prescription refill state
  const [requestedIds,  setRequestedIds]  = useState(new Set())
  const [loadingIds,    setLoadingIds]    = useState(new Set())
  const [refillErrors,  setRefillErrors]  = useState({})

  // global success toast
  const [toast, setToast] = useState(null)

  useEffect(() => {
    getPrescriptions(PATIENT_ID)
      .then(setPrescriptions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleRefill = useCallback(async (id) => {
    setLoadingIds((prev) => new Set(prev).add(id))
    setRefillErrors((prev) => { const n = { ...prev }; delete n[id]; return n })

    try {
      await requestRefill(id)
      setRequestedIds((prev) => new Set(prev).add(id))
      setToast('Refill request sent')
    } catch (e) {
      setRefillErrors((prev) => ({ ...prev, [id]: e.message }))
    } finally {
      setLoadingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }, [])

  const active    = prescriptions.filter((p) => p.refill_allowed)
  const noRefill  = prescriptions.filter((p) => !p.refill_allowed)

  return (
    <div>
      {/* toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{ background: '#10b981' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>Prescriptions</h1>
        <p style={{ color: 'var(--text)' }}>View your medications and request refills.</p>
      </div>

      {loading && <Spinner />}

      {error && (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--danger)' }}>
          Failed to load prescriptions: {error}
        </div>
      )}

      {!loading && !error && prescriptions.length === 0 && (
        <Card>
          <p className="py-10 text-center text-sm" style={{ color: 'var(--text)' }}>
            No prescriptions found
          </p>
        </Card>
      )}

      {!loading && !error && prescriptions.length > 0 && (
        <div className="flex flex-col gap-8">

          {/* active / refillable */}
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide"
                style={{ color: 'var(--text)' }}>
                Active
              </h2>
              <div className="flex flex-col gap-3">
                {active.map((rx) => (
                  <PrescriptionCard
                    key={rx.id}
                    rx={rx}
                    requested={requestedIds.has(rx.id)}
                    loading={loadingIds.has(rx.id)}
                    refillError={refillErrors[rx.id]}
                    onRefill={handleRefill}
                  />
                ))}
              </div>
            </section>
          )}

          {/* no-refill */}
          {noRefill.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide"
                style={{ color: 'var(--text)' }}>
                No Refill Available
              </h2>
              <div className="flex flex-col gap-3">
                {noRefill.map((rx) => (
                  <PrescriptionCard
                    key={rx.id}
                    rx={rx}
                    requested={false}
                    loading={false}
                    refillError={null}
                    onRefill={handleRefill}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}

function PrescriptionCard({ rx, requested, loading, refillError, onRefill }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">

        {/* left — drug info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'var(--primary-bg)' }}>
            💊
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm mb-0.5 truncate" style={{ color: 'var(--text-h)' }}>
              {rx.medication_name}
            </div>
            <div className="text-xs mb-1" style={{ color: 'var(--accent)' }}>
              {rx.dosage}
            </div>
            {rx.instructions && (
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                {rx.instructions}
              </div>
            )}
            {rx.doctor_name && (
              <div className="text-xs mt-1.5" style={{ color: 'var(--text)' }}>
                Prescribed by Dr. {rx.doctor_name}
              </div>
            )}
          </div>
        </div>

        {/* right — refill action */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <RefillButton
            prescription={rx}
            requested={requested}
            loading={loading}
            onRequest={onRefill}
          />
          {refillError && (
            <span className="text-xs" style={{ color: 'var(--danger)' }}>
              {refillError}
            </span>
          )}
        </div>

      </div>
    </Card>
  )
}
