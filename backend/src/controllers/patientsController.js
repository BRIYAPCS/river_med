const { getPool } = require('../db/connection')

async function getPatients(req, res) {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM patients ORDER BY created_at DESC'
    )
    res.json(rows)
  } catch (err) {
    console.error('[patients] getPatients:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function getPatientById(req, res) {
  const { id } = req.params
  try {
    const [[patient]] = await getPool().query(
      'SELECT * FROM patients WHERE id = ?', [id]
    )
    if (!patient) return res.status(404).json({ error: `Patient ${id} not found` })
    res.json(patient)
  } catch (err) {
    console.error('[patients] getPatientById:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function createPatient(req, res) {
  const { first_name, last_name, email, phone, date_of_birth, blood_type } = req.body
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' })
  }
  try {
    const [result] = await getPool().query(
      'INSERT INTO patients (first_name, last_name, email, phone, date_of_birth, blood_type) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email ?? null, phone ?? null, date_of_birth ?? null, blood_type ?? null]
    )
    res.status(201).json({ id: result.insertId, message: 'Patient created' })
  } catch (err) {
    console.error('[patients] createPatient:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// GET /api/patients/me — returns the authenticated user's own patient profile.
// Resolution order:
//   1. users.patient_id  (set at registration — fastest path)
//   2. patients.user_id  (back-reference fallback for older rows)
//   3. 404 if neither resolves
async function getMyPatient(req, res) {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  try {
    const pool = getPool()

    // Step 1: read patient_id from users row
    const [[userRow]] = await pool.query(
      'SELECT patient_id FROM users WHERE id = ?',
      [userId]
    )

    let patient = null

    // Step 2: look up by patient_id if present
    if (userRow?.patient_id) {
      const [[row]] = await pool.query(
        `SELECT id, user_id, first_name, middle_name, last_name, second_last_name,
                email, phone, date_of_birth, blood_type, created_at
         FROM patients WHERE id = ?`,
        [userRow.patient_id]
      )
      patient = row ?? null
    }

    // Step 3: fallback — look up by user_id back-reference
    if (!patient) {
      const [[row]] = await pool.query(
        `SELECT id, user_id, first_name, middle_name, last_name, second_last_name,
                email, phone, date_of_birth, blood_type, created_at
         FROM patients WHERE user_id = ?`,
        [userId]
      )
      patient = row ?? null
    }

    // Step 4: nothing found
    if (!patient) {
      return res.status(404).json({ error: 'No patient profile linked to this account.' })
    }

    res.json(patient)
  } catch (err) {
    console.error('[patients] getMyPatient:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getPatients, getPatientById, createPatient, getMyPatient }
