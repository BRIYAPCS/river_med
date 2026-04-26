// QueueBoard is purely presentational — Dashboard owns all data + async actions.
// onAdvance(id, colKey) lets the parent derive the correct next API status.

const COLUMNS = [
  {
    key:      'waiting',
    label:    'Waiting',
    icon:     '⏳',
    color:    '#d97706',
    bg:       'rgba(245,158,11,0.08)',
    border:   'rgba(245,158,11,0.30)',
    btnLabel: 'Start Visit',
    btnIcon:  '→',
  },
  {
    key:      'inProgress',
    label:    'In Progress',
    icon:     '🔄',
    color:    '#2563eb',
    bg:       'rgba(59,130,246,0.08)',
    border:   'rgba(59,130,246,0.30)',
    btnLabel: 'Mark Complete',
    btnIcon:  '✓',
  },
  {
    key:      'completed',
    label:    'Completed',
    icon:     '✅',
    color:    '#059669',
    bg:       'rgba(16,185,129,0.08)',
    border:   'rgba(16,185,129,0.30)',
    btnLabel: null,
  },
]

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── single appointment card ──────────────────────────────────────────────────

function PatientCard({ appt, col, onAdvance, isUpdating }) {
  return (
    <div className="rounded-xl border bg-white p-3 flex flex-col gap-2.5 transition-opacity"
      style={{
        borderColor: 'var(--border)',
        boxShadow:   '0 1px 2px rgba(0,0,0,0.05)',
        opacity:     isUpdating ? 0.7 : 1,
      }}>

      {/* patient row */}
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: col.color }}>
          {initials(appt.patient_name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight truncate"
            style={{ color: 'var(--text-h)' }}>
            {appt.patient_name ?? 'Unknown Patient'}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text)' }}>
            {appt.reason ?? 'General visit'}
          </div>
        </div>

        <div className="text-xs font-semibold flex-shrink-0 tabular-nums"
          style={{ color: col.color }}>
          {fmtTime(appt.appointment_date)}
        </div>
      </div>

      {/* doctor row */}
      {appt.doctor_name && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text)' }}>
          <DoctorIcon />
          <span>Dr. {appt.doctor_name}</span>
          {appt.specialty && (
            <>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span>{appt.specialty}</span>
            </>
          )}
        </div>
      )}

      {/* action button */}
      {col.btnLabel && (
        <button
          onClick={() => onAdvance(appt.id, col.key)}
          disabled={isUpdating}
          className="w-full py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all active:scale-95"
          style={{
            borderColor: col.color,
            color:       isUpdating ? 'var(--text)' : col.color,
            background:  col.bg,
            cursor:      isUpdating ? 'not-allowed' : 'pointer',
            opacity:     isUpdating ? 0.6 : 1,
          }}>
          {isUpdating ? (
            <>
              <SpinnerIcon color={col.color} />
              Updating…
            </>
          ) : (
            <>
              <span>{col.btnIcon}</span>
              {col.btnLabel}
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ─── single column ────────────────────────────────────────────────────────────

function Column({ col, items, onAdvance, updatingIds, loading }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border"
      style={{ borderColor: col.border, background: col.bg }}>

      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: col.border }}>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{col.icon}</span>
          <span className="text-sm font-bold" style={{ color: col.color }}>{col.label}</span>
        </div>
        <span className="min-w-6 h-6 px-2 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: col.color }}>
          {loading ? '…' : items.length}
        </span>
      </div>

      {/* body */}
      <div className="flex flex-col gap-2 p-3 overflow-y-auto"
        style={{ minHeight: 160, maxHeight: 440 }}>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-10">
            <SpinnerIcon color={col.color} size={20} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 opacity-50">
            <span className="text-2xl">{col.icon}</span>
            <p className="text-xs font-medium" style={{ color: col.color }}>
              No patients {col.label.toLowerCase()}
            </p>
          </div>
        )}

        {!loading && items.map(appt => (
          <PatientCard
            key={appt.id}
            appt={appt}
            col={col}
            onAdvance={onAdvance}
            isUpdating={updatingIds.has(appt.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── board ────────────────────────────────────────────────────────────────────

export default function QueueBoard({
  waiting    = [],
  inProgress = [],
  completed  = [],
  onAdvance,
  updatingIds = new Set(),
  loading    = false,
}) {
  const dataMap = { waiting, inProgress, completed }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(col => (
        <Column
          key={col.key}
          col={col}
          items={dataMap[col.key] ?? []}
          onAdvance={onAdvance}
          updatingIds={updatingIds}
          loading={loading}
        />
      ))}
    </div>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────

function SpinnerIcon({ color = 'currentColor', size = 13 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function DoctorIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
