import { useState, useEffect, useCallback } from 'react'
import { getPendingRefills, updateRefillStatus } from '../../services/api'
import RefillQueue from '../../features/refills/RefillQueue'

const ACCENT = '#0d9488'

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  return (
    <div onClick={onDismiss}
      className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{
        background: type === 'success' ? '#059669' : '#dc2626',
        maxWidth: 340,
        animation: 'slideIn 0.2s ease',
      }}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DoctorRefillsPage() {
  const [requests,      setRequests]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [processingIds, setProcessingIds] = useState(new Set())
  const [toast,         setToast]         = useState(null)

  // ── history of actioned requests (shown below the queue) ──────────────────
  const [history, setHistory] = useState([])

  // ── load pending requests ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPendingRefills()
      setRequests(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // auto-dismiss toast after 4 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── handle approve / reject ───────────────────────────────────────────────
  async function handleAction(id, status, notes) {
    setProcessingIds(s => new Set(s).add(id))
    try {
      const res = await updateRefillStatus(id, status, notes)

      // move the actioned card from queue → history
      setRequests(prev => {
        const done = prev.find(r => r.id === id)
        if (done) {
          setHistory(h => [{ ...done, status: res.request?.status ?? status, doctor_notes: notes }, ...h])
        }
        return prev.filter(r => r.id !== id)
      })

      const label = status === 'approved' ? 'Refill approved' : 'Refill rejected'
      setToast({ message: label, type: status === 'approved' ? 'success' : 'error' })
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally {
      setProcessingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const HISTORY_STATUS = {
    approved: { bg: 'rgba(16,185,129,0.10)', color: '#059669', label: 'Approved' },
    denied:   { bg: 'rgba(239,68,68,0.10)',  color: '#dc2626', label: 'Rejected' },
    rejected: { bg: 'rgba(239,68,68,0.10)',  color: '#dc2626', label: 'Rejected' },
  }

  return (
    <>
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      <div className="flex flex-col gap-8">

        {/* ── header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>
              Refill Requests
            </h1>
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              Review and action pending medication refills from your patients.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: requests.length > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.10)',
                         color:      requests.length > 0 ? '#d97706'                : '#059669' }}>
                {requests.length > 0
                  ? `${requests.length} pending`
                  : 'All clear'}
              </div>
            )}
            <button onClick={load}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border transition-opacity hover:opacity-70"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              <RefreshIcon /> Refresh
            </button>
          </div>
        </div>

        {/* ── pending queue ── */}
        <RefillQueue
          requests={requests}
          loading={loading}
          error={error}
          processingIds={processingIds}
          onAction={handleAction}
        />

        {/* ── session history ── */}
        {history.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"
              style={{ color: 'var(--text-h)' }}>
              Actioned This Session
              <span className="badge">{history.length}</span>
            </h2>
            <div className="flex flex-col gap-2">
              {history.map(h => {
                const s = HISTORY_STATUS[h.status?.toLowerCase()] ?? HISTORY_STATUS.approved
                return (
                  <div key={h.id}
                    className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border"
                    style={{ borderColor: 'var(--border)', background: 'white' }}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
                        {h.patient_name}
                      </span>
                      <span className="text-xs mx-2" style={{ color: 'var(--border)' }}>·</span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        {h.medication_name}
                      </span>
                      {h.doctor_notes && (
                        <p className="text-xs mt-0.5 italic truncate" style={{ color: 'var(--text)' }}>
                          "{h.doctor_notes}"
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </div>
    </>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
