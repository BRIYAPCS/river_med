const { getPool } = require('../db/connection')

// ─── GET /api/notifications ───────────────────────────────────────────────────
// Returns the 50 most recent notifications for the authenticated user.
// Unread ones come first.
async function getNotifications(req, res) {
  try {
    const [rows] = await getPool().query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY read_at IS NOT NULL, created_at DESC
       LIMIT 50`,
      [req.user.id]
    )
    const unreadCount = rows.filter(n => !n.read_at).length
    res.json({ notifications: rows, unread_count: unreadCount })
  } catch (err) {
    console.error('[notifications] getNotifications:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/notifications/:id/read ─────────────────────────────────────────
async function markRead(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [[notif]] = await pool.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]
    )
    if (!notif) return res.status(404).json({ error: 'Notification not found.' })

    await pool.query(
      'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE id = ?', [id]
    )
    res.json({ message: 'Marked as read.' })
  } catch (err) {
    console.error('[notifications] markRead:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/notifications/read-all ─────────────────────────────────────────
async function markAllRead(req, res) {
  try {
    await getPool().query(
      'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    )
    res.json({ message: 'All notifications marked as read.' })
  } catch (err) {
    console.error('[notifications] markAllRead:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── internal helper — create a notification ──────────────────────────────────
// Called by other controllers (appointments, messages, refills) to push
// a notification into the DB. The Socket.IO layer then emits it in real time.
async function createNotification(userId, { type, title, body, link = null }) {
  if (!userId) return
  try {
    const [result] = await getPool().query(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, body, link]
    )
    const [[notif]] = await getPool().query(
      'SELECT * FROM notifications WHERE id = ?', [result.insertId]
    )
    return notif
  } catch (err) {
    console.error('[notifications] createNotification:', err.message)
  }
}

module.exports = { getNotifications, markRead, markAllRead, createNotification }
