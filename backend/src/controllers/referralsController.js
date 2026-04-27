const { getPool } = require('../db/connection')

// ─── GET /api/referrals ───────────────────────────────────────────────────────
async function getReferrals(req, res) {
  const { role, patient_id: jwtPid, doctor_id: jwtDid } = req.user
  const pool = getPool()

  let where = '1=1'
  const params = []

  if (role === 'patient') {
    if (!jwtPid) return res.status(403).json({ error: 'No patient record linked.' })
    where += ' AND r.patient_id = ?'; params.push(jwtPid)
  } else if (role === 'doctor') {
    const pid = req.query.patient_id ?? null
    if (pid) {
      where += ' AND r.patient_id = ?'; params.push(pid)
    } else {
      where += ' AND r.referring_doctor_id = ?'; params.push(jwtDid)
    }
  } else if (role === 'admin') {
    const pid = req.query.patient_id ?? null
    if (pid) { where += ' AND r.patient_id = ?'; params.push(pid) }
  } else {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [rows] = await pool.query(
      `SELECT r.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS doctor_name
       FROM referrals r
       JOIN patients p ON p.id = r.patient_id
       LEFT JOIN doctors d ON d.id = r.referring_doctor_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE ${where}
       ORDER BY r.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error('[referrals] getReferrals:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/referrals ──────────────────────────────────────────────────────
async function createReferral(req, res) {
  const { role, doctor_id: jwtDid } = req.user
  if (!['doctor', 'admin'].includes(role)) return res.status(403).json({ error: 'Access denied.' })

  const { patient_id, referred_to_name, referred_specialty, reason, notes } = req.body

  if (!patient_id)                             return res.status(400).json({ error: 'patient_id is required.' })
  if (!referred_to_name && !referred_specialty) return res.status(400).json({ error: 'referred_to_name or referred_specialty is required.' })

  try {
    const [result] = await getPool().query(
      `INSERT INTO referrals
         (patient_id, referring_doctor_id, referred_to_name, referred_specialty, reason, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patient_id, jwtDid ?? null, referred_to_name ?? null,
       referred_specialty ?? null, reason ?? null, notes ?? null]
    )
    const [[saved]] = await getPool().query('SELECT * FROM referrals WHERE id = ?', [result.insertId])
    res.status(201).json({ message: 'Referral created.', referral: saved })
  } catch (err) {
    console.error('[referrals] createReferral:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/referrals/:id/status ────────────────────────────────────────────
async function updateReferralStatus(req, res) {
  const { role } = req.user
  if (!['doctor', 'admin'].includes(role)) return res.status(403).json({ error: 'Access denied.' })

  const { id } = req.params
  const { status, notes } = req.body
  const VALID = ['pending', 'accepted', 'completed', 'cancelled']

  if (!VALID.includes(status)) return res.status(400).json({ error: `Invalid status. Valid: ${VALID.join(', ')}` })

  try {
    const [[ref]] = await getPool().query('SELECT id FROM referrals WHERE id = ?', [id])
    if (!ref) return res.status(404).json({ error: 'Referral not found.' })

    await getPool().query(
      'UPDATE referrals SET status = ?, notes = COALESCE(?, notes) WHERE id = ?',
      [status, notes ?? null, id]
    )
    const [[updated]] = await getPool().query('SELECT * FROM referrals WHERE id = ?', [id])
    res.json({ message: 'Referral updated.', referral: updated })
  } catch (err) {
    console.error('[referrals] updateReferralStatus:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getReferrals, createReferral, updateReferralStatus }
