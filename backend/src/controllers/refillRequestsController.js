const { getPool }              = require('../db/connection')
const { broadcastRefill }      = require('../socket')
const { createNotification }   = require('./notificationsController')

// ── status maps ───────────────────────────────────────────────────────────────
// DB ENUM stores title-case; accept lowercase from clients
const VALID_ACTIONS = new Set(['approved', 'denied', 'rejected'])

function toDbStatus(s) {
  const lower = s?.toLowerCase()
  if (lower === 'approved')              return 'Approved'
  if (lower === 'denied' || lower === 'rejected') return 'Denied'
  return null
}

// ── shared SELECT fragment ────────────────────────────────────────────────────
// Includes pr.doctor_id so doctor-scoped queries can filter without a second query.
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
    pr.doctor_id,
    p.first_name,
    p.last_name,
    CONCAT(p.first_name, ' ', p.last_name)        AS patient_name,
    CONCAT(d.first_name, ' ', d.last_name)        AS doctor_name
  FROM refill_requests rr
  JOIN prescriptions pr ON rr.prescription_id = pr.id
  JOIN patients      p  ON pr.patient_id       = p.id
  LEFT JOIN doctors  d  ON pr.doctor_id        = d.id
`

// ─── GET /api/refill_requests/me ─────────────────────────────────────────────
// patient → own refill requests (by patient_id on the linked prescription)
// doctor  → refill requests for prescriptions they wrote
// admin   → all
async function getMyRefillRequests(req, res) {
  const { role, patient_id, doctor_id } = req.user

  try {
    let rows

    if (role === 'patient') {
      if (!patient_id) {
        return res.status(404).json({ error: 'No patient profile linked to this account.' })
      }
      ;[rows] = await getPool().query(
        `${REFILL_SELECT}
         WHERE pr.patient_id = ?
         ORDER BY rr.created_at DESC`,
        [patient_id]
      )
    } else if (role === 'doctor') {
      if (!doctor_id) {
        return res.status(404).json({ error: 'No doctor profile linked to this account.' })
      }
      ;[rows] = await getPool().query(
        `${REFILL_SELECT}
         WHERE pr.doctor_id = ?
         ORDER BY rr.created_at DESC`,
        [doctor_id]
      )
    } else {
      // admin
      ;[rows] = await getPool().query(
        `${REFILL_SELECT} ORDER BY rr.created_at DESC`
      )
    }

    res.json(rows)
  } catch (err) {
    console.error('[refill_requests] getMyRefillRequests:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/refill_requests/pending ────────────────────────────────────────
// Doctor/admin: all pending requests. Preserved exactly as before.
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

// ─── GET /api/refill_requests/patient/:patientId ─────────────────────────────
// Backward-compatible. Patient can only fetch their own.
async function getRefillRequestsByPatient(req, res) {
  const { patientId }        = req.params
  const { role, patient_id } = req.user

  if (role === 'patient' && Number(patient_id) !== Number(patientId)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [rows] = await getPool().query(
      `${REFILL_SELECT}
       WHERE pr.patient_id = ?
       ORDER BY rr.created_at DESC`,
      [patientId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[refill_requests] getRefillRequestsByPatient:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/refill_requests/:id/status ─────────────────────────────────────
// Doctor → can only action refills for their own prescriptions.
// Admin  → can action any.
async function updateRefillStatus(req, res) {
  const { id }                    = req.params
  const { status, notes = null }  = req.body
  const { role, doctor_id }       = req.user

  if (!status) return res.status(400).json({ error: 'status is required.' })

  if (!VALID_ACTIONS.has(status.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid status "${status}". Use: approved | denied`,
    })
  }

  const dbStatus = toDbStatus(status)

  try {
    const pool = getPool()

    const [[existing]] = await pool.query(
      `SELECT rr.id, rr.status, pr.doctor_id
       FROM refill_requests rr
       JOIN prescriptions pr ON rr.prescription_id = pr.id
       WHERE rr.id = ?`,
      [id]
    )

    if (!existing) {
      return res.status(404).json({ error: `Refill request ${id} not found.` })
    }

    // Doctor can only action refills for their own prescriptions
    if (role === 'doctor' && Number(existing.doctor_id) !== Number(doctor_id)) {
      return res.status(403).json({
        error: 'You can only action refill requests for your own prescriptions.',
      })
    }

    if (existing.status !== 'Pending') {
      return res.status(409).json({
        error: `Request already actioned (${existing.status}).`,
      })
    }

    await pool.query(
      'UPDATE refill_requests SET status = ?, doctor_notes = ? WHERE id = ?',
      [dbStatus, notes, id]
    )

    const [[updated]] = await pool.query(`${REFILL_SELECT} WHERE rr.id = ?`, [id])
    broadcastRefill(updated)

    // Notify patient
    if (updated.patient_id) {
      const [[patientUser]] = await pool.query('SELECT id FROM users WHERE patient_id = ?', [updated.patient_id])
      if (patientUser) {
        await createNotification(patientUser.id, {
          type:  'refill',
          title: `Refill ${dbStatus}`,
          body:  `Your refill request for ${updated.medication_name} has been ${dbStatus.toLowerCase()}.`,
          link:  '/patient/prescriptions',
        })
      }
    }

    res.json({ message: `Refill ${dbStatus.toLowerCase()}`, request: updated })
  } catch (err) {
    console.error('[refill_requests] updateRefillStatus:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/refill_requests ────────────────────────────────────────────────
// Patient only.
// Validates: prescription exists, belongs to patient, refill_allowed, no dup pending.
async function createRefillRequest(req, res) {
  const { prescription_id }  = req.body
  const { patient_id }       = req.user

  if (!prescription_id) {
    return res.status(400).json({ error: 'prescription_id is required.' })
  }

  try {
    const pool = getPool()

    const [[rx]] = await pool.query(
      'SELECT id, patient_id, refill_allowed FROM prescriptions WHERE id = ?',
      [prescription_id]
    )

    if (!rx) {
      return res.status(404).json({ error: 'Prescription not found.' })
    }

    // Prescription must belong to the requesting patient
    if (Number(rx.patient_id) !== Number(patient_id)) {
      return res.status(403).json({ error: 'This prescription does not belong to your account.' })
    }

    if (!rx.refill_allowed) {
      return res.status(400).json({ error: 'Refills are not allowed for this prescription.' })
    }

    const [[dup]] = await pool.query(
      "SELECT id FROM refill_requests WHERE prescription_id = ? AND status = 'Pending'",
      [prescription_id]
    )
    if (dup) {
      return res.status(409).json({ error: 'A pending refill request already exists.' })
    }

    const [result] = await pool.query(
      "INSERT INTO refill_requests (prescription_id, status) VALUES (?, 'Pending')",
      [prescription_id]
    )

    const [[created]] = await pool.query(`${REFILL_SELECT} WHERE rr.id = ?`, [result.insertId])
    broadcastRefill(created)

    res.status(201).json({ id: result.insertId, message: 'Refill request submitted.', request: created })
  } catch (err) {
    console.error('[refill_requests] createRefillRequest:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getMyRefillRequests,
  getPendingRefills,
  getRefillRequestsByPatient,
  updateRefillStatus,
  createRefillRequest,
}
