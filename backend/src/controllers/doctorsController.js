const { getPool } = require('../db/connection')

async function getDoctors(req, res) {
  try {
    const [rows] = await getPool().query('SELECT * FROM doctors ORDER BY last_name ASC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function createDoctor(req, res) {
  const { first_name, last_name, specialty, email, phone } = req.body
  try {
    const [result] = await getPool().query(
      'INSERT INTO doctors (first_name, last_name, specialty, email, phone) VALUES (?, ?, ?, ?, ?)',
      [first_name, last_name, specialty, email, phone]
    )
    res.status(201).json({ id: result.insertId, message: 'Doctor created' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/doctors/me ──────────────────────────────────────────────────────
async function getMyDoctor(req, res) {
  const { doctor_id } = req.user
  if (!doctor_id) return res.status(404).json({ error: 'No doctor profile linked to this account.' })
  try {
    const [[doctor]] = await getPool().query('SELECT * FROM doctors WHERE id = ?', [doctor_id])
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' })
    res.json(doctor)
  } catch (err) {
    console.error('[doctors] getMyDoctor:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/doctors/me ──────────────────────────────────────────────────────
async function updateMyDoctor(req, res) {
  const { doctor_id } = req.user
  if (!doctor_id) return res.status(404).json({ error: 'No doctor profile linked to this account.' })

  const { first_name, last_name, specialty, phone } = req.body
  try {
    await getPool().query(
      `UPDATE doctors
         SET first_name = COALESCE(?, first_name),
             last_name  = COALESCE(?, last_name),
             specialty  = ?,
             phone      = ?
       WHERE id = ?`,
      [first_name ?? null, last_name ?? null, specialty ?? null, phone ?? null, doctor_id]
    )
    const [[updated]] = await getPool().query('SELECT * FROM doctors WHERE id = ?', [doctor_id])
    res.json({ message: 'Profile updated.', doctor: updated })
  } catch (err) {
    console.error('[doctors] updateMyDoctor:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/doctors/me/availability ────────────────────────────────────────
async function getMyAvailability(req, res) {
  const { doctor_id } = req.user
  if (!doctor_id) return res.status(404).json({ error: 'No doctor profile linked.' })
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week', [doctor_id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[doctors] getMyAvailability:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/doctors/me/availability ────────────────────────────────────────
// Body: [{ day_of_week, start_time, end_time, is_active }]
// Full replace — send the complete schedule each time.
async function setMyAvailability(req, res) {
  const { doctor_id } = req.user
  if (!doctor_id) return res.status(404).json({ error: 'No doctor profile linked.' })

  const slots = req.body
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'Body must be an array of availability slots.' })

  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('DELETE FROM doctor_availability WHERE doctor_id = ?', [doctor_id])

    for (const slot of slots) {
      const { day_of_week, start_time, end_time, is_active = 1 } = slot
      if (day_of_week == null || !start_time || !end_time) continue
      await conn.query(
        'INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?)',
        [doctor_id, day_of_week, start_time, end_time, is_active ? 1 : 0]
      )
    }

    await conn.commit()
    const [saved] = await pool.query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week', [doctor_id]
    )
    res.json({ message: 'Availability updated.', availability: saved })
  } catch (err) {
    await conn.rollback()
    console.error('[doctors] setMyAvailability:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
}

// ─── GET /api/doctors/:id/availability — public ───────────────────────────────
async function getDoctorAvailability(req, res) {
  const { id } = req.params
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? AND is_active = 1 ORDER BY day_of_week', [id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[doctors] getDoctorAvailability:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getDoctors, createDoctor, getMyDoctor, updateMyDoctor, getMyAvailability, setMyAvailability, getDoctorAvailability }
