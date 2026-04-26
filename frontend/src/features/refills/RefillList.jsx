// Presentational component — receives refill requests array from Dashboard.

const STATUS_SPEC = {
  pending:  { label: 'Pending',  bg: 'rgba(245,158,11,0.12)', color: '#d97706', dot: '#f59e0b' },
  approved: { label: 'Approved', bg: 'rgba(16,185,129,0.12)', color: '#059669', dot: '#10b981' },
  rejected: { label: 'Rejected', bg: 'rgba(239,68,68,0.10)',  color: '#dc2626', dot: '#ef4444' },
  denied:   { label: 'Denied',   bg: 'rgba(239,68,68,0.10)',  color: '#dc2626', dot: '#ef4444' },
}

function spec(status) {
  return STATUS_SPEC[status?.toLowerCase()] ?? STATUS_SPEC.pending
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function StatusBadge({ status }) {
  const s = spec(status)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

export default function RefillList({ refillRequests, loading, error }) {
  if (loading) return <SkeletonList rows={2} />

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
        ⚠ {error}
      </div>
    )
  }

  if (refillRequests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-4xl opacity-25">🔄</span>
        <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
          No refill requests yet
        </p>
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          Requests you submit will appear here with their status.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {refillRequests.map(rr => (
        <div key={rr.id}
          className="flex items-center gap-4 p-4 rounded-2xl border"
          style={{ borderColor: 'var(--border)', background: 'white' }}>

          {/* icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: spec(rr.status).bg }}>
            💊
          </div>

          {/* info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
              {rr.medication_name ?? 'Medication'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
              {rr.dosage && `${rr.dosage} · `}
              Requested {fmtDate(rr.created_at)}
            </div>
          </div>

          {/* status badge */}
          <StatusBadge status={rr.status} />
        </div>
      ))}
    </div>
  )
}

function SkeletonList({ rows }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border animate-pulse"
          style={{ borderColor: 'var(--border)', background: 'white' }}>
          <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: 'var(--border)' }} />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-4 rounded-lg w-1/3" style={{ background: 'var(--border)' }} />
            <div className="h-3 rounded-lg w-1/2" style={{ background: 'var(--border)' }} />
          </div>
          <div className="h-6 w-20 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
}
