const { getPool } = require('../db/connection')

function esc(val) {
  if (val == null) return ''
  const s = String(val)
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function toCsv(keys, rows) {
  const head = keys.join(',')
  const body = rows.map(r => keys.map(k => esc(r[k])).join(',')).join('\n')
  return `${head}\n${body}`
}

function sendCsv(res, filename, keys, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(toCsv(keys, rows))
}

const stamp = () => new Date().toISOString().slice(0, 10)

// ─── GET /api/reports/appointments ────────────────────────────────────────────
async function exportAppointments(req, res) {
  try {
    const [rows] = await getPool().query(
      `SELECT a.id,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name, p.email AS patient_email,
         CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS doctor_name,
         a.appointment_date, a.status, a.reason, a.notes, a.created_at
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN users u ON u.id = d.user_id
       ORDER BY a.appointment_date DESC`
    )
    sendCsv(res, `appointments_${stamp()}.csv`,
      ['id','patient_name','patient_email','doctor_name','appointment_date','status','reason','notes','created_at'],
      rows)
  } catch (err) {
    console.error('[reports] appointments:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/reports/patients ────────────────────────────────────────────────
async function exportPatients(req, res) {
  try {
    const [rows] = await getPool().query(
      `SELECT id, first_name, last_name, email, phone, date_of_birth, blood_type, created_at
       FROM patients ORDER BY created_at DESC`
    )
    sendCsv(res, `patients_${stamp()}.csv`,
      ['id','first_name','last_name','email','phone','date_of_birth','blood_type','created_at'],
      rows)
  } catch (err) {
    console.error('[reports] patients:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/reports/prescriptions ──────────────────────────────────────────
async function exportPrescriptions(req, res) {
  try {
    const [rows] = await getPool().query(
      `SELECT pr.id,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name, p.email AS patient_email,
         CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS doctor_name,
         pr.medication_name, pr.dosage, pr.instructions, pr.refill_allowed, pr.created_at
       FROM prescriptions pr
       JOIN patients p ON p.id = pr.patient_id
       LEFT JOIN doctors d ON d.id = pr.doctor_id
       LEFT JOIN users u ON u.id = d.user_id
       ORDER BY pr.created_at DESC`
    )
    sendCsv(res, `prescriptions_${stamp()}.csv`,
      ['id','patient_name','patient_email','doctor_name','medication_name','dosage','instructions','refill_allowed','created_at'],
      rows)
  } catch (err) {
    console.error('[reports] prescriptions:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/reports/revenue ─────────────────────────────────────────────────
async function exportRevenue(req, res) {
  try {
    const [rows] = await getPool().query(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS month,
         COUNT(*) AS invoice_count,
         SUM(amount) AS total_billed,
         SUM(CASE WHEN status = 'paid'  THEN amount ELSE 0 END) AS total_paid,
         SUM(CASE WHEN status IN ('draft','sent') THEN amount ELSE 0 END) AS total_pending
       FROM invoices
       GROUP BY month ORDER BY month DESC`
    )
    sendCsv(res, `revenue_${stamp()}.csv`,
      ['month','invoice_count','total_billed','total_paid','total_pending'],
      rows)
  } catch (err) {
    console.error('[reports] revenue:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { exportAppointments, exportPatients, exportPrescriptions, exportRevenue }
