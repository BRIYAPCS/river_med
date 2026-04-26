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

module.exports = { getPatients, getPatientById, createPatient }
