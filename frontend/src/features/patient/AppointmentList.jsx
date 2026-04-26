// Presentational component — receives appointments array from Dashboard.

const STATUS = {
  waiting:    { label: 'Waiting',     bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  in_progress:{ label: 'In Progress', bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  completed:  { label: 'Completed',   bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  confirmed:  { label: 'Confirmed',   bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  scheduled:  { label: 'Scheduled',   bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  cancelled:  { label: 'Cancelled',   bg: 'rgba(239,68,68,0.10)',  color: '#dc2626' },
}

function statusSpec(s) {
  return STATUS[s?.toLowerCase().replace('-', '_')] ?? STATUS.scheduled
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? 'Dr').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function AppointmentList({ appointments, loading, error }) {
  if (loading) return <SkeletonList rows={3} />

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
        ⚠ {error}
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-4xl opacity-25">📅</span>
        <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
          No upcoming appointments
        </p>
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          Your next visit will appear here once scheduled.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {appointments.map(a => {
        const spec = statusSpec(a.status)
        return (
          <div key={a.id}
            className="flex items-center gap-4 p-4 rounded-2xl border transition-shadow hover:shadow-sm"
            style={{ borderColor: 'var(--border)', background: 'white' }}>

            {/* date block */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center"
              style={{ background: 'var(--primary-bg)' }}>
              <span className="text-xs font-bold uppercase" style={{ color: 'var(--primary)', lineHeight: 1 }}>
                {a.appointment_date
                  ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(a.appointment_date))
                  : '—'}
              </span>
              <span className="text-lg font-bold leading-tight" style={{ color: 'var(--primary)' }}>
                {a.appointment_date ? new Date(a.appointment_date).getDate() : '—'}
              </span>
            </div>

            {/* info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
                  {a.doctor_name ? `Dr. ${a.doctor_name}` : 'Doctor TBD'}
                </span>
                {a.specialty && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                    {a.specialty}
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                {fmtDate(a.appointment_date)}
                {a.appointment_date && ` · ${fmtTime(a.appointment_date)}`}
                {a.reason && ` · ${a.reason}`}
              </div>
            </div>

            {/* status */}
            <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full capitalize"
              style={{ background: spec.bg, color: spec.color }}>
              {spec.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SkeletonList({ rows }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border animate-pulse"
          style={{ borderColor: 'var(--border)', background: 'white' }}>
          <div className="w-12 h-12 rounded-xl" style={{ background: 'var(--border)' }} />
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
