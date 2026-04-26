const { getPool } = require('../db/connection')

async function getPrescriptionsByPatient(req, res) {
  const { patientId } = req.params
  try {
    const [rows] = await getPool().query(
      `SELECT pr.*,
        CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
       FROM prescriptions pr
       JOIN doctors d ON pr.doctor_id = d.id
       WHERE pr.patient_id = ?
       ORDER BY pr.created_at DESC`,
      [patientId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function createPrescription(req, res) {
  const { patient_id, doctor_id, medication_name, dosage, instructions, refill_allowed } = req.body
  try {
    const [result] = await getPool().query(
      `INSERT INTO prescriptions
        (patient_id, doctor_id, medication_name, dosage, instructions, refill_allowed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patient_id, doctor_id, medication_name, dosage, instructions, refill_allowed ?? false]
    )
    res.status(201).json({ id: result.insertId, message: 'Prescription created' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function requestRefill(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [check] = await pool.query(
      'SELECT refill_allowed FROM prescriptions WHERE id = ?',
      [id]
    )
    if (!check.length) return res.status(404).json({ error: 'Prescription not found' })
    if (!check[0].refill_allowed) return res.status(400).json({ error: 'Refill not allowed for this prescription' })

    await pool.query(
      'INSERT INTO refill_requests (prescription_id, status) VALUES (?, ?)',
      [id, 'Pending']
    )
    res.status(201).json({ message: 'Refill request submitted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getPrescriptionsByPatient, createPrescription, requestRefill }
