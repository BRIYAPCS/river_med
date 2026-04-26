// Left-panel list for the Admin Refill Dashboard.
// Displays pending requests; highlights the selected one.

const ACCENT = '#6366f1'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── single row ───────────────────────────────────────────────────────────────

function Row({ item, selected, onClick }) {
  const isSelected = selected?.id === item.id

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b transition-all"
      style={{
        borderColor:  'var(--border)',
        background:   isSelected ? 'rgba(99,102,241,0.07)' : 'white',
        borderLeft:   `3px solid ${isSelected ? ACCENT : 'transparent'}`,
      }}>

      {/* avatar */}
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
        style={{ background: isSelected ? ACCENT : '#94a3b8' }}>
        {initials(item.patient_name)}
      </div>

      {/* info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
          {item.patient_name ?? `${item.first_name} ${item.last_name}`}
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: '#0d9488' }}>
          {item.medication_name}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
          {fmtDate(item.created_at)}
          {item.created_at && ` · ${fmtTime(item.created_at)}`}
        </div>
      </div>

      {/* pending dot */}
      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
        style={{ background: '#f59e0b' }} />
    </button>
  )
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b animate-pulse"
          style={{ borderColor: 'var(--border)' }}>
          <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="h-3.5 rounded-lg w-3/4" style={{ background: 'var(--border)' }} />
            <div className="h-3 rounded-lg w-1/2" style={{ background: 'var(--border)' }} />
            <div className="h-2.5 rounded-lg w-2/5" style={{ background: 'var(--border)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PendingRefillList({ items, selected, onSelect, loading, error }) {
  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
        <span className="text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--text)' }}>
          Pending Requests
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: items.length > 0 ? 'rgba(245,158,11,0.15)' : 'var(--border)',
            color:       items.length > 0 ? '#d97706'               : 'var(--text)',
          }}>
          {loading ? '…' : items.length}
        </span>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto">
        {loading && <Skeleton />}

        {!loading && error && (
          <div className="px-4 py-5 text-sm" style={{ color: '#dc2626' }}>
            ⚠ {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 px-4 text-center">
            <span className="text-3xl opacity-20">🎉</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
              All caught up
            </p>
            <p className="text-xs" style={{ color: 'var(--text)' }}>
              No pending refill requests
            </p>
          </div>
        )}

        {!loading && !error && items.map(item => (
          <Row
            key={item.id}
            item={item}
            selected={selected}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  )
}
