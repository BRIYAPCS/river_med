import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../../context/AuthContext'
import { getThreads, getThread, getPatients, getDoctors } from '../../services/api'

// Dev: explicit host so Vite's dev server isn't targeted.
// Prod: empty string → socket.io-client connects to the same origin (nginx proxies /socket.io/).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

// ─── helpers ──────────────────────────────────────────────────────────────────

function roomId(patient_id, doctor_id) {
  return `chat_p${patient_id}_d${doctor_id}`
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function truncate(str, n = 42) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ─── ThreadItem ───────────────────────────────────────────────────────────────

function ThreadItem({ thread, isActive, myRole, onClick }) {
  const name = myRole === 'doctor' ? thread.patient_name : thread.doctor_name
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background:   isActive ? 'var(--primary-bg)' : 'transparent',
        borderLeft:   isActive ? '3px solid var(--primary)' : '3px solid transparent',
      }}>
      {/* avatar */}
      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
        style={{ background: isActive ? 'var(--primary)' : '#94a3b8' }}>
        {initials}
      </div>
      {/* meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate"
            style={{ color: isActive ? 'var(--primary)' : 'var(--text-h)' }}>
            {name}
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text)' }}>
            {formatTime(thread.last_message_at)}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text)' }}>
          {truncate(thread.last_body) || <em>No messages yet</em>}
        </p>
      </div>
    </button>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className="max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
        style={{
          background:   isMine ? 'var(--primary)' : '#f1f5f9',
          color:        isMine ? '#fff'            : 'var(--text-h)',
          borderRadius: isMine
            ? '18px 18px 4px 18px'
            : '18px 18px 18px 4px',
        }}>
        {msg.body}
        <div
          className="text-right mt-1 text-xs opacity-70 leading-none">
          {formatTime(msg.created_at)}
        </div>
      </div>
    </div>
  )
}

// ─── NewChatPanel ─────────────────────────────────────────────────────────────
// Shows a searchable list of contacts the user can start a thread with.

function NewChatPanel({ myRole, onSelect, onCancel }) {
  const [contacts, setContacts] = useState([])
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const fn = myRole === 'doctor' ? getPatients : getDoctors
    fn()
      .then(setContacts)
      .finally(() => setLoading(false))
  }, [myRole])

  const filtered = contacts.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase()
    return name.includes(query.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
          New conversation
        </span>
        <button onClick={onCancel}
          className="text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
          style={{ color: 'var(--text)' }}>×</button>
      </div>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <input
          autoFocus
          placeholder={`Search ${myRole === 'doctor' ? 'patients' : 'doctors'}…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text-h)' }}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text)' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text)' }}>No results</p>
        ) : filtered.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: '#94a3b8' }}>
              {c.first_name?.[0]}{c.last_name?.[0]}
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                {c.first_name} {c.last_name}
              </div>
              {c.specialty && (
                <div className="text-xs" style={{ color: 'var(--text)' }}>{c.specialty}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── ChatPage ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth()

  // thread list state
  const [threads,      setThreads]      = useState([])
  const [threadsLoad,  setThreadsLoad]  = useState(true)
  const [showNewChat,  setShowNewChat]  = useState(false)

  // active thread state
  const [activeThread, setActiveThread] = useState(null)
  const [messages,     setMessages]     = useState([])
  const [msgsLoad,     setMsgsLoad]     = useState(false)

  // compose state
  const [text,         setText]         = useState('')
  const [sendError,    setSendError]    = useState(null)

  // refs
  const socketRef  = useRef(null)
  const bottomRef  = useRef(null)
  const activeRef  = useRef(null)   // mirror activeThread for socket handler closure
  const inputRef   = useRef(null)

  // ── socket lifecycle (mount / unmount only) ──
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('receive_message', msg => {
      const t = activeRef.current
      // only append if the message belongs to the currently open thread
      if (
        t &&
        Number(msg.patient_id) === Number(t.patient_id) &&
        Number(msg.doctor_id)  === Number(t.doctor_id)
      ) {
        setMessages(prev => [...prev, msg])
      }

      // keep thread list preview up to date
      setThreads(prev => {
        const exists = prev.find(
          th =>
            Number(th.patient_id) === Number(msg.patient_id) &&
            Number(th.doctor_id)  === Number(msg.doctor_id)
        )
        if (exists) {
          return prev.map(th =>
            Number(th.patient_id) === Number(msg.patient_id) &&
            Number(th.doctor_id)  === Number(msg.doctor_id)
              ? { ...th, last_body: msg.body, last_message_at: msg.created_at }
              : th
          )
        }
        // new thread (first message) — prepend a minimal entry
        return [{
          patient_id:      msg.patient_id,
          doctor_id:       msg.doctor_id,
          patient_name:    msg.patient_name,
          doctor_name:     msg.doctor_name,
          last_body:       msg.body,
          last_message_at: msg.created_at,
          message_count:   1,
        }, ...prev]
      })
    })

    socket.on('message_error', ({ error }) => {
      setSendError(error)
    })

    return () => socket.disconnect()
  }, [])

  // ── load threads ──
  useEffect(() => {
    getThreads()
      .then(all => {
        // filter to only threads relevant to this user
        const mine = all.filter(t => {
          if (user.role === 'doctor')  return Number(t.doctor_id)  === Number(user.doctor_id)
          if (user.role === 'patient') return Number(t.patient_id) === Number(user.patient_id)
          return true // admin sees all
        })
        setThreads(mine)
      })
      .finally(() => setThreadsLoad(false))
  }, [user])

  // ── open thread ──
  const openThread = useCallback((thread) => {
    activeRef.current = thread
    setActiveThread(thread)
    setMessages([])
    setMsgsLoad(true)
    setText('')
    setSendError(null)
    setShowNewChat(false)

    // join socket room
    socketRef.current?.emit('join_chat', {
      patient_id: thread.patient_id,
      doctor_id:  thread.doctor_id,
    })

    // load history
    getThread(thread.patient_id, thread.doctor_id)
      .then(setMessages)
      .finally(() => {
        setMsgsLoad(false)
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      })
  }, [])

  // ── scroll to bottom on new messages ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── send message ──
  function handleSend() {
    if (!text.trim() || !activeThread) return
    setSendError(null)
    socketRef.current?.emit('send_message', {
      patient_id:  activeThread.patient_id,
      doctor_id:   activeThread.doctor_id,
      sender_role: user.role,
      body:        text.trim(),
    })
    setText('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── "new chat" contact selected ──
  function handleContactSelect(contact) {
    const isDoctor = user.role === 'doctor'
    const thread = {
      patient_id:   isDoctor ? contact.id : user.patient_id,
      doctor_id:    isDoctor ? user.doctor_id : contact.id,
      patient_name: isDoctor ? `${contact.first_name} ${contact.last_name}` : '',
      doctor_name:  isDoctor ? '' : `${contact.first_name} ${contact.last_name}`,
      last_body:    null,
      last_message_at: null,
      message_count: 0,
    }
    openThread(thread)
  }

  // ── derived ──
  const otherName = activeThread
    ? (user.role === 'doctor' ? activeThread.patient_name : activeThread.doctor_name)
    : null

  const noId = (user.role === 'doctor' && !user.doctor_id) ||
               (user.role === 'patient' && !user.patient_id)

  // ── render ──
  if (noId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-h)' }}>
            Account not linked
          </h2>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Your login is not linked to a{' '}
            {user.role === 'doctor' ? 'doctor' : 'patient'} record yet.
            Ask an admin to set the {user.role}_id on your user account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* page title */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Messages</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
          Real-time secure chat
        </p>
      </div>

      {/* chat container */}
      <div
        className="bg-white rounded-2xl border overflow-hidden flex"
        style={{ borderColor: 'var(--border)', height: 'calc(100vh - 170px)', minHeight: 480 }}>

        {/* ── left panel: thread list ── */}
        <div className="w-72 flex-shrink-0 border-r flex flex-col"
          style={{ borderColor: 'var(--border)' }}>

          {/* panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>
              Conversations
            </span>
            <button
              onClick={() => setShowNewChat(v => !v)}
              title="New conversation"
              className="w-7 h-7 flex items-center justify-center rounded-lg font-bold text-white text-sm"
              style={{ background: 'var(--primary)' }}>
              +
            </button>
          </div>

          {/* new chat search or thread list */}
          {showNewChat ? (
            <NewChatPanel
              myRole={user.role}
              onSelect={handleContactSelect}
              onCancel={() => setShowNewChat(false)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              {threadsLoad ? (
                <div className="flex flex-col gap-2 p-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-xl animate-pulse"
                      style={{ background: 'var(--border)' }} />
                  ))}
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
                  <span className="text-2xl">💬</span>
                  <p className="text-xs" style={{ color: 'var(--text)' }}>
                    No conversations yet. Click <strong>+</strong> to start one.
                  </p>
                </div>
              ) : threads.map(t => (
                <ThreadItem
                  key={roomId(t.patient_id, t.doctor_id)}
                  thread={t}
                  myRole={user.role}
                  isActive={
                    activeThread &&
                    Number(t.patient_id) === Number(activeThread.patient_id) &&
                    Number(t.doctor_id)  === Number(activeThread.doctor_id)
                  }
                  onClick={() => openThread(t)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── right panel: chat thread ── */}
        {activeThread ? (
          <div className="flex-1 flex flex-col min-w-0">

            {/* thread header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b"
              style={{ borderColor: 'var(--border)', background: '#fafafa' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: 'var(--primary)' }}>
                {otherName?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>
                  {otherName}
                </div>
                <div className="text-xs" style={{ color: 'var(--text)' }}>
                  {user.role === 'doctor' ? 'Patient' : 'Doctor'}
                </div>
              </div>
            </div>

            {/* message list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {msgsLoad ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i}
                      className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="h-10 w-48 rounded-2xl animate-pulse"
                        style={{ background: 'var(--border)' }} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-60">
                  <span className="text-3xl">👋</span>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    Start the conversation
                  </p>
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.sender_role === user.role}
                  />
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* send error */}
            {sendError && (
              <div className="mx-5 mb-2 px-4 py-2 rounded-xl text-xs flex gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
                <span>⚠</span>
                <span>{sendError}</span>
                <button className="ml-auto font-bold" onClick={() => setSendError(null)}>×</button>
              </div>
            )}

            {/* compose bar */}
            <div className="flex items-end gap-2 px-4 py-3 border-t"
              style={{ borderColor: 'var(--border)', background: '#fafafa' }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 px-4 py-2.5 rounded-2xl border resize-none text-sm outline-none"
                style={{
                  borderColor: 'var(--border)',
                  background:  '#fff',
                  color:       'var(--text-h)',
                  maxHeight:   120,
                  lineHeight:  '1.5',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-opacity"
                style={{
                  background: 'var(--primary)',
                  opacity:    text.trim() ? 1 : 0.4,
                  cursor:     text.trim() ? 'pointer' : 'not-allowed',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              Select a conversation or start a new one
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
