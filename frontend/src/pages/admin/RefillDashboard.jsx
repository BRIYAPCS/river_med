import { useState, useEffect, useCallback, useRef } from 'react'
import { io }                                        from 'socket.io-client'
import { getPendingRefills, updateRefillStatus }     from '../../services/api'
import PendingRefillList                             from '../../features/refills/PendingRefillList'
import RefillDetail                                  from '../../features/refills/RefillDetail'

// Dev: explicit host so Vite's dev server isn't targeted.
// Prod: empty string → socket.io-client connects to the same origin (nginx proxies /socket.io/).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  return (
    <div onClick={onDismiss}
      className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold text-white cursor-pointer"
      style={{ background: type === 'success' ? '#059669' : '#dc2626', maxWidth: 360 }}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {message}
    </div>
  )
}

// ─── live indicator dot ───────────────────────────────────────────────────────

function LiveDot({ connected }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium"
      style={{ color: connected ? '#059669' : '#94a3b8' }}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'animate-pulse' : ''}`}
        style={{ background: connected ? '#10b981' : '#cbd5e1' }} />
      {connected ? 'Live' : 'Connecting…'}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function RefillDashboard() {
  const [items,         setItems]         = useState([])
  const [selected,      setSelected]      = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [processingIds, setProcessingIds] = useState(new Set())
  const [toast,         setToast]         = useState(null)
  const [connected,     setConnected]     = useState(false)

  // keep a stable ref to the socket so the cleanup always disconnects the right instance
  const socketRef = useRef(null)

  // ── fetch pending refills ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPendingRefills()
      setItems(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── socket connection — mount once, cleanup on unmount ────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],  // prefer websocket, fall back to polling
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', reason => {
      console.log('[WS] Disconnected:', reason)
      setConnected(false)
    })

    socket.on('refill_updated', ({ id, status, patient_name, medication }) => {
      console.log('[WS] refill_updated →', { id, status })

      setItems(prev => {
        const wasPending = prev.some(r => r.id === id)

        if (wasPending) {
          // Actioned by another session — remove from list and notify
          const label = status?.toLowerCase() === 'approved' ? 'approved' : 'rejected'
          setToast({
            message: `${patient_name}'s ${medication} refill was ${label} by another user`,
            type:    label === 'approved' ? 'success' : 'error',
          })
          // clear selection if this was the open card
          setSelected(sel => sel?.id === id ? null : sel)
          return prev.filter(r => r.id !== id)
        }

        // Already removed by handleAction (this session) — no-op
        return prev
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])   // empty deps — connect once for the lifetime of this page

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── approve / reject ──────────────────────────────────────────────────────
  async function handleAction(id, status, notes) {
    setProcessingIds(s => new Set(s).add(id))
    try {
      await updateRefillStatus(id, status, notes)

      // Optimistic: remove from list immediately (socket event is a no-op for this id)
      setItems(prev => prev.filter(r => r.id !== id))
      setSelected(prev => (prev?.id === id ? null : prev))

      setToast({
        message: status === 'approved' ? 'Refill approved' : 'Refill rejected',
        type:    status === 'approved' ? 'success' : 'error',
      })
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally {
      setProcessingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const pendingCount = items.length

  return (
    <>
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      <div className="flex flex-col" style={{ height: 'calc(100vh - 68px)' }}>

        {/* ── top bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-h)' }}>
              Refill Dashboard
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
              Review and action pending medication refill requests
            </p>
          </div>

          <div className="flex items-center gap-4">
            <LiveDot connected={connected} />

            {!loading && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{
                  background: pendingCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.10)',
                  color:      pendingCount > 0 ? '#d97706'                : '#059669',
                }}>
                {pendingCount > 0 ? `${pendingCount} pending` : 'All clear'}
              </span>
            )}

            <button onClick={load}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border transition-opacity hover:opacity-70"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              <RefreshIcon /> Refresh
            </button>
          </div>
        </div>

        {/* ── split panel ── */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

          {/* left: list — full width on mobile, 35% on desktop */}
          <aside className="flex flex-col border-b lg:border-b-0 lg:border-r flex-shrink-0 overflow-hidden"
            style={{
              width: '100%', maxHeight: '45vh',
              borderColor: 'var(--border)', background: 'white',
            }}>
            <PendingRefillList
              items={items}
              selected={selected}
              onSelect={setSelected}
              loading={loading}
              error={error}
            />
          </aside>

          {/* right: detail — 65% */}
          <div className="flex-1 overflow-hidden flex flex-col"
            style={{ background: '#f8fafc' }}>
            <RefillDetail
              request={selected}
              onAction={handleAction}
              isProcessing={selected ? processingIds.has(selected.id) : false}
            />
          </div>

        </div>
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
