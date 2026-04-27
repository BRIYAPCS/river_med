const { getPool } = require('../db/connection')

// ─── GET /api/lab_results ─────────────────────────────────────────────────────
async function getLabResults(req, res) {
  const { role, patient_id: jwtPid, doctor_id: jwtDid } = req.user
  const pool = getPool()

  let where = '1=1'
  const params = []

  if (role === 'patient') {
    if (!jwtPid) return res.status(403).json({ error: 'No patient record linked.' })
    where += ' AND lr.patient_id = ?'
    params.push(jwtPid)
  } else if (role === 'doctor') {
    const pid = req.query.patient_id ?? null
    if (pid) {
      where += ' AND lr.patient_id = ?'; params.push(pid)
    } else {
      where += ' AND lr.doctor_id = ?'; params.push(jwtDid)
    }
  } else if (role === 'admin') {
    const pid = req.query.patient_id ?? null
    if (pid) { where += ' AND lr.patient_id = ?'; params.push(pid) }
  } else {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [rows] = await pool.query(
      `SELECT lr.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS doctor_name
       FROM lab_results lr
       JOIN patients p ON p.id = lr.patient_id
       LEFT JOIN doctors doc ON doc.id = lr.doctor_id
       LEFT JOIN users u ON u.id = doc.user_id
       WHERE ${where}
       ORDER BY lr.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error('[labs] getLabResults:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/lab_results ────────────────────────────────────────────────────
async function createLabResult(req, res) {
  const { role, doctor_id: jwtDid } = req.user
  if (!['doctor', 'admin'].includes(role)) return res.status(403).json({ error: 'Access denied.' })

  const { patient_id, appointment_id, test_name, result_value, unit, reference_range, status, notes, resulted_at } = req.body

  if (!patient_id) return res.status(400).json({ error: 'patient_id is required.' })
  if (!test_name)  return res.status(400).json({ error: 'test_name is required.' })

  try {
    const [result] = await getPool().query(
      `INSERT INTO lab_results
         (patient_id, doctor_id, appointment_id, test_name, result_value,
          unit, reference_range, status, notes, resulted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id, jwtDid ?? null, appointment_id ?? null, test_name,
        result_value ?? null, unit ?? null, reference_range ?? null,
        status ?? 'pending', notes ?? null, resulted_at ?? null,
      ]
    )
    const [[saved]] = await getPool().query('SELECT * FROM lab_results WHERE id = ?', [result.insertId])
    res.status(201).json({ message: 'Lab result recorded.', lab_result: saved })
  } catch (err) {
    console.error('[labs] createLabResult:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/lab_results/:id ─────────────────────────────────────────────────
async function updateLabResult(req, res) {
  const { role } = req.user
  if (!['doctor', 'admin'].includes(role)) return res.status(403).json({ error: 'Access denied.' })

  const { id } = req.params
  const { result_value, unit, reference_range, status, notes, resulted_at } = req.body

  try {
    const [[lr]] = await getPool().query('SELECT id FROM lab_results WHERE id = ?', [id])
    if (!lr) return res.status(404).json({ error: 'Lab result not found.' })

    await getPool().query(
      `UPDATE lab_results SET
         result_value    = COALESCE(?, result_value),
         unit            = COALESCE(?, unit),
         reference_range = COALESCE(?, reference_range),
         status          = COALESCE(?, status),
         notes           = COALESCE(?, notes),
         resulted_at     = COALESCE(?, resulted_at)
       WHERE id = ?`,
      [result_value ?? null, unit ?? null, reference_range ?? null,
       status ?? null, notes ?? null, resulted_at ?? null, id]
    )
    const [[updated]] = await getPool().query('SELECT * FROM lab_results WHERE id = ?', [id])
    res.json({ message: 'Lab result updated.', lab_result: updated })
  } catch (err) {
    console.error('[labs] updateLabResult:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── DELETE /api/lab_results/:id ──────────────────────────────────────────────
async function deleteLabResult(req, res) {
  const { role } = req.user
  if (!['doctor', 'admin'].includes(role)) return res.status(403).json({ error: 'Access denied.' })

  const { id } = req.params
  try {
    const [[lr]] = await getPool().query('SELECT id FROM lab_results WHERE id = ?', [id])
    if (!lr) return res.status(404).json({ error: 'Lab result not found.' })
    await getPool().query('DELETE FROM lab_results WHERE id = ?', [id])
    res.json({ message: 'Lab result deleted.' })
  } catch (err) {
    console.error('[labs] deleteLabResult:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getLabResults, createLabResult, updateLabResult, deleteLabResult }
