const { getPool } = require('../db/connection')

// ─── GET /api/insurance?patient_id=X ─────────────────────────────────────────
async function getInsurance(req, res) {
  const { role, patient_id: jwtPid } = req.user
  const pid = role === 'patient' ? jwtPid : (req.query.patient_id ?? null)

  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (role === 'patient' && Number(pid) !== Number(jwtPid)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [[row]] = await getPool().query(
      'SELECT * FROM patient_insurance WHERE patient_id = ?', [pid]
    )
    res.json(row ?? null)
  } catch (err) {
    console.error('[insurance] getInsurance:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/insurance ───────────────────────────────────────────────────────
// Creates or updates insurance for a patient. One row per patient (UNIQUE).
async function upsertInsurance(req, res) {
  const { role, patient_id: jwtPid } = req.user
  const pid = role === 'patient' ? jwtPid : (req.body.patient_id ?? null)

  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (role === 'patient' && Number(pid) !== Number(jwtPid)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  const {
    carrier, policy_number, group_number, subscriber_id,
    subscriber_name, relation_to_subscriber, valid_from, valid_until,
  } = req.body

  try {
    await getPool().query(
      `INSERT INTO patient_insurance
         (patient_id, carrier, policy_number, group_number, subscriber_id,
          subscriber_name, relation_to_subscriber, valid_from, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         carrier                = VALUES(carrier),
         policy_number          = VALUES(policy_number),
         group_number           = VALUES(group_number),
         subscriber_id          = VALUES(subscriber_id),
         subscriber_name        = VALUES(subscriber_name),
         relation_to_subscriber = VALUES(relation_to_subscriber),
         valid_from             = VALUES(valid_from),
         valid_until            = VALUES(valid_until)`,
      [pid, carrier ?? null, policy_number ?? null, group_number ?? null,
       subscriber_id ?? null, subscriber_name ?? null,
       relation_to_subscriber ?? null, valid_from ?? null, valid_until ?? null]
    )
    const [[saved]] = await getPool().query(
      'SELECT * FROM patient_insurance WHERE patient_id = ?', [pid]
    )
    res.json({ message: 'Insurance saved.', insurance: saved })
  } catch (err) {
    console.error('[insurance] upsertInsurance:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getInsurance, upsertInsurance }
