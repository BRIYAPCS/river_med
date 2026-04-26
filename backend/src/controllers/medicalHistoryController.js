const { getPool } = require('../db/connection')

// ── access helper ─────────────────────────────────────────────────────────────
// patient → own records only
// doctor  → any patient (read) or patient they have appointment with (write)
// admin   → all
function resolvePatientId(req, paramPatientId) {
  const { role, patient_id } = req.user
  if (role === 'patient') return patient_id        // always own
  return paramPatientId ?? null                    // doctor/admin pass ?patient_id query
}

function ownershipErr(res) {
  return res.status(403).json({ error: 'Access denied.' })
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLERGIES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/medical/allergies?patient_id=X
async function getAllergies(req, res) {
  const pid = resolvePatientId(req, req.query.patient_id)
  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM patient_allergies WHERE patient_id = ? ORDER BY created_at DESC', [pid]
    )
    res.json(rows)
  } catch (err) {
    console.error('[medical] getAllergies:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// POST /api/medical/allergies
async function createAllergy(req, res) {
  const pid = resolvePatientId(req, req.body.patient_id)
  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (req.user.role === 'patient' && Number(pid) !== Number(req.user.patient_id)) return ownershipErr(res)

  const { allergen, severity = 'mild', reaction, notes } = req.body
  if (!allergen) return res.status(400).json({ error: 'allergen is required.' })

  try {
    const [result] = await getPool().query(
      'INSERT INTO patient_allergies (patient_id, allergen, severity, reaction, notes) VALUES (?, ?, ?, ?, ?)',
      [pid, allergen, severity, reaction ?? null, notes ?? null]
    )
    const [[row]] = await getPool().query('SELECT * FROM patient_allergies WHERE id = ?', [result.insertId])
    res.status(201).json(row)
  } catch (err) {
    console.error('[medical] createAllergy:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// PUT /api/medical/allergies/:id
async function updateAllergy(req, res) {
  const { id } = req.params
  const { allergen, severity, reaction, notes } = req.body
  try {
    const pool = getPool()
    const [[row]] = await pool.query('SELECT * FROM patient_allergies WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'Allergy not found.' })
    if (req.user.role === 'patient' && Number(row.patient_id) !== Number(req.user.patient_id)) return ownershipErr(res)

    await pool.query(
      `UPDATE patient_allergies SET allergen=?, severity=?, reaction=?, notes=? WHERE id=?`,
      [allergen ?? row.allergen, severity ?? row.severity, reaction ?? row.reaction, notes ?? row.notes, id]
    )
    const [[updated]] = await pool.query('SELECT * FROM patient_allergies WHERE id = ?', [id])
    res.json(updated)
  } catch (err) {
    console.error('[medical] updateAllergy:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// DELETE /api/medical/allergies/:id
async function deleteAllergy(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [[row]] = await pool.query('SELECT * FROM patient_allergies WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'Allergy not found.' })
    if (req.user.role === 'patient' && Number(row.patient_id) !== Number(req.user.patient_id)) return ownershipErr(res)

    await pool.query('DELETE FROM patient_allergies WHERE id = ?', [id])
    res.json({ message: 'Allergy removed.' })
  } catch (err) {
    console.error('[medical] deleteAllergy:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

async function getConditions(req, res) {
  const pid = resolvePatientId(req, req.query.patient_id)
  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM patient_conditions WHERE patient_id = ? ORDER BY created_at DESC', [pid]
    )
    res.json(rows)
  } catch (err) {
    console.error('[medical] getConditions:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function createCondition(req, res) {
  const pid = resolvePatientId(req, req.body.patient_id)
  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (req.user.role === 'patient' && Number(pid) !== Number(req.user.patient_id)) return ownershipErr(res)

  const { name, status = 'active', diagnosed_at, notes } = req.body
  if (!name) return res.status(400).json({ error: 'name is required.' })

  try {
    const [result] = await getPool().query(
      'INSERT INTO patient_conditions (patient_id, name, status, diagnosed_at, notes) VALUES (?, ?, ?, ?, ?)',
      [pid, name, status, diagnosed_at ?? null, notes ?? null]
    )
    const [[row]] = await getPool().query('SELECT * FROM patient_conditions WHERE id = ?', [result.insertId])
    res.status(201).json(row)
  } catch (err) {
    console.error('[medical] createCondition:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function updateCondition(req, res) {
  const { id } = req.params
  const { name, status, diagnosed_at, notes } = req.body
  try {
    const pool = getPool()
    const [[row]] = await pool.query('SELECT * FROM patient_conditions WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'Condition not found.' })
    if (req.user.role === 'patient' && Number(row.patient_id) !== Number(req.user.patient_id)) return ownershipErr(res)

    await pool.query(
      `UPDATE patient_conditions SET name=?, status=?, diagnosed_at=?, notes=? WHERE id=?`,
      [name ?? row.name, status ?? row.status, diagnosed_at ?? row.diagnosed_at, notes ?? row.notes, id]
    )
    const [[updated]] = await pool.query('SELECT * FROM patient_conditions WHERE id = ?', [id])
    res.json(updated)
  } catch (err) {
    console.error('[medical] updateCondition:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function deleteCondition(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [[row]] = await pool.query('SELECT * FROM patient_conditions WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'Condition not found.' })
    if (req.user.role === 'patient' && Number(row.patient_id) !== Number(req.user.patient_id)) return ownershipErr(res)

    await pool.query('DELETE FROM patient_conditions WHERE id = ?', [id])
    res.json({ message: 'Condition removed.' })
  } catch (err) {
    console.error('[medical] deleteCondition:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT MEDICATIONS (non-Rx — meds brought from outside the clinic)
// ─────────────────────────────────────────────────────────────────────────────

async function getMedications(req, res) {
  const pid = resolvePatientId(req, req.query.patient_id)
  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM patient_medications WHERE patient_id = ? ORDER BY is_active DESC, created_at DESC', [pid]
    )
    res.json(rows)
  } catch (err) {
    console.error('[medical] getMedications:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function createMedication(req, res) {
  const pid = resolvePatientId(req, req.body.patient_id)
  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (req.user.role === 'patient' && Number(pid) !== Number(req.user.patient_id)) return ownershipErr(res)

  const { name, dosage, frequency, started_at, notes } = req.body
  if (!name) return res.status(400).json({ error: 'name is required.' })

  try {
    const [result] = await getPool().query(
      'INSERT INTO patient_medications (patient_id, name, dosage, frequency, started_at, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [pid, name, dosage ?? null, frequency ?? null, started_at ?? null, notes ?? null]
    )
    const [[row]] = await getPool().query('SELECT * FROM patient_medications WHERE id = ?', [result.insertId])
    res.status(201).json(row)
  } catch (err) {
    console.error('[medical] createMedication:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function updateMedication(req, res) {
  const { id } = req.params
  const { name, dosage, frequency, started_at, is_active, notes } = req.body
  try {
    const pool = getPool()
    const [[row]] = await pool.query('SELECT * FROM patient_medications WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'Medication not found.' })
    if (req.user.role === 'patient' && Number(row.patient_id) !== Number(req.user.patient_id)) return ownershipErr(res)

    await pool.query(
      `UPDATE patient_medications SET name=?, dosage=?, frequency=?, started_at=?, is_active=?, notes=? WHERE id=?`,
      [
        name       ?? row.name,
        dosage     ?? row.dosage,
        frequency  ?? row.frequency,
        started_at ?? row.started_at,
        is_active  !== undefined ? (is_active ? 1 : 0) : row.is_active,
        notes      ?? row.notes,
        id,
      ]
    )
    const [[updated]] = await pool.query('SELECT * FROM patient_medications WHERE id = ?', [id])
    res.json(updated)
  } catch (err) {
    console.error('[medical] updateMedication:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function deleteMedication(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [[row]] = await pool.query('SELECT * FROM patient_medications WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'Medication not found.' })
    if (req.user.role === 'patient' && Number(row.patient_id) !== Number(req.user.patient_id)) return ownershipErr(res)

    await pool.query('DELETE FROM patient_medications WHERE id = ?', [id])
    res.json({ message: 'Medication removed.' })
  } catch (err) {
    console.error('[medical] deleteMedication:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getAllergies, createAllergy, updateAllergy, deleteAllergy,
  getConditions, createCondition, updateCondition, deleteCondition,
  getMedications, createMedication, updateMedication, deleteMedication,
}
