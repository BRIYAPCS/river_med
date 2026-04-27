const { getPool } = require('../db/connection')
const { logAudit } = require('./auditController')

// ─── GET /api/invoices ────────────────────────────────────────────────────────
async function getInvoices(req, res) {
  const { role, patient_id: jwtPid } = req.user
  const pool = getPool()

  try {
    let where = '1=1'
    const params = []

    if (role === 'patient') {
      where += ' AND i.patient_id = ?'
      params.push(jwtPid)
    } else if (role === 'admin') {
      const pid = req.query.patient_id ?? null
      if (pid) { where += ' AND i.patient_id = ?'; params.push(pid) }
    } else {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const [rows] = await pool.query(
      `SELECT i.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.email AS patient_email
       FROM invoices i
       JOIN patients p ON p.id = i.patient_id
       WHERE ${where}
       ORDER BY i.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error('[invoices] getInvoices:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────
async function createInvoice(req, res) {
  const { id: userId } = req.user
  const { patient_id, appointment_id, line_items, due_date, notes } = req.body

  if (!patient_id)                                     return res.status(400).json({ error: 'patient_id is required.' })
  if (!Array.isArray(line_items) || !line_items.length) return res.status(400).json({ error: 'At least one line item is required.' })

  const amount = line_items.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.price) || 0), 0)

  try {
    const [result] = await getPool().query(
      `INSERT INTO invoices (patient_id, appointment_id, amount, line_items, due_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, appointment_id ?? null, amount, JSON.stringify(line_items),
       due_date ?? null, notes ?? null, userId]
    )
    const [[saved]] = await getPool().query('SELECT * FROM invoices WHERE id = ?', [result.insertId])
    logAudit({ userId, userRole: 'admin', action: 'invoice.create', entityType: 'invoice', entityId: result.insertId, details: { patient_id, amount } })
    res.status(201).json({ message: 'Invoice created.', invoice: saved })
  } catch (err) {
    console.error('[invoices] createInvoice:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── PUT /api/invoices/:id ────────────────────────────────────────────────────
async function updateInvoice(req, res) {
  const { id } = req.params
  const { id: userId } = req.user
  const { status, notes, due_date, line_items } = req.body

  try {
    const [[inv]] = await getPool().query('SELECT * FROM invoices WHERE id = ?', [id])
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' })

    const sets = []
    const vals = []

    if (status)              { sets.push('status = ?');     vals.push(status) }
    if (notes !== undefined) { sets.push('notes = ?');      vals.push(notes) }
    if (due_date)            { sets.push('due_date = ?');   vals.push(due_date) }
    if (line_items) {
      const amt = line_items.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.price) || 0), 0)
      sets.push('line_items = ?', 'amount = ?')
      vals.push(JSON.stringify(line_items), amt)
    }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' })

    await getPool().query(`UPDATE invoices SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
    const [[updated]] = await getPool().query('SELECT * FROM invoices WHERE id = ?', [id])

    logAudit({ userId, userRole: 'admin', action: 'invoice.update', entityType: 'invoice', entityId: Number(id), details: { status } })
    res.json({ message: 'Invoice updated.', invoice: updated })
  } catch (err) {
    console.error('[invoices] updateInvoice:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── DELETE /api/invoices/:id ─────────────────────────────────────────────────
async function deleteInvoice(req, res) {
  const { id } = req.params
  const { id: userId } = req.user
  try {
    const [[inv]] = await getPool().query('SELECT * FROM invoices WHERE id = ?', [id])
    if (!inv)               return res.status(404).json({ error: 'Invoice not found.' })
    if (inv.status === 'paid') return res.status(400).json({ error: 'Cannot delete a paid invoice.' })

    await getPool().query('DELETE FROM invoices WHERE id = ?', [id])
    logAudit({ userId, userRole: 'admin', action: 'invoice.delete', entityType: 'invoice', entityId: Number(id) })
    res.json({ message: 'Invoice deleted.' })
  } catch (err) {
    console.error('[invoices] deleteInvoice:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getInvoices, createInvoice, updateInvoice, deleteInvoice }
