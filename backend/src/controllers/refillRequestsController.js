const { getPool }        = require('../db/connection')
const { broadcastRefill } = require('../socket')

const VALID_ACTIONS = new Set(['approved', 'rejected', 'denied'])

// Map frontend status strings → DB ENUM values
function toDbStatus(s) {
  const lower = s?.toLowerCase()
  if (lower === 'approved') return 'Approved'
  if (lower === 'rejected' || lower === 'denied') return 'Denied'
  return null
}

// Shared JOIN used by GET queries
const REFILL_SELECT = `
  SELECT
    rr.id,
    rr.prescription_id,
    rr.status,
    rr.doctor_notes,
    rr.created_at,
    pr.medication_name,
    pr.dosage,
    pr.patient_id,
    p.first_name,
    p.last_name,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name
  FROM refill_requests rr
  JOIN prescriptions pr ON rr.prescription_id = pr.id
  JOIN patients      p  ON pr.patient_id       = p.id
`

// ─── GET /api/refill_requests/pending ─────────────────────────────────────────
async function getPendingRefills(req, res) {
  try {
    const [rows] = await getPool().query(
      `${REFILL_SELECT} WHERE rr.status = 'Pending' ORDER BY rr.created_at ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error('[refill_requests] getPendingRefills:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/refill_requests/patient/:patientId ──────────────────────────────
async function getRefillRequestsByPatient(req, res) {
  const { patientId } = req.params
  try {
    const [rows] = await getPool().query(
      `${REFILL_SELECT} WHERE pr.patient_id = ? ORDER BY rr.created_at DESC`,
      [patientId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[refill_requests] getRefillRequestsByPatient:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/refill_requests/:id/status ──────────────────────────────────────
async function updateRefillStatus(req, res) {
  const { id }               = req.params
  const { status, notes = null } = req.body

  if (!status) {
    return res.status(400).json({ error: 'status is required' })
  }

  if (!VALID_ACTIONS.has(status.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid status "${status}". Use: approved | rejected`,
    })
  }

  const dbStatus = toDbStatus(status)

  try {
    const pool = getPool()

    const [[existing]] = await pool.query(
      'SELECT id, status FROM refill_requests WHERE id = ?', [id]
    )
    if (!existing) {
      return res.status(404).json({ error: `Refill request ${id} not found` })
    }
    if (existing.status !== 'Pending') {
      return res.status(409).json({
        error: `Request already actioned (${existing.status})`,
      })
    }

    await pool.query(
      'UPDATE refill_requests SET status = ?, doctor_notes = ? WHERE id = ?',
      [dbStatus, notes, id]
    )

    const [[updated]] = await pool.query(
      `${REFILL_SELECT} WHERE rr.id = ?`, [id]
    )

    broadcastRefill(updated)

    res.json({ message: `Refill ${dbStatus.toLowerCase()}`, request: updated })
  } catch (err) {
    console.error('[refill_requests] updateRefillStatus:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/refill_requests ────────────────────────────────────────────────
async function createRefillRequest(req, res) {
  const { prescription_id } = req.body

  if (!prescription_id) {
    return res.status(400).json({ error: 'prescription_id is required' })
  }

  try {
    const pool = getPool()

    const [[rx]] = await pool.query(
      'SELECT id, refill_allowed FROM prescriptions WHERE id = ?',
      [prescription_id]
    )
    if (!rx) return res.status(404).json({ error: 'Prescription not found' })
    if (!rx.refill_allowed) {
      return res.status(400).json({ error: 'Refills are not allowed for this prescription' })
    }

    const [[dup]] = await pool.query(
      "SELECT id FROM refill_requests WHERE prescription_id = ? AND status = 'Pending'",
      [prescription_id]
    )
    if (dup) {
      return res.status(409).json({ error: 'A pending refill request already exists' })
    }

    const [result] = await pool.query(
      "INSERT INTO refill_requests (prescription_id, status) VALUES (?, 'Pending')",
      [prescription_id]
    )

    const [[created]] = await pool.query(
      `${REFILL_SELECT} WHERE rr.id = ?`, [result.insertId]
    )
    broadcastRefill(created)

    res.status(201).json({ id: result.insertId, message: 'Refill request submitted' })
  } catch (err) {
    console.error('[refill_requests] createRefillRequest:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getPendingRefills,
  getRefillRequestsByPatient,
  updateRefillStatus,
  createRefillRequest,
}
