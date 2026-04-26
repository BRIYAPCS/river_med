// Presentational component — receives prescriptions + refill state from Dashboard.

export default function PrescriptionList({
  prescriptions,
  loading,
  error,
  requestedIds = new Set(),
  loadingIds   = new Set(),
  onRequestRefill,
}) {
  if (loading) return <SkeletonList rows={3} />

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
        ⚠ {error}
      </div>
    )
  }

  if (prescriptions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-4xl opacity-25">💊</span>
        <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
          No prescriptions on file
        </p>
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          Medications prescribed by your doctor will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {prescriptions.map(rx => {
        const requested  = requestedIds.has(rx.id)
        const isPending  = loadingIds.has(rx.id)
        const canRefill  = Boolean(rx.refill_allowed)

        return (
          <div key={rx.id}
            className="rounded-2xl border p-4 flex flex-col gap-3"
            style={{ borderColor: 'var(--border)', background: 'white' }}>

            {/* top row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(30,58,138,0.08)' }}>
                  💊
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--text-h)' }}>
                    {rx.medication_name}
                  </div>
                  <div className="text-xs font-semibold mt-0.5" style={{ color: '#6366f1' }}>
                    {rx.dosage}
                  </div>
                </div>
              </div>

              {/* refill action */}
              <div className="flex-shrink-0">
                {!canRefill && (
                  <span className="text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: '#f1f5f9', color: '#64748b' }}>
                    No Refills
                  </span>
                )}
                {canRefill && requested && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Requested
                  </span>
                )}
                {canRefill && !requested && (
                  <button
                    onClick={() => onRequestRefill(rx.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95"
                    style={{
                      borderColor: 'var(--primary)',
                      color:       isPending ? 'var(--text)' : 'var(--primary)',
                      background:  'transparent',
                      cursor:      isPending ? 'not-allowed' : 'pointer',
                      opacity:     isPending ? 0.55 : 1,
                    }}>
                    {isPending
                      ? <><SpinIcon /> Sending…</>
                      : <>↻ Request Refill</>}
                  </button>
                )}
              </div>
            </div>

            {/* instructions */}
            {rx.instructions && (
              <p className="text-xs leading-relaxed px-1" style={{ color: 'var(--text)' }}>
                {rx.instructions}
              </p>
            )}

            {/* doctor */}
            {rx.doctor_name && (
              <div className="text-xs" style={{ color: 'var(--text)' }}>
                Prescribed by Dr. {rx.doctor_name}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SpinIcon() {
  return (
    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function SkeletonList({ rows }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-4 flex items-start gap-3 animate-pulse"
          style={{ borderColor: 'var(--border)', background: 'white' }}>
          <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: 'var(--border)' }} />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-4 rounded-lg w-2/5" style={{ background: 'var(--border)' }} />
            <div className="h-3 rounded-lg w-1/4" style={{ background: 'var(--border)' }} />
            <div className="h-3 rounded-lg w-3/4 mt-1" style={{ background: 'var(--border)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
