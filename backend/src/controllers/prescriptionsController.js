const { getPool } = require('../db/connection')

// ── shared SELECT fragment ────────────────────────────────────────────────────
const PRESCRIPTION_SELECT = `
  SELECT
    pr.*,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    d.specialty,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name
  FROM prescriptions pr
  JOIN doctors  d ON pr.doctor_id  = d.id
  JOIN patients p ON pr.patient_id = p.id
`

// ─── GET /api/prescriptions/me ────────────────────────────────────────────────
// patient → own prescriptions
// doctor  → prescriptions they wrote
// admin   → all
async function getMyPrescriptions(req, res) {
  const { role, patient_id, doctor_id } = req.user

  try {
    let rows

    if (role === 'patient') {
      if (!patient_id) {
        return res.status(404).json({ error: 'No patient profile linked to this account.' })
      }
      ;[rows] = await getPool().query(
        `${PRESCRIPTION_SELECT}
         WHERE pr.patient_id = ?
         ORDER BY pr.created_at DESC`,
        [patient_id]
      )
    } else if (role === 'doctor') {
      if (!doctor_id) {
        return res.status(404).json({ error: 'No doctor profile linked to this account.' })
      }
      ;[rows] = await getPool().query(
        `${PRESCRIPTION_SELECT}
         WHERE pr.doctor_id = ?
         ORDER BY pr.created_at DESC`,
        [doctor_id]
      )
    } else {
      // admin
      ;[rows] = await getPool().query(
        `${PRESCRIPTION_SELECT} ORDER BY pr.created_at DESC`
      )
    }

    res.json(rows)
  } catch (err) {
    console.error('[prescriptions] getMyPrescriptions:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/prescriptions/patient/:patientId ────────────────────────────────
// Kept for backward compatibility. Patient can only fetch their own.
async function getPrescriptionsByPatient(req, res) {
  const { patientId }        = req.params
  const { role, patient_id } = req.user

  // Patient can only read their own prescriptions
  if (role === 'patient' && Number(patient_id) !== Number(patientId)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [rows] = await getPool().query(
      `${PRESCRIPTION_SELECT}
       WHERE pr.patient_id = ?
       ORDER BY pr.created_at DESC`,
      [patientId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[prescriptions] getPrescriptionsByPatient:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/prescriptions ──────────────────────────────────────────────────
// Doctor: doctor_id is pulled from JWT — cannot write on behalf of another doctor.
// Admin:  may supply any doctor_id in the body.
async function createPrescription(req, res) {
  const { role, doctor_id: jwtDoctorId } = req.user
  const {
    patient_id,
    medication_name,
    dosage,
    instructions,
    refill_allowed = false,
  } = req.body

  // Admin may pass doctor_id explicitly; doctor uses their own JWT identity
  const doctor_id = role === 'admin'
    ? (req.body.doctor_id ?? null)
    : jwtDoctorId

  if (!patient_id)      return res.status(400).json({ error: 'patient_id is required.' })
  if (!doctor_id)       return res.status(400).json({ error: 'doctor_id is required.' })
  if (!medication_name) return res.status(400).json({ error: 'medication_name is required.' })
  if (!dosage)          return res.status(400).json({ error: 'dosage is required.' })

  try {
    const pool = getPool()

    // Verify patient exists
    const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [patient_id])
    if (!patient) return res.status(404).json({ error: `Patient ${patient_id} not found.` })

    // Verify doctor exists
    const [[doctor]] = await pool.query('SELECT id FROM doctors WHERE id = ?', [doctor_id])
    if (!doctor) return res.status(404).json({ error: `Doctor ${doctor_id} not found.` })

    const [result] = await pool.query(
      `INSERT INTO prescriptions
         (patient_id, doctor_id, medication_name, dosage, instructions, refill_allowed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patient_id, doctor_id, medication_name, dosage, instructions ?? null, refill_allowed ? 1 : 0]
    )

    const [[created]] = await pool.query(
      `${PRESCRIPTION_SELECT} WHERE pr.id = ?`, [result.insertId]
    )

    res.status(201).json({ id: result.insertId, message: 'Prescription created', prescription: created })
  } catch (err) {
    console.error('[prescriptions] createPrescription:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/prescriptions/:id/refill ──────────────────────────────────────
// Legacy refill shortcut on the prescriptions router.
// Full refill workflow lives at /api/refill_requests.
// Patient can only refill their own prescription.
async function requestRefill(req, res) {
  const { id }               = req.params
  const { role, patient_id } = req.user

  try {
    const pool = getPool()

    const [[rx]] = await pool.query(
      'SELECT id, patient_id, refill_allowed FROM prescriptions WHERE id = ?', [id]
    )
    if (!rx) return res.status(404).json({ error: 'Prescription not found.' })

    // Patient ownership check
    if (role === 'patient' && Number(rx.patient_id) !== Number(patient_id)) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    if (!rx.refill_allowed) {
      return res.status(400).json({ error: 'Refills are not allowed for this prescription.' })
    }

    const [[dup]] = await pool.query(
      "SELECT id FROM refill_requests WHERE prescription_id = ? AND status = 'Pending'",
      [id]
    )
    if (dup) {
      return res.status(409).json({ error: 'A pending refill request already exists.' })
    }

    const [result] = await pool.query(
      "INSERT INTO refill_requests (prescription_id, status) VALUES (?, 'Pending')", [id]
    )
    res.status(201).json({ id: result.insertId, message: 'Refill request submitted.' })
  } catch (err) {
    console.error('[prescriptions] requestRefill:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getMyPrescriptions,
  getPrescriptionsByPatient,
  createPrescription,
  requestRefill,
}
