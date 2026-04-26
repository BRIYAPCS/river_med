const { getPool } = require('../db/connection')

const VITALS_SELECT = `
  SELECT v.*,
    CONCAT(u.first_name, ' ', u.last_name) AS recorded_by_name
  FROM appointment_vitals v
  LEFT JOIN users u ON v.recorded_by = u.id
`

// ─── GET /api/appointments/:id/vitals ─────────────────────────────────────────
async function getVitals(req, res) {
  const { id } = req.params
  const { role, patient_id, doctor_id } = req.user
  try {
    const pool = getPool()

    // Confirm the appointment exists and the caller has access to it
    const [[appt]] = await pool.query(
      'SELECT id, patient_id, doctor_id FROM appointments WHERE id = ?', [id]
    )
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' })

    if (role === 'patient' && Number(appt.patient_id) !== Number(patient_id)) {
      return res.status(403).json({ error: 'Access denied.' })
    }
    if (role === 'doctor' && Number(appt.doctor_id) !== Number(doctor_id)) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const [[vitals]] = await pool.query(
      `${VITALS_SELECT} WHERE v.appointment_id = ?`, [id]
    )
    res.json(vitals ?? null)
  } catch (err) {
    console.error('[vitals] getVitals:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/appointments/:id/vitals ────────────────────────────────────────
// Doctor records vitals for an appointment. Creates or fully replaces.
async function recordVitals(req, res) {
  const { id }    = req.params
  const { id: userId, role, doctor_id } = req.user
  const {
    weight_kg, height_cm, bp_systolic, bp_diastolic,
    heart_rate, temperature_c, oxygen_sat, notes,
  } = req.body

  try {
    const pool = getPool()
    const [[appt]] = await pool.query(
      'SELECT id, doctor_id FROM appointments WHERE id = ?', [id]
    )
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' })

    if (role === 'doctor' && Number(appt.doctor_id) !== Number(doctor_id)) {
      return res.status(403).json({ error: 'You can only record vitals for your own appointments.' })
    }

    await pool.query(
      `INSERT INTO appointment_vitals
         (appointment_id, weight_kg, height_cm, bp_systolic, bp_diastolic,
          heart_rate, temperature_c, oxygen_sat, recorded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         weight_kg     = VALUES(weight_kg),
         height_cm     = VALUES(height_cm),
         bp_systolic   = VALUES(bp_systolic),
         bp_diastolic  = VALUES(bp_diastolic),
         heart_rate    = VALUES(heart_rate),
         temperature_c = VALUES(temperature_c),
         oxygen_sat    = VALUES(oxygen_sat),
         recorded_by   = VALUES(recorded_by),
         notes         = VALUES(notes),
         updated_at    = CURRENT_TIMESTAMP`,
      [
        id,
        weight_kg     ?? null,
        height_cm     ?? null,
        bp_systolic   ?? null,
        bp_diastolic  ?? null,
        heart_rate    ?? null,
        temperature_c ?? null,
        oxygen_sat    ?? null,
        userId,
        notes         ?? null,
      ]
    )

    const [[saved]] = await pool.query(`${VITALS_SELECT} WHERE v.appointment_id = ?`, [id])
    res.status(201).json({ message: 'Vitals recorded.', vitals: saved })
  } catch (err) {
    console.error('[vitals] recordVitals:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getVitals, recordVitals }
