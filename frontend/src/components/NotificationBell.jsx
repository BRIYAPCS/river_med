import { useState, useEffect, useRef, useCallback } from 'react'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api'

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell({ accentColor = '#0d9488' }) {
  const [open,  setOpen]  = useState(false)
  const [items, setItems] = useState([])
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await getNotifications()
      setItems(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { load() }, [load])

  // poll every 60s for new notifications
  useEffect(() => {
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  // close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = items.filter(n => !n.is_read).length

  async function handleOpen() {
    setOpen(o => !o)
    if (!open && unread > 0) {
      try {
        await markAllNotificationsRead()
        setItems(prev => prev.map(n => ({ ...n, is_read: true })))
      } catch { /* silent */ }
    }
  }

  async function handleMarkOne(id, e) {
    e.stopPropagation()
    try {
      await markNotificationRead(id)
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch { /* silent */ }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        title="Notifications"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)',
          background: open ? '#f1f5f9' : '#fff', cursor: 'pointer',
        }}>
        <BellIcon />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444', border: '1.5px solid #fff',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 320,
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 200, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)' }}>Notifications</span>
            {unread > 0 && <span style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>{unread} new</span>}
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text)' }}>
                No notifications yet
              </div>
            ) : items.map(n => (
              <div key={n.id}
                onClick={e => !n.is_read && handleMarkOne(n.id, e)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                  background: n.is_read ? '#fff' : '#f0fdf4',
                  cursor: n.is_read ? 'default' : 'pointer',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--text-h)', flex: 1 }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text)', flexShrink: 0 }}>
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                {n.body && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                    {n.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
