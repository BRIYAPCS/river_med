const { getPool } = require('../db/connection')

// ── shared SELECT ─────────────────────────────────────────────────────────────
const MSG_SELECT = `
  SELECT
    m.*,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
  FROM messages m
  JOIN patients p ON m.patient_id = p.id
  JOIN doctors  d ON m.doctor_id  = d.id
`

// Thread list base — groups messages into one row per (patient, doctor) pair.
// Parameterised WHERE clause appended per role.
const THREAD_SELECT = `
  SELECT
    m.patient_id,
    m.doctor_id,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    MAX(m.created_at)                       AS last_message_at,
    COUNT(*)                                AS message_count,
    (
      SELECT body
      FROM   messages
      WHERE  patient_id = m.patient_id
        AND  doctor_id  = m.doctor_id
      ORDER  BY created_at DESC
      LIMIT  1
    )                                       AS last_body,
    SUM(CASE WHEN m.read_at IS NULL AND m.sender_role != ? THEN 1 ELSE 0 END) AS unread_count
  FROM messages m
  JOIN patients p ON m.patient_id = p.id
  JOIN doctors  d ON m.doctor_id  = d.id
`
const THREAD_GROUP = `
  GROUP BY
    m.patient_id, m.doctor_id,
    p.first_name, p.last_name,
    d.first_name, d.last_name
  ORDER BY last_message_at DESC
`

// ── access helpers ────────────────────────────────────────────────────────────

// Returns true if the current user is a participant in the thread.
function canAccessThread(user, patientId, doctorId) {
  const { role, patient_id, doctor_id } = user
  if (role === 'admin')   return true
  if (role === 'patient') return Number(patient_id) === Number(patientId)
  if (role === 'doctor')  return Number(doctor_id)  === Number(doctorId)
  return false
}

// ─── GET /api/messages ────────────────────────────────────────────────────────
// Admin only — full message dump. Not intended for UI, useful for support.
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
// patient → threads they are part of (unread = unread doctor messages)
// doctor  → threads they are part of (unread = unread patient messages)
// admin   → all threads
async function getThreads(req, res) {
  const { role, patient_id, doctor_id } = req.user

  try {
    let rows

    if (role === 'patient') {
      if (!patient_id) {
        return res.status(404).json({ error: 'No patient profile linked to this account.' })
      }
      // unread_count counts doctor messages the patient hasn't read yet
      ;[rows] = await getPool().query(
        `${THREAD_SELECT}
         WHERE m.patient_id = ?
         ${THREAD_GROUP}`,
        ['patient', patient_id]
      )
    } else if (role === 'doctor') {
      if (!doctor_id) {
        return res.status(404).json({ error: 'No doctor profile linked to this account.' })
      }
      // unread_count counts patient messages the doctor hasn't read yet
      ;[rows] = await getPool().query(
        `${THREAD_SELECT}
         WHERE m.doctor_id = ?
         ${THREAD_GROUP}`,
        ['doctor', doctor_id]
      )
    } else {
      // admin — all threads, unread_count always 0 (not meaningful for admin)
      ;[rows] = await getPool().query(
        `${THREAD_SELECT} ${THREAD_GROUP}`,
        ['admin']
      )
    }

    res.json(rows)
  } catch (err) {
    console.error('[messages] getThreads:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/messages/thread/:patientId/:doctorId ────────────────────────────
// GET /api/messages/:patient_id/:doctor_id   (backward-compat alias)
// Full message history for one thread. Access: patient, doctor, admin.
async function getThread(req, res) {
  const patientId = req.params.patientId ?? req.params.patient_id
  const doctorId  = req.params.doctorId  ?? req.params.doctor_id

  if (!canAccessThread(req.user, patientId, doctorId)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [rows] = await getPool().query(
      `${MSG_SELECT}
       WHERE  m.patient_id = ?
         AND  m.doctor_id  = ?
       ORDER  BY m.created_at ASC`,
      [patientId, doctorId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[messages] getThread:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/messages ───────────────────────────────────────────────────────
// sender_role is derived from the authenticated user — never trusted from body.
// patient: patient_id must match their own JWT patient_id.
// doctor:  doctor_id  must match their own JWT doctor_id.
// Admins cannot send messages (not a valid sender_role in DB ENUM).
async function sendMessage(req, res) {
  const { role, patient_id: jwtPatientId, doctor_id: jwtDoctorId } = req.user
  const { patient_id, doctor_id, body } = req.body

  if (!patient_id || !doctor_id || !body?.trim()) {
    return res.status(400).json({ error: 'patient_id, doctor_id and body are required.' })
  }

  // Derive sender_role from JWT — never trust the frontend
  let sender_role
  if (role === 'patient') {
    if (Number(patient_id) !== Number(jwtPatientId)) {
      return res.status(403).json({ error: 'You can only send messages as yourself.' })
    }
    sender_role = 'patient'
  } else if (role === 'doctor') {
    if (Number(doctor_id) !== Number(jwtDoctorId)) {
      return res.status(403).json({ error: 'You can only send messages as yourself.' })
    }
    sender_role = 'doctor'
  } else {
    return res.status(403).json({ error: 'Admins cannot send messages.' })
  }

  try {
    const pool = getPool()

    // Verify the thread participants exist
    const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [patient_id])
    if (!patient) return res.status(404).json({ error: `Patient ${patient_id} not found.` })

    const [[doctor]] = await pool.query('SELECT id FROM doctors WHERE id = ?', [doctor_id])
    if (!doctor) return res.status(404).json({ error: `Doctor ${doctor_id} not found.` })

    const [result] = await pool.query(
      'INSERT INTO messages (patient_id, doctor_id, sender_role, body) VALUES (?, ?, ?, ?)',
      [patient_id, doctor_id, sender_role, body.trim()]
    )

    const [[created]] = await pool.query(
      `${MSG_SELECT} WHERE m.id = ?`, [result.insertId]
    )

    res.status(201).json({ id: result.insertId, message: 'Message sent', data: created })
  } catch (err) {
    console.error('[messages] sendMessage:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/messages/:id/read ───────────────────────────────────────────────
// Marks read_at = UTC_TIMESTAMP(). Only the receiver of the message may do this.
//   message.sender_role = 'patient' → doctor can mark read
//   message.sender_role = 'doctor'  → patient can mark read
//   admin can always mark read
async function markRead(req, res) {
  const { id }                              = req.params
  const { role, patient_id, doctor_id }     = req.user

  try {
    const pool = getPool()

    const [[msg]] = await pool.query(
      'SELECT id, patient_id, doctor_id, sender_role, read_at FROM messages WHERE id = ?',
      [id]
    )
    if (!msg) return res.status(404).json({ error: 'Message not found.' })

    // Determine whether the caller is the receiver
    const isReceiver =
      role === 'admin' ||
      (role === 'doctor'  && Number(msg.doctor_id)  === Number(doctor_id)  && msg.sender_role === 'patient') ||
      (role === 'patient' && Number(msg.patient_id) === Number(patient_id) && msg.sender_role === 'doctor')

    if (!isReceiver) {
      return res.status(403).json({ error: 'Only the recipient can mark a message as read.' })
    }

    if (msg.read_at) {
      return res.json({ message: 'Already marked as read.', read_at: msg.read_at })
    }

    await pool.query(
      'UPDATE messages SET read_at = UTC_TIMESTAMP() WHERE id = ?', [id]
    )

    res.json({ message: 'Message marked as read.' })
  } catch (err) {
    console.error('[messages] markRead:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getMessages, getThreads, getThread, sendMessage, markRead }
