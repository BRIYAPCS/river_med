import { useState } from 'react'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
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

// ─── single refill request card ───────────────────────────────────────────────
// Props:
//   request       – flat row from API (id, status, created_at, patient_name,
//                   first_name, last_name, medication_name, dosage, doctor_notes)
//   onAction(id, status, notes)  – called with 'approved' or 'rejected'
//   isProcessing  – disables buttons while the API call is in-flight

export default function RefillCard({ request: r, onAction, isProcessing }) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes,     setNotes]     = useState('')
  const [confirming, setConfirming] = useState(null)   // 'approved' | 'rejected' | null

  function handleAction(status) {
    if (confirming === status) {
      // second click = confirmed
      onAction(r.id, status, notes.trim() || null)
      setConfirming(null)
    } else {
      setConfirming(status)
    }
  }

  // reset confirmation if user clicks elsewhere
  function cancelConfirm() { setConfirming(null) }

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden transition-all"
      style={{
        borderColor: 'var(--border)',
        boxShadow:   '0 1px 4px rgba(0,0,0,0.06)',
        opacity:     isProcessing ? 0.65 : 1,
      }}>

      {/* ── top band: patient + pill ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
          style={{ background: '#0d9488' }}>
          {initials(r.patient_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: 'var(--text-h)' }}>
            {r.patient_name ?? `${r.first_name} ${r.last_name}`}
          </div>
          <div className="text-xs" style={{ color: 'var(--text)' }}>
            Requested {fmtDate(r.created_at)}
          </div>
        </div>
        <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
          ⏳ Pending
        </span>
      </div>

      {/* ── medication info ── */}
      <div className="px-5 py-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'rgba(13,148,136,0.10)' }}>
          💊
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
            {r.medication_name}
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: '#0d9488' }}>
            {r.dosage}
          </div>
        </div>
      </div>

      {/* ── notes section ── */}
      <div className="px-5 pb-4">
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text)' }}>
            <span>✏</span> Add a note (optional)
          </button>
        ) : (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--text)' }}>
              Doctor Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for approval/rejection, dosage adjustment, etc…"
              className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none"
              style={{
                borderColor: 'var(--border)',
                background:  'white',
                color:       'var(--text-h)',
              }}
            />
          </div>
        )}
      </div>

      {/* ── action buttons ── */}
      <div className="flex gap-3 px-5 pb-5">
        {/* Approve */}
        <button
          onClick={() => handleAction('approved')}
          onBlur={cancelConfirm}
          disabled={isProcessing || confirming === 'rejected'}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{
            background: confirming === 'approved' ? '#047857' : '#059669',
            opacity:    (isProcessing || confirming === 'rejected') ? 0.4 : 1,
            cursor:     (isProcessing || confirming === 'rejected') ? 'not-allowed' : 'pointer',
            transform:  confirming === 'approved' ? 'scale(0.97)' : 'scale(1)',
          }}>
          {isProcessing
            ? <><Spinner /> Processing…</>
            : confirming === 'approved'
              ? '✓ Confirm Approve'
              : '✓ Approve'}
        </button>

        {/* Reject */}
        <button
          onClick={() => handleAction('rejected')}
          onBlur={cancelConfirm}
          disabled={isProcessing || confirming === 'approved'}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{
            background: confirming === 'rejected' ? '#b91c1c' : '#dc2626',
            opacity:    (isProcessing || confirming === 'approved') ? 0.4 : 1,
            cursor:     (isProcessing || confirming === 'approved') ? 'not-allowed' : 'pointer',
            transform:  confirming === 'rejected' ? 'scale(0.97)' : 'scale(1)',
          }}>
          {isProcessing
            ? <><Spinner /> Processing…</>
            : confirming === 'rejected'
              ? '✕ Confirm Reject'
              : '✕ Reject'}
        </button>
      </div>

      {confirming && (
        <div className="px-5 pb-4 -mt-2 flex justify-center">
          <span className="text-xs" style={{ color: 'var(--text)' }}>
            Click again to confirm · <button onClick={cancelConfirm}
              className="underline" style={{ color: 'var(--text)' }}>Cancel</button>
          </span>
        </div>
      )}
    </div>
  )
}
