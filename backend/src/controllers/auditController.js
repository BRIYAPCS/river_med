const { getPool } = require('../db/connection')

// ─── GET /api/audit_log (admin only) ─────────────────────────────────────────
async function getAuditLog(req, res) {
  const { action, entity_type, user_id, limit: lim = 100, offset: off = 0 } = req.query

  let where = '1=1'
  const params = []

  if (action)      { where += ' AND al.action LIKE ?';    params.push(`%${action}%`) }
  if (entity_type) { where += ' AND al.entity_type = ?';  params.push(entity_type) }
  if (user_id)     { where += ' AND al.user_id = ?';      params.push(user_id) }

  try {
    const [rows] = await getPool().query(
      `SELECT al.*,
         u.email AS user_email,
         CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS user_name
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(lim), Number(off)]
    )

    const [[{ total }]] = await getPool().query(
      `SELECT COUNT(*) AS total FROM audit_log al WHERE ${where}`, params
    )

    res.json({ total, rows })
  } catch (err) {
    console.error('[audit] getAuditLog:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── internal helper — fire-and-forget ───────────────────────────────────────
async function logAudit({ userId, userRole, action, entityType, entityId, details, ipAddress } = {}) {
  try {
    await getPool().query(
      `INSERT INTO audit_log (user_id, user_role, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId     ?? null,
        userRole   ?? null,
        action,
        entityType ?? null,
        entityId   ?? null,
        details    ? JSON.stringify(details) : null,
        ipAddress  ?? null,
      ]
    )
  } catch (err) {
    console.error('[audit] logAudit failed (non-fatal):', err.message)
  }
}

module.exports = { getAuditLog, logAudit }
