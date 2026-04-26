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

module.exports = { getDoctors, createDoctor }
