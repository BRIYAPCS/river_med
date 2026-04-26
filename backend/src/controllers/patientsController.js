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

// GET /api/patients/me — returns (and lazily links) the caller's patient profile.
//
// Fast path — patient_id already in JWT:
//   SELECT * FROM patients WHERE id = ?
//
// Slow path — patient_id missing from JWT (e.g. admin-created accounts,
//   or tokens issued before the link was established):
//   1. Load the user row to get name + email.
//   2. Look for an existing patients row by email (prevents duplicates).
//   3a. Found  → link it:  UPDATE users SET patient_id = existing.id
//   3b. Missing → create:  INSERT patients, then UPDATE users SET patient_id = new.id
//   Both 3a/3b run inside a transaction so the link is atomic.
//
// patients.user_id is NOT used anywhere in this function.
async function getMyPatient(req, res) {
  const { id: userId, patient_id } = req.user

  // ── fast path ──────────────────────────────────────────────────────────────
  if (patient_id) {
    try {
      const [[patient]] = await getPool().query(
        'SELECT * FROM patients WHERE id = ?',
        [patient_id]
      )
      if (!patient) {
        return res.status(404).json({ error: 'Patient profile not found.' })
      }
      return res.json(patient)
    } catch (err) {
      console.error('[patients] getMyPatient (fast path):', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  // ── slow path — no patient_id in JWT ──────────────────────────────────────
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Step A — load user record for name + email
    const [[userRow]] = await conn.query(
      'SELECT email, first_name, last_name FROM users WHERE id = ?',
      [userId]
    )
    if (!userRow) {
      await conn.rollback()
      return res.status(404).json({ error: 'User account not found.' })
    }

    let patient

    // Step B — check for an existing patient row by email (duplicate guard)
    if (userRow.email) {
      const [[existing]] = await conn.query(
        'SELECT * FROM patients WHERE email = ?',
        [userRow.email]
      )

      if (existing) {
        // Step C (found) — link the existing row to the user account
        await conn.query(
          'UPDATE users SET patient_id = ? WHERE id = ?',
          [existing.id, userId]
        )
        patient = existing
      }
    }

    if (!patient) {
      // Step C (not found) — create a new patient row then link it
      const firstName = userRow.first_name || 'Unknown'
      const lastName  = userRow.last_name  || 'User'

      const [result] = await conn.query(
        'INSERT INTO patients (first_name, last_name, email) VALUES (?, ?, ?)',
        [firstName, lastName, userRow.email ?? null]
      )
      const newPatientId = result.insertId

      await conn.query(
        'UPDATE users SET patient_id = ? WHERE id = ?',
        [newPatientId, userId]
      )

      const [[newPatient]] = await conn.query(
        'SELECT * FROM patients WHERE id = ?',
        [newPatientId]
      )
      patient = newPatient
    }

    await conn.commit()
    return res.json(patient)
  } catch (err) {
    await conn.rollback()
    console.error('[patients] getMyPatient (slow path):', err.message)
    return res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
}

// PUT /api/patients/me — patient updates their own profile.
// Email is intentionally excluded — it is tied to the auth account.
async function updateMyPatient(req, res) {
  const { patient_id } = req.user
  if (!patient_id) {
    return res.status(404).json({ error: 'No patient profile linked to this account.' })
  }

  const {
    first_name, middle_name, last_name, second_last_name,
    phone, date_of_birth, blood_type,
  } = req.body

  const VALID_BLOOD = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
  if (blood_type && !VALID_BLOOD.includes(blood_type)) {
    return res.status(400).json({ error: `Invalid blood type "${blood_type}".` })
  }

  try {
    await getPool().query(
      `UPDATE patients
         SET first_name       = COALESCE(?, first_name),
             middle_name      = ?,
             last_name        = COALESCE(?, last_name),
             second_last_name = ?,
             phone            = ?,
             date_of_birth    = ?,
             blood_type       = ?
       WHERE id = ?`,
      [
        first_name       ?? null,
        middle_name      ?? null,
        last_name        ?? null,
        second_last_name ?? null,
        phone            ?? null,
        date_of_birth    ?? null,
        blood_type       ?? null,
        patient_id,
      ]
    )

    const [[updated]] = await getPool().query(
      'SELECT * FROM patients WHERE id = ?', [patient_id]
    )
    res.json({ message: 'Profile updated.', patient: updated })
  } catch (err) {
    console.error('[patients] updateMyPatient:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getPatients, getPatientById, createPatient, getMyPatient, updateMyPatient }
