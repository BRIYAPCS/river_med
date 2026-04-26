const { getPool }            = require('../db/connection')
const { broadcastAppointment } = require('../socket')

// ── valid status values ────────────────────────────────────────────────────────
const VALID_STATUSES = new Set([
  'waiting', 'in_progress', 'in-progress', 'completed', 'cancelled',
])

// ── shared SELECT fragment ────────────────────────────────────────────────────
// LEFT JOIN on doctors — doctor_id may be NULL for unassigned appointments.
const APPOINTMENT_SELECT = `
  SELECT
    a.*,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.blood_type,
    p.email  AS patient_email,
    p.phone  AS patient_phone,
    CONCAT(p.first_name, ' ', p.last_name)        AS patient_name,
    CONCAT_WS(' ', d.first_name, d.last_name)     AS doctor_name,
    d.specialty
  FROM appointments a
  JOIN      patients p ON a.patient_id = p.id
  LEFT JOIN doctors  d ON a.doctor_id  = d.id
`

// ── helpers ───────────────────────────────────────────────────────────────────

function badStatus(status) {
  return !VALID_STATUSES.has(status?.toLowerCase())
}

// ─── GET /api/appointments ────────────────────────────────────────────────────
// Admin + doctor only. Patients use /me instead.
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

// ─── GET /api/appointments/me ─────────────────────────────────────────────────
// Role-aware:
//   patient → own appointments (by patient_id from JWT)
//   doctor  → appointments assigned to them (by doctor_id from JWT)
//   admin   → all appointments
async function getMyAppointments(req, res) {
  const { role, patient_id, doctor_id } = req.user

  try {
    let rows

    if (role === 'patient') {
      if (!patient_id) {
        return res.status(404).json({ error: 'No patient profile linked to this account.' })
      }
      ;[rows] = await getPool().query(
        `${APPOINTMENT_SELECT}
         WHERE a.patient_id = ?
         ORDER BY a.appointment_date DESC`,
        [patient_id]
      )
    } else if (role === 'doctor') {
      if (!doctor_id) {
        return res.status(404).json({ error: 'No doctor profile linked to this account.' })
      }
      ;[rows] = await getPool().query(
        `${APPOINTMENT_SELECT}
         WHERE a.doctor_id = ?
         ORDER BY a.appointment_date DESC`,
        [doctor_id]
      )
    } else {
      // admin — full list
      ;[rows] = await getPool().query(
        `${APPOINTMENT_SELECT} ORDER BY a.appointment_date DESC`
      )
    }

    res.json(rows)
  } catch (err) {
    console.error('[appointments] getMyAppointments:', err.message)
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

// ─── GET /api/appointments/patient/:patientId ─────────────────────────────────
// Patients can only fetch their own record. Admin + doctor see any.
async function getPatientAppointments(req, res) {
  const { patientId } = req.params
  const { role, patient_id } = req.user

  if (role === 'patient' && Number(patient_id) !== Number(patientId)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

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
// Patient → books for themselves; doctor_id optional (admin assigns later).
// Admin   → can book for any patient with any doctor.
async function createAppointment(req, res) {
  const { role, patient_id: jwtPatientId } = req.user

  let { patient_id, doctor_id, appointment_date, reason, status = 'waiting' } = req.body

  if (role === 'patient') {
    if (!jwtPatientId) {
      return res.status(400).json({ error: 'No patient profile linked to this account.' })
    }
    patient_id = jwtPatientId   // patient can only book for themselves
    status     = 'waiting'       // patient cannot set their own status
  }

  if (!patient_id || !appointment_date) {
    return res.status(400).json({ error: 'patient_id and appointment_date are required.' })
  }

  if (status && badStatus(status)) {
    return res.status(400).json({ error: `Invalid status "${status}".` })
  }

  try {
    const pool = getPool()

    // Prevent double-booking: same doctor cannot have two appointments at the same datetime.
    // Only checked when a doctor is being assigned at creation time.
    if (doctor_id) {
      const [[conflict]] = await pool.query(
        `SELECT id FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`,
        [doctor_id, appointment_date]
      )
      if (conflict) {
        return res.status(409).json({
          error: 'That doctor already has an appointment at this date and time.',
        })
      }
    }

    const [result] = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, reason, status)
       VALUES (?, ?, ?, ?, ?)`,
      [patient_id, doctor_id ?? null, appointment_date, reason ?? null, status]
    )

    const [[created]] = await pool.query(
      `${APPOINTMENT_SELECT} WHERE a.id = ?`, [result.insertId]
    )
    broadcastAppointment('appointment_created', created)

    res.status(201).json({ id: result.insertId, message: 'Appointment created', appointment: created })
  } catch (err) {
    console.error('[appointments] createAppointment:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/appointments/:id/status ─────────────────────────────────────────
// Doctor → can only update their own assigned appointments.
// Admin  → can update any.
async function updateAppointmentStatus(req, res) {
  const { id }              = req.params
  const { status }          = req.body
  const { role, doctor_id } = req.user

  if (!status) return res.status(400).json({ error: 'status is required.' })
  if (badStatus(status)) {
    return res.status(400).json({
      error: `Invalid status "${status}". Allowed: ${[...VALID_STATUSES].join(', ')}`,
    })
  }

  try {
    const pool = getPool()
    const [[appt]] = await pool.query(
      'SELECT id, doctor_id FROM appointments WHERE id = ?', [id]
    )
    if (!appt) return res.status(404).json({ error: `Appointment ${id} not found.` })

    // Doctor may only update appointments assigned to them
    if (role === 'doctor' && Number(appt.doctor_id) !== Number(doctor_id)) {
      return res.status(403).json({ error: 'You can only update appointments assigned to you.' })
    }

    await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, id])

    const [[updated]] = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = ?`, [id])
    broadcastAppointment('appointment_updated', updated)
    res.json({ message: 'Status updated', appointment: updated })
  } catch (err) {
    console.error('[appointments] updateAppointmentStatus:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/appointments/:id/assign ────────────────────────────────────────
// Admin only. Assigns or re-assigns a doctor to an appointment.
async function assignDoctor(req, res) {
  const { id }        = req.params
  const { doctor_id } = req.body

  if (!doctor_id) return res.status(400).json({ error: 'doctor_id is required.' })

  try {
    const pool = getPool()

    const [[appt]] = await pool.query(
      'SELECT id FROM appointments WHERE id = ?', [id]
    )
    if (!appt) return res.status(404).json({ error: `Appointment ${id} not found.` })

    const [[doctor]] = await pool.query(
      'SELECT id FROM doctors WHERE id = ?', [doctor_id]
    )
    if (!doctor) return res.status(404).json({ error: `Doctor ${doctor_id} not found.` })

    await pool.query(
      'UPDATE appointments SET doctor_id = ? WHERE id = ?', [doctor_id, id]
    )

    const [[updated]] = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = ?`, [id])
    broadcastAppointment('appointment_updated', updated)
    res.json({ message: 'Doctor assigned', appointment: updated })
  } catch (err) {
    console.error('[appointments] assignDoctor:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/appointments/:id ────────────────────────────────────────────────
// Admin only — full update of all fields.
async function updateAppointment(req, res) {
  const { id } = req.params
  const { patient_id, doctor_id, appointment_date, reason, status } = req.body

  if (!patient_id || !appointment_date) {
    return res.status(400).json({ error: 'patient_id and appointment_date are required.' })
  }
  if (status && badStatus(status)) {
    return res.status(400).json({ error: `Invalid status "${status}".` })
  }

  try {
    const pool = getPool()
    const [[appt]] = await pool.query('SELECT id FROM appointments WHERE id = ?', [id])
    if (!appt) return res.status(404).json({ error: `Appointment ${id} not found.` })

    await pool.query(
      `UPDATE appointments
         SET patient_id=?, doctor_id=?, appointment_date=?, reason=?, status=?
       WHERE id=?`,
      [patient_id, doctor_id ?? null, appointment_date, reason ?? null, status ?? 'waiting', id]
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
// Patient → soft-cancel (status = 'cancelled') own waiting appointment only.
// Admin   → hard delete any appointment.
// Doctor  → not permitted (use PUT /:id/status instead).
async function deleteAppointment(req, res) {
  const { id }                    = req.params
  const { role, patient_id }      = req.user

  try {
    const pool = getPool()
    const [[appt]] = await pool.query(
      'SELECT id, patient_id, status FROM appointments WHERE id = ?', [id]
    )
    if (!appt) return res.status(404).json({ error: `Appointment ${id} not found.` })

    if (role === 'patient') {
      // Ownership check
      if (Number(appt.patient_id) !== Number(patient_id)) {
        return res.status(403).json({ error: 'You can only cancel your own appointments.' })
      }
      // Only cancellable when still waiting
      if (appt.status?.toLowerCase() !== 'waiting') {
        return res.status(409).json({
          error: `Cannot cancel an appointment with status "${appt.status}". Only waiting appointments can be cancelled.`,
        })
      }
      // Soft cancel — preserve the record
      await pool.query('UPDATE appointments SET status = ? WHERE id = ?', ['cancelled', id])
      const [[updated]] = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = ?`, [id])
      broadcastAppointment('appointment_updated', updated)
      return res.json({ message: 'Appointment cancelled', appointment: updated })
    }

    // Admin hard-deletes
    await pool.query('DELETE FROM appointments WHERE id = ?', [id])
    res.json({ message: 'Appointment deleted' })
  } catch (err) {
    console.error('[appointments] deleteAppointment:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getAppointments,
  getMyAppointments,
  getTodayAppointments,
  getPatientAppointments,
  createAppointment,
  updateAppointmentStatus,
  assignDoctor,
  updateAppointment,
  deleteAppointment,
}
