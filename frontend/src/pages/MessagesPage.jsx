import { useState, useEffect, useRef, useCallback } from 'react'
import { getMessages, sendMessage } from '../services/api'

const PATIENT_ID = 1   // hardcoded until auth is implemented
const SENDER_ROLE = 'patient'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function threadKey(m) {
  return `${m.patient_id}-${m.doctor_id}`
}

// Build thread list from flat message array
function buildThreads(messages) {
  const map = new Map()
  for (const m of messages) {
    const key = threadKey(m)
    if (!map.has(key)) {
      map.set(key, {
        key,
        patient_id: m.patient_id,
        doctor_id:  m.doctor_id,
        doctor_name: m.doctor_name ?? 'Doctor',
        patient_name: m.patient_name ?? 'Patient',
        messages:   [],
      })
    }
    map.get(key).messages.push(m)
  }
  return [...map.values()].map(t => ({
    ...t,
    last:   t.messages.at(-1),
    unread: t.messages.filter(m => m.sender_role === 'doctor').length,
  }))
}

// ─── spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

// ─── thread list item ─────────────────────────────────────────────────────────

function ThreadItem({ thread, active, onClick }) {
  const initials = thread.doctor_name
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <button onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b transition-colors"
      style={{
        borderColor: 'var(--border)',
        background: active ? 'var(--primary-bg)' : 'transparent',
      }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
        style={{ background: 'var(--primary)' }}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>
            Dr. {thread.doctor_name}
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text)' }}>
            {thread.last ? fmtTime(thread.last.created_at) : ''}
          </span>
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text)' }}>
          {thread.last?.body ?? 'No messages yet'}
        </div>
        {thread.unread > 0 && (
          <span className="inline-block mt-1 text-xs font-bold text-white rounded-full px-2 py-0.5"
            style={{ background: 'var(--accent)' }}>
            {thread.unread}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── chat bubble ──────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const isMe = msg.sender_role === SENDER_ROLE
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm"
        style={{
          background: isMe ? 'var(--primary)' : 'var(--primary-bg)',
          color:      isMe ? 'white'          : 'var(--text-h)',
          borderBottomRightRadius: isMe ? 4 : undefined,
          borderBottomLeftRadius:  isMe ? undefined : 4,
        }}>
        <p style={{ margin: 0 }}>{msg.body}</p>
        <div className="text-xs mt-1" style={{ opacity: 0.65 }}>
          {fmtTime(msg.created_at)}
        </div>
      </div>
    </div>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyPane({ text }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3"
      style={{ color: 'var(--text)' }}>
      <span className="text-5xl opacity-20">💬</span>
      <p className="text-sm font-medium">{text}</p>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [threads,    setThreads]    = useState([])
  const [activeKey,  setActiveKey]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const msgs = await getMessages()
      const built = buildThreads(msgs)
      setThreads(built)
      // keep active thread selected if it still exists; otherwise pick first
      setActiveKey(k => {
        if (k && built.some(t => t.key === k)) return k
        return built[0]?.key ?? null
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // scroll to bottom when active thread messages change
  const activeThread = threads.find(t => t.key === activeKey)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.messages.length])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !activeThread || sending) return

    setInput('')
    setSending(true)
    try {
      await sendMessage({
        patient_id:  PATIENT_ID,
        doctor_id:   activeThread.doctor_id,
        sender_role: SENDER_ROLE,
        body:        text,
      })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>Messages</h1>
        <p style={{ color: 'var(--text)' }}>Communicate securely with your care team.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      <div className="flex rounded-2xl border overflow-hidden bg-white"
        style={{ borderColor: 'var(--border)', height: '72vh', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* ── thread list ── */}
        <div className="w-72 flex-shrink-0 border-r flex flex-col"
          style={{ borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10"
                style={{ color: 'var(--text)' }}>
                <Spinner /> Loading…
              </div>
            )}
            {!loading && threads.length === 0 && (
              <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text)' }}>
                No conversations yet.
              </p>
            )}
            {!loading && threads.map(t => (
              <ThreadItem
                key={t.key}
                thread={t}
                active={t.key === activeKey}
                onClick={() => setActiveKey(t.key)}
              />
            ))}
          </div>
        </div>

        {/* ── chat panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeThread ? (
            loading
              ? <EmptyPane text="Loading conversations…" />
              : <EmptyPane text="Select a conversation" />
          ) : (
            <>
              {/* chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b"
                style={{ borderColor: 'var(--border)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
                  style={{ background: 'var(--primary)' }}>
                  {activeThread.doctor_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
                    Dr. {activeThread.doctor_name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text)' }}>
                    {activeThread.messages.length} message{activeThread.messages.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={load}
                  className="ml-auto p-2 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text)' }}>
                  <RefreshIcon />
                </button>
              </div>

              {/* messages */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                {activeThread.messages.length === 0 && (
                  <EmptyPane text="No messages in this conversation yet." />
                )}
                {activeThread.messages.map(m => (
                  <Bubble key={m.id} msg={m} />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* input */}
              <form onSubmit={handleSend}
                className="flex gap-3 px-5 py-4 border-t"
                style={{ borderColor: 'var(--border)' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message…"
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    borderColor: 'var(--border)',
                    background:  'var(--bg)',
                    color:       'var(--text-h)',
                    opacity:     sending ? 0.6 : 1,
                  }}
                />
                <button type="submit"
                  disabled={!input.trim() || sending}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-opacity"
                  style={{
                    background: 'var(--primary)',
                    opacity:    (!input.trim() || sending) ? 0.45 : 1,
                    cursor:     (!input.trim() || sending) ? 'not-allowed' : 'pointer',
                  }}>
                  {sending ? <><Spinner /> Sending</> : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
