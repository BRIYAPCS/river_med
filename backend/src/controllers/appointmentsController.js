const { getPool }                            = require('../db/connection')
const { broadcastAppointment }               = require('../socket')

// Statuses the queue system accepts via PUT /:id/status
const VALID_STATUSES = new Set([
  'waiting',
  'in_progress',
  'in-progress',
  'completed',
  'cancelled',
])

// Shared JOIN fragment — includes all patient fields so the frontend
// never needs a second request to display a patient record.
const APPOINTMENT_SELECT = `
  SELECT
    a.*,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.blood_type,
    p.email  AS patient_email,
    p.phone  AS patient_phone,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    d.specialty
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  JOIN doctors  d ON a.doctor_id  = d.id
`

// ─── GET /api/appointments ────────────────────────────────────────────────────
async function getAppointments(req, res) {
  try {
    const [rows] = await getPool().query(
      `${APPOINTMENT_SELECT} ORDER BY a.appointment_date DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error('[appointments] getAppointments:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/appointments/today ──────────────────────────────────────────────
async function getTodayAppointments(req, res) {
  try {
    const [rows] = await getPool().query(
      `${APPOINTMENT_SELECT}
       WHERE DATE(a.appointment_date) = CURDATE()
       ORDER BY a.appointment_date ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error('[appointments] getTodayAppointments:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/appointments/:id/status ─────────────────────────────────────────
async function updateAppointmentStatus(req, res) {
  const { id }     = req.params
  const { status } = req.body

  if (!status) {
    return res.status(400).json({ error: 'status is required' })
  }

  if (!VALID_STATUSES.has(status.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid status "${status}". Allowed: ${[...VALID_STATUSES].join(', ')}`,
    })
  }

  try {
    const pool = getPool()
    const [check] = await pool.query(
      'SELECT id FROM appointments WHERE id = ?', [id]
    )
    if (!check.length) {
      return res.status(404).json({ error: `Appointment ${id} not found` })
    }

    await pool.query(
      'UPDATE appointments SET status = ? WHERE id = ?',
      [status, id]
    )

    const [[updated]] = await pool.query(
      `${APPOINTMENT_SELECT} WHERE a.id = ?`, [id]
    )

    broadcastAppointment('appointment_updated', updated)
    res.json({ message: 'Status updated', appointment: updated })
  } catch (err) {
    console.error('[appointments] updateAppointmentStatus:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/appointments/patient/:patientId ─────────────────────────────────
async function getPatientAppointments(req, res) {
  const { patientId } = req.params
  try {
    const [rows] = await getPool().query(
      `${APPOINTMENT_SELECT}
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC`,
      [patientId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[appointments] getPatientAppointments:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/appointments ───────────────────────────────────────────────────
async function createAppointment(req, res) {
  const {
    patient_id,
    doctor_id,
    appointment_date,
    reason,
    status = 'waiting',   // queue-ready default
  } = req.body

  if (!patient_id || !doctor_id || !appointment_date) {
    return res.status(400).json({
      error: 'patient_id, doctor_id and appointment_date are required',
    })
  }

  try {
    const pool = getPool()
    const [result] = await pool.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_date, reason, status)
       VALUES (?, ?, ?, ?, ?)`,
      [patient_id, doctor_id, appointment_date, reason ?? null, status]
    )

    const [[created]] = await pool.query(
      `${APPOINTMENT_SELECT} WHERE a.id = ?`, [result.insertId]
    )
    broadcastAppointment('appointment_created', created)

    res.status(201).json({ id: result.insertId, message: 'Appointment created' })
  } catch (err) {
    console.error('[appointments] createAppointment:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/appointments/:id ────────────────────────────────────────────────
async function updateAppointment(req, res) {
  const { id } = req.params
  const { patient_id, doctor_id, appointment_date, reason, status } = req.body

  if (!patient_id || !doctor_id || !appointment_date) {
    return res.status(400).json({
      error: 'patient_id, doctor_id and appointment_date are required',
    })
  }
  if (status && !VALID_STATUSES.has(status.toLowerCase())) {
    return res.status(400).json({ error: `Invalid status "${status}"` })
  }

  try {
    const pool = getPool()
    const [check] = await pool.query('SELECT id FROM appointments WHERE id = ?', [id])
    if (!check.length) return res.status(404).json({ error: `Appointment ${id} not found` })

    await pool.query(
      `UPDATE appointments
         SET patient_id=?, doctor_id=?, appointment_date=?, reason=?, status=?
       WHERE id=?`,
      [patient_id, doctor_id, appointment_date, reason ?? null, status ?? 'waiting', id]
    )

    const [[updated]] = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = ?`, [id])
    broadcastAppointment('appointment_updated', updated)
    res.json({ message: 'Appointment updated', appointment: updated })
  } catch (err) {
    console.error('[appointments] updateAppointment:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── DELETE /api/appointments/:id ─────────────────────────────────────────────
async function deleteAppointment(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [check] = await pool.query('SELECT id FROM appointments WHERE id = ?', [id])
    if (!check.length) return res.status(404).json({ error: `Appointment ${id} not found` })

    await pool.query('DELETE FROM appointments WHERE id = ?', [id])
    res.json({ message: 'Appointment deleted' })
  } catch (err) {
    console.error('[appointments] deleteAppointment:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getAppointments,
  getTodayAppointments,
  getPatientAppointments,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  createAppointment,
}
