const { getPool } = require('../db/connection')

// ─── GET /api/analytics ───────────────────────────────────────────────────────
async function getAnalytics(req, res) {
  try {
    const pool = getPool()

    const [
      [totalsRows],
      [byStatus],
      [byDay],
      [byMonth],
      [refillsByStatus],
    ] = await Promise.all([

      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM patients)                                                          AS total_patients,
          (SELECT COUNT(*) FROM doctors)                                                           AS total_doctors,
          (SELECT COUNT(*) FROM appointments)                                                      AS total_appointments,
          (SELECT COUNT(*) FROM appointments WHERE LOWER(status) = 'completed')                   AS completed_appointments,
          (SELECT COUNT(*) FROM appointments WHERE LOWER(status) IN ('waiting','in_progress','in-progress')) AS active_appointments,
          (SELECT COUNT(*) FROM refill_requests WHERE status = 'Pending')                         AS pending_refills,
          (SELECT COUNT(*) FROM messages)                                                          AS total_messages
      `),

      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM   appointments
        GROUP  BY status
        ORDER  BY count DESC
      `),

      pool.query(`
        SELECT
          DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date,
          COUNT(*) AS count
        FROM   appointments
        WHERE  appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP  BY DATE_FORMAT(appointment_date, '%Y-%m-%d')
        ORDER  BY date ASC
      `),

      pool.query(`
        SELECT
          DATE_FORMAT(appointment_date, '%Y-%m') AS month,
          COUNT(*) AS count
        FROM   appointments
        WHERE  appointment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP  BY DATE_FORMAT(appointment_date, '%Y-%m')
        ORDER  BY month ASC
      `),

      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM   refill_requests
        GROUP  BY status
        ORDER  BY count DESC
      `),
    ])

    res.json({
      totals:                 totalsRows[0],
      appointments_by_status: byStatus,
      appointments_by_day:    byDay,
      appointments_by_month:  byMonth,
      refills_by_status:      refillsByStatus,
    })
  } catch (err) {
    console.error('[analytics] getAnalytics:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/analytics/appointments-per-day ──────────────────────────────────
// Daily appointment counts for the last 30 days broken down by status.
async function getAppointmentsPerDay(req, res) {
  try {
    const pool = getPool()

    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date,
        COUNT(*)                                  AS total,
        SUM(CASE WHEN LOWER(status) = 'completed'                             THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN LOWER(status) IN ('waiting','in_progress','in-progress') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN LOWER(status) = 'cancelled'                             THEN 1 ELSE 0 END) AS cancelled
      FROM  appointments
      WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(appointment_date, '%Y-%m-%d')
      ORDER BY date ASC
    `)

    res.json(rows)
  } catch (err) {
    console.error('[analytics] getAppointmentsPerDay:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/analytics/top-medications ──────────────────────────────────────
// Most prescribed medications, ranked by prescription count.
async function getTopMedications(req, res) {
  try {
    const [rows] = await getPool().query(`
      SELECT
        medication_name                             AS name,
        COUNT(*)                                    AS count,
        SUM(CASE WHEN refill_allowed THEN 1 ELSE 0 END) AS refillable
      FROM  prescriptions
      GROUP BY medication_name
      ORDER BY count DESC
      LIMIT 10
    `)

    res.json(rows)
  } catch (err) {
    console.error('[analytics] getTopMedications:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/analytics/doctor-load ──────────────────────────────────────────
// Per-doctor appointment volume with status breakdown.
async function getDoctorLoad(req, res) {
  try {
    const [rows] = await getPool().query(`
      SELECT
        CONCAT(d.first_name, ' ', d.last_name)                                               AS doctor_name,
        d.specialty,
        COUNT(a.id)                                                                           AS total,
        SUM(CASE WHEN LOWER(a.status) = 'completed'                             THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN LOWER(a.status) IN ('waiting','in_progress','in-progress') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN LOWER(a.status) = 'cancelled'                             THEN 1 ELSE 0 END) AS cancelled
      FROM  doctors d
      LEFT JOIN appointments a ON d.id = a.doctor_id
      GROUP BY d.id, d.first_name, d.last_name, d.specialty
      ORDER BY total DESC
    `)

    res.json(rows)
  } catch (err) {
    console.error('[analytics] getDoctorLoad:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAnalytics, getAppointmentsPerDay, getTopMedications, getDoctorLoad }
