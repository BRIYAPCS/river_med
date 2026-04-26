import RefillCard from './RefillCard'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden animate-pulse"
      style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
        <div className="w-10 h-10 rounded-full" style={{ background: 'var(--border)' }} />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 rounded-lg w-1/3" style={{ background: 'var(--border)' }} />
          <div className="h-3 rounded-lg w-1/2" style={{ background: 'var(--border)' }} />
        </div>
        <div className="h-6 w-20 rounded-full" style={{ background: 'var(--border)' }} />
      </div>
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-xl" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 rounded-lg w-2/5" style={{ background: 'var(--border)' }} />
          <div className="h-3 rounded-lg w-1/4" style={{ background: 'var(--border)' }} />
        </div>
      </div>
      <div className="flex gap-3 px-5 pb-5">
        <div className="flex-1 h-10 rounded-xl" style={{ background: 'var(--border)' }} />
        <div className="flex-1 h-10 rounded-xl" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  )
}

// ─── queue grid — renders cards or states ─────────────────────────────────────
// Props:
//   requests      – array of refill request objects
//   loading       – show skeleton
//   error         – show error message
//   processingIds – Set of IDs currently being updated
//   onAction(id, status, notes) – bubbles up from RefillCard

export default function RefillQueue({
  requests     = [],
  loading      = false,
  error        = null,
  processingIds = new Set(),
  onAction,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 px-5 py-4 rounded-2xl text-sm"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
        <span className="text-lg">⚠</span>
        <div>
          <p className="font-semibold">Failed to load refill requests</p>
          <p className="text-xs mt-0.5 opacity-80">{error}</p>
        </div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{ background: 'rgba(13,148,136,0.08)' }}>
          🎉
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-h)' }}>
            All caught up!
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
            No pending refill requests at the moment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {requests.map(req => (
        <RefillCard
          key={req.id}
          request={req}
          onAction={onAction}
          isProcessing={processingIds.has(req.id)}
        />
      ))}
    </div>
  )
}
