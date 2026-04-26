const bcrypt      = require('bcryptjs')
const { getPool } = require('../db/connection')

const SALT_ROUNDS   = 12
const ALLOWED_ROLES = new Set(['admin', 'doctor'])

// ── POST /api/admin/users ─────────────────────────────────────────────────────
// Admin-only: create a staff account (doctor or admin).
// Staff accounts are pre-verified and receive a temporary password.

async function createStaffUser(req, res) {
  let { email, phone, role, password } = req.body

  email = email?.toLowerCase().trim() || null
  phone = phone?.trim() || null

  if (!email && !phone) {
    return res.status(400).json({ error: 'At least one of email or phone is required.' })
  }
  if (!role) {
    return res.status(400).json({ error: 'role is required.' })
  }
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({
      error: `role must be one of: ${[...ALLOWED_ROLES].join(', ')}.`,
    })
  }
  if (!password) {
    return res.status(400).json({ error: 'A temporary password is required for staff accounts.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  try {
    const pool = getPool()

    if (email) {
      const [[ex]] = await pool.query('SELECT id FROM users WHERE email = ?', [email])
      if (ex) return res.status(409).json({ error: 'An account with this email already exists.' })
    }
    if (phone) {
      const [[ex]] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone])
      if (ex) return res.status(409).json({ error: 'An account with this phone number already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Staff accounts are pre-verified — no OTP step required.
    const [result] = await pool.query(
      `INSERT INTO users (email, phone, password_hash, role, is_verified, is_active)
       VALUES (?, ?, ?, ?, 1, 1)`,
      [email, phone, passwordHash, role]
    )

    res.status(201).json({
      message: 'Staff account created.',
      user: {
        id:          result.insertId,
        email,
        phone,
        role,
        is_verified: true,
        is_active:   true,
      },
    })
  } catch (err) {
    console.error('[admin] createStaffUser:', err.message)
    res.status(500).json({ error: 'Failed to create staff account.' })
  }
}

// ── PUT /api/admin/users/:id/verify ──────────────────────────────────────────
// Admin-only: manually mark a user as verified.
// Use this when a patient registered but their OTP email never arrived
// (e.g. Resend test-sender restriction, spam filter, wrong address).

async function verifyUser(req, res) {
  const { id } = req.params
  try {
    const pool = getPool()
    const [[user]] = await pool.query(
      'SELECT id, email, is_verified FROM users WHERE id = ?', [id]
    )
    if (!user) return res.status(404).json({ error: `User ${id} not found.` })
    if (user.is_verified) return res.json({ message: 'Already verified.', user })

    await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [id])
    res.json({ message: `User ${id} (${user.email}) marked as verified.` })
  } catch (err) {
    console.error('[admin] verifyUser:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { createStaffUser, verifyUser }
