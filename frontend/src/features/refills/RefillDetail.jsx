import { useState, useEffect } from 'react'

const ACCENT = '#6366f1'

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide mb-0.5"
        style={{ color: 'var(--text)' }}>
        {label}
      </dt>
      <dd className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{value}</dd>
    </div>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12">
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{ background: 'rgba(99,102,241,0.08)' }}>
        📋
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--text-h)' }}>
        Select a request
      </p>
      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text)' }}>
        Click any pending refill from the list to review and action it.
      </p>
    </div>
  )
}

// ─── main detail panel ────────────────────────────────────────────────────────

export default function RefillDetail({ request, onAction, isProcessing }) {
  const [notes,      setNotes]      = useState('')
  const [confirming, setConfirming] = useState(null)   // 'approved' | 'rejected' | null

  // reset state when the selected request changes
  useEffect(() => {
    setNotes('')
    setConfirming(null)
  }, [request?.id])

  if (!request) return <EmptyState />

  function handleAction(status) {
    if (confirming === status) {
      onAction(request.id, status, notes.trim() || null)
      setConfirming(null)
    } else {
      setConfirming(status)
    }
  }

  const BADGE = {
    pending:  { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', label: 'Pending'  },
    approved: { bg: 'rgba(16,185,129,0.12)',  color: '#059669', label: 'Approved' },
    rejected: { bg: 'rgba(239,68,68,0.10)',   color: '#dc2626', label: 'Rejected' },
  }
  const badge = BADGE[request.status?.toLowerCase()] ?? BADGE.pending

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── patient header ── */}
      <div className="flex items-center gap-4 px-7 py-5 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white flex-shrink-0"
          style={{ background: ACCENT }}>
          {initials(request.patient_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-h)' }}>
            {request.patient_name ?? `${request.first_name} ${request.last_name}`}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
            Request #{request.id} · {fmtDateTime(request.created_at)}
          </p>
        </div>
        <span className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </div>

      {/* ── body ── */}
      <div className="flex flex-col gap-6 p-7">

        {/* prescription info */}
        <section className="bg-white rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-4"
            style={{ color: 'var(--text)' }}>
            Prescription Details
          </h3>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'rgba(13,148,136,0.10)' }}>
              💊
            </div>
            <dl className="grid grid-cols-2 gap-4 flex-1">
              <InfoRow label="Medication"  value={request.medication_name} />
              <InfoRow label="Dosage"      value={request.dosage} />
              <InfoRow label="Patient"     value={request.patient_name} />
              <InfoRow label="Requested"   value={fmtDateTime(request.created_at)} />
            </dl>
          </div>
        </section>

        {/* doctor notes */}
        <section className="bg-white rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <label className="block text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: 'var(--text)' }}>
            Doctor Notes <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={isProcessing}
            placeholder="Add any notes regarding this refill request…"
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none transition-colors"
            style={{
              borderColor: 'var(--border)',
              background:  'white',
              color:       'var(--text-h)',
              opacity:     isProcessing ? 0.6 : 1,
            }}
          />
        </section>

        {/* action buttons */}
        <section>
          {confirming && (
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                Click again to confirm your decision
              </span>
              <button onClick={() => setConfirming(null)}
                className="text-xs underline" style={{ color: 'var(--text)' }}>
                Cancel
              </button>
            </div>
          )}

          <div className="flex gap-3">
            {/* Approve */}
            <button
              onClick={() => handleAction('approved')}
              disabled={isProcessing || confirming === 'rejected'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all"
              style={{
                background: confirming === 'approved' ? '#047857' : '#059669',
                opacity:    (isProcessing || confirming === 'rejected') ? 0.35 : 1,
                cursor:     (isProcessing || confirming === 'rejected') ? 'not-allowed' : 'pointer',
                transform:  confirming === 'approved' ? 'scale(0.98)' : 'scale(1)',
              }}>
              {isProcessing && confirming !== 'rejected'
                ? <><Spinner /> Processing…</>
                : confirming === 'approved'
                  ? '✓ Confirm Approve'
                  : '✓  Approve'}
            </button>

            {/* Reject */}
            <button
              onClick={() => handleAction('rejected')}
              disabled={isProcessing || confirming === 'approved'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all"
              style={{
                background: confirming === 'rejected' ? '#b91c1c' : '#dc2626',
                opacity:    (isProcessing || confirming === 'approved') ? 0.35 : 1,
                cursor:     (isProcessing || confirming === 'approved') ? 'not-allowed' : 'pointer',
                transform:  confirming === 'rejected' ? 'scale(0.98)' : 'scale(1)',
              }}>
              {isProcessing && confirming !== 'approved'
                ? <><Spinner /> Processing…</>
                : confirming === 'rejected'
                  ? '✕ Confirm Reject'
                  : '✕  Reject'}
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
