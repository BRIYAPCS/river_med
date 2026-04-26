const { getPool } = require('../db/connection')

// Shared JOIN fragment
const MSG_SELECT = `
  SELECT m.*,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
  FROM messages m
  JOIN patients p ON m.patient_id = p.id
  JOIN doctors  d ON m.doctor_id  = d.id
`

// ─── GET /api/messages ────────────────────────────────────────────────────────
async function getMessages(req, res) {
  try {
    const [rows] = await getPool().query(
      `${MSG_SELECT} ORDER BY m.created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error('[messages] getMessages:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/messages/threads ────────────────────────────────────────────────
// Returns one row per unique (patient_id, doctor_id) pair, ordered by most
// recent activity. Used to build the thread list in the chat sidebar.
async function getThreads(req, res) {
  try {
    const [rows] = await getPool().query(`
      SELECT
        m.patient_id,
        m.doctor_id,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
        MAX(m.created_at)                        AS last_message_at,
        COUNT(*)                                 AS message_count,
        (
          SELECT body
          FROM   messages
          WHERE  patient_id = m.patient_id
            AND  doctor_id  = m.doctor_id
          ORDER  BY created_at DESC
          LIMIT  1
        ) AS last_body
      FROM messages m
      JOIN patients p ON m.patient_id = p.id
      JOIN doctors  d ON m.doctor_id  = d.id
      GROUP BY
        m.patient_id, m.doctor_id,
        p.first_name, p.last_name,
        d.first_name, d.last_name
      ORDER BY last_message_at DESC
    `)
    res.json(rows)
  } catch (err) {
    console.error('[messages] getThreads:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/messages/:patient_id/:doctor_id ─────────────────────────────────
// Returns the full message history for one thread, oldest first.
async function getThread(req, res) {
  const { patient_id, doctor_id } = req.params
  try {
    const [rows] = await getPool().query(
      `${MSG_SELECT}
       WHERE  m.patient_id = ?
         AND  m.doctor_id  = ?
       ORDER  BY m.created_at ASC`,
      [patient_id, doctor_id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[messages] getThread:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/messages ───────────────────────────────────────────────────────
async function sendMessage(req, res) {
  const { patient_id, doctor_id, sender_role, body } = req.body
  if (!patient_id || !doctor_id || !sender_role || !body?.trim()) {
    return res.status(400).json({
      error: 'patient_id, doctor_id, sender_role and body are required',
    })
  }
  try {
    const [result] = await getPool().query(
      'INSERT INTO messages (patient_id, doctor_id, sender_role, body) VALUES (?, ?, ?, ?)',
      [patient_id, doctor_id, sender_role, body.trim()]
    )
    res.status(201).json({ id: result.insertId, message: 'Message sent' })
  } catch (err) {
    console.error('[messages] sendMessage:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getMessages, getThreads, getThread, sendMessage }
