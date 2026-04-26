const bcrypt  = require('bcryptjs')
const crypto  = require('crypto')
const jwt     = require('jsonwebtoken')
const { getPool } = require('../db/connection')
const { sendEmailOtp, sendSmsOtp, sendPasswordResetLink } = require('../services/notificationService')

const SALT_ROUNDS  = 12
const OTP_TTL_MS   = 15 * 60 * 1000   // 15 minutes
const VALID_ROLES  = new Set(['admin', 'doctor', 'patient'])

// ── internal helpers ──────────────────────────────────────────────────────────

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function buildPayload(user) {
  return {
    id:              user.id,
    email:           user.email          ?? null,
    phone:           user.phone          ?? null,
    role:            user.role,
    patient_id:      user.patient_id     ?? null,
    doctor_id:       user.doctor_id      ?? null,
    is_verified:     Boolean(user.is_verified),
    // Name components from the linked patients / doctors record
    first_name:      user.first_name     ?? null,
    middle_name:     user.middle_name    ?? null,
    last_name:       user.last_name      ?? null,
    second_last_name:user.second_last_name ?? null,
    // Pre-computed full display name (CONCAT_WS skips NULLs automatically)
    full_name:       user.full_name      ?? null,
  }
}

function generateOtp() {
  // Cryptographically random 6-digit code — no Math.random()
  return String(crypto.randomInt(100000, 999999))
}

function hashCode(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function isEmailIdentifier(id) {
  return id.includes('@')
}

async function findUserByIdentifier(identifier) {
  const pool = getPool()
  const [[user]] = await pool.query(`
    SELECT u.*,
      COALESCE(p.first_name, d.first_name)   AS first_name,
      p.middle_name                           AS middle_name,
      COALESCE(p.last_name,  d.last_name)    AS last_name,
      p.second_last_name                      AS second_last_name,
      CONCAT_WS(' ',
        COALESCE(p.first_name, d.first_name),
        p.middle_name,
        COALESCE(p.last_name, d.last_name),
        p.second_last_name
      )                                       AS full_name
    FROM   users u
    LEFT JOIN patients p ON u.patient_id = p.id
    LEFT JOIN doctors  d ON u.doctor_id  = d.id
    WHERE  u.email = ? OR u.phone = ?
    LIMIT  1
  `, [identifier, identifier])
  return user ?? null
}

// Format a JS Date as a UTC string MySQL understands: 'YYYY-MM-DD HH:MM:SS'
// This avoids timezone drift when the MySQL server is not in the same tz as Node.
function toUtcString(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

async function createAndSendOtp(userId, destination, deliveryMethod, purpose) {
  const pool      = getPool()
  const code      = generateOtp()
  const codeHash  = hashCode(code)
  // Store expiry as explicit UTC so MySQL's UTC_TIMESTAMP() comparison is correct
  const expiresAt = toUtcString(new Date(Date.now() + OTP_TTL_MS))

  await pool.query(
    `INSERT INTO otp_codes
       (user_id, delivery_method, destination, code_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, deliveryMethod, destination, codeHash, purpose, expiresAt]
  )

  if (deliveryMethod === 'email') {
    if (purpose === 'forgot_password') {
      await sendPasswordResetEmail(destination, code)
    } else {
      await sendEmailOtp(destination, code)
    }
  } else {
    await sendSmsOtp(destination, code)
  }
}

// ── POST /api/auth/patient/register ───────────────────────────────────────────
// Creates both a patients profile row and a users auth row in a single transaction.
// Email + password are required. Phone is optional (enables phone login later).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function patientRegister(req, res) {
  const firstName      = req.body.first_name?.trim()
  const middleName     = req.body.middle_name?.trim()     || null
  const lastName       = req.body.last_name?.trim()
  const secondLastName = req.body.second_last_name?.trim() || null
  const email          = req.body.email?.toLowerCase().trim()
  const phone          = req.body.phone?.trim() || null
  const password       = req.body.password

  if (!firstName || !lastName)
    return res.status(400).json({ error: 'First name and last name are required.' })
  if (!email)
    return res.status(400).json({ error: 'Email address is required.' })
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })

  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    // Duplicate checks before starting the transaction
    const [[existEmail]] = await conn.query('SELECT id FROM users WHERE email = ?', [email])
    if (existEmail)
      return res.status(409).json({ error: 'An account with this email already exists.' })

    if (phone) {
      const [[existPhone]] = await conn.query('SELECT id FROM users WHERE phone = ?', [phone])
      if (existPhone)
        return res.status(409).json({ error: 'An account with this phone number already exists.' })
    }

    // Guard against patients.email UNIQUE violation — can happen when a patient
    // row was created via the lazy-link path (getMyPatient slow path) before the
    // user formally completed registration.
    const [[existPatient]] = await conn.query('SELECT id FROM patients WHERE email = ?', [email])
    if (existPatient)
      return res.status(409).json({ error: 'An account with this email already exists.' })

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    await conn.beginTransaction()

    // 1. Create the patient profile (name, email, phone)
    const [patientResult] = await conn.query(
      `INSERT INTO patients
         (first_name, middle_name, last_name, second_last_name, email, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, middleName, lastName, secondLastName, email, phone]
    )
    const patientId = patientResult.insertId

    // 2. Create the auth user linked to the patient profile via users.patient_id
    const [userResult] = await conn.query(
      `INSERT INTO users (email, phone, password_hash, role, is_verified, is_active, patient_id)
       VALUES (?, ?, ?, 'patient', 0, 1, ?)`,
      [email, phone, passwordHash, patientId]
    )
    const userId = userResult.insertId

    await conn.commit()

    // Send OTP — runs outside the transaction so a delivery failure never
    // rolls back the user account. Code is always printed to PM2 logs.
    try {
      await createAndSendOtp(userId, email, 'email', 'register')
    } catch (emailErr) {
      console.error('[auth] OTP delivery failed (account still created):', emailErr.message)
    }

    res.status(201).json({
      message:        `Verification code sent to ${email}. Check your inbox — also check spam.`,
      userId,
      deliveryMethod: 'email',
    })
  } catch (err) {
    await conn.rollback()
    console.error('[auth] patientRegister:', err.message)
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  } finally {
    conn.release()
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Password-based login. Accepts email or phone as identifier.
// Also accepts legacy { email, password } body format for backwards compatibility.

async function login(req, res) {
  const identifier = (req.body.identifier ?? req.body.email ?? '').trim()
  const { password } = req.body

  if (!identifier) return res.status(400).json({ error: 'Email or phone is required.' })
  if (!password)   return res.status(400).json({ error: 'Password is required.' })

  try {
    const user = await findUserByIdentifier(identifier)
    if (!user)          return res.status(401).json({ error: 'Invalid credentials.' })
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated.' })

    if (!user.is_verified) {
      return res.status(403).json({
        error:      'Account not verified. Check your email or phone for a verification code.',
        unverified: true,
      })
    }

    if (!user.password_hash) {
      return res.status(400).json({
        error:    'This account uses PIN login. Please use the PIN option instead.',
        pinOnly:  true,
      })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' })

    const payload = buildPayload(user)
    const token   = signToken(payload)

    res.json({ token, user: payload })
  } catch (err) {
    console.error('[auth] login:', err.message)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
}

// ── POST /api/auth/request-otp ────────────────────────────────────────────────
// Generates a 6-digit OTP and delivers it via email or SMS.

async function requestOtp(req, res) {
  const identifier = (req.body.identifier ?? '').trim()
  const { purpose } = req.body
  const VALID_PURPOSES = ['login', 'register', 'forgot_password']

  if (!identifier)                    return res.status(400).json({ error: 'Identifier is required.' })
  if (!VALID_PURPOSES.includes(purpose)) return res.status(400).json({ error: `purpose must be one of: ${VALID_PURPOSES.join(', ')}.` })

  try {
    const user = await findUserByIdentifier(identifier)

    // Return generic success regardless — don't reveal account existence
    if (!user || !user.is_active) {
      return res.json({ message: 'If an account exists, a code was sent.' })
    }

    const deliveryMethod = isEmailIdentifier(identifier) ? 'email' : 'sms'
    await createAndSendOtp(user.id, identifier, deliveryMethod, purpose)

    res.json({ message: 'Verification code sent.' })
  } catch (err) {
    console.error('[auth] requestOtp:', err.message)
    res.status(500).json({ error: 'Could not send verification code. Please try again.' })
  }
}

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Validates an OTP. On success returns a JWT.
// If purpose=register, marks the account as verified.

async function verifyOtp(req, res) {
  const identifier = (req.body.identifier ?? '').trim()
  const code       = (req.body.code ?? '').trim()
  const { purpose } = req.body

  if (!identifier || !code || !purpose) {
    return res.status(400).json({ error: 'identifier, code, and purpose are required.' })
  }

  try {
    const pool = getPool()
    const user = await findUserByIdentifier(identifier)

    if (!user)           return res.status(404).json({ error: 'User not found.' })
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated.' })

    // For login, the account must already be verified
    if (purpose === 'login' && !user.is_verified) {
      return res.status(403).json({
        error:      'Account not yet verified. Complete registration first.',
        unverified: true,
      })
    }

    // Find the most recent unused, unexpired OTP for this user + purpose
    const [[otp]] = await pool.query(
      `SELECT * FROM otp_codes
       WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, purpose]
    )

    if (!otp) {
      return res.status(400).json({ error: 'Code expired or not found. Request a new one.' })
    }

    if (hashCode(code) !== otp.code_hash) {
      return res.status(400).json({ error: 'Invalid code.' })
    }

    // Mark OTP consumed
    await pool.query('UPDATE otp_codes SET used_at = UTC_TIMESTAMP() WHERE id = ?', [otp.id])

    // Mark user verified on successful registration confirmation
    if (purpose === 'register') {
      await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [user.id])
      user.is_verified = 1
    }

    const payload = buildPayload(user)
    const token   = signToken(payload)

    res.json({ token, user: payload })
  } catch (err) {
    console.error('[auth] verifyOtp:', err.message)
    res.status(500).json({ error: 'Verification failed. Please try again.' })
  }
}

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
// Sends a password-reset link via email.
// Always returns a generic message — never reveals whether the email exists.
// Prepares structure for Twilio phone PIN: add an 'sms' branch below when ready.

const FORGOT_GENERIC = 'If an account with that email exists, a reset link was sent.'
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000   // 15 minutes

async function forgotPassword(req, res) {
  const email = (req.body.email ?? req.body.identifier ?? '').toLowerCase().trim()

  if (!email) return res.status(400).json({ error: 'Email is required.' })

  try {
    const pool = getPool()
    const user = await findUserByIdentifier(email)

    // Return success regardless — prevents user enumeration via timing
    if (!user || !user.is_active || !user.email) {
      return res.json({ message: FORGOT_GENERIC })
    }

    // Invalidate any outstanding reset tokens for this user before issuing a new one
    await pool.query(
      `UPDATE password_reset_tokens
         SET used_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND used_at IS NULL`,
      [user.id]
    )

    // Generate a cryptographically random token — store only the SHA-256 hash
    const rawToken  = require('crypto').randomBytes(32).toString('hex')   // 64-char hex
    const tokenHash = hashCode(rawToken)
    const expiresAt = toUtcString(new Date(Date.now() + RESET_TOKEN_TTL_MS))

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt]
    )

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
    const resetUrl    = `${frontendUrl}/reset-password?token=${rawToken}`

    await sendPasswordResetLink(user.email, resetUrl)

    res.json({ message: FORGOT_GENERIC })
  } catch (err) {
    console.error('[auth] forgotPassword:', err.message)
    // Still return success — don't leak server errors to potential attackers
    res.json({ message: FORGOT_GENERIC })
  }
}

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
// Validates the token from the reset link and updates the password.
// Accepts { token, newPassword } — the token is the raw (unhashed) value from the URL.

async function resetPassword(req, res) {
  const rawToken    = (req.body.token       ?? '').trim()
  const newPassword = (req.body.newPassword ?? '').trim()

  if (!rawToken)    return res.status(400).json({ error: 'Reset token is required.' })
  if (!newPassword) return res.status(400).json({ error: 'New password is required.' })
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  try {
    const pool      = getPool()
    const tokenHash = hashCode(rawToken)

    const [[tokenRow]] = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [tokenHash]
    )

    if (!tokenRow) {
      return res.status(400).json({
        error: 'Reset link is invalid or has expired. Please request a new one.',
      })
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)

    // Update password and mark the token consumed — both in parallel
    await Promise.all([
      pool.query(
        'UPDATE users SET password_hash = ?, is_verified = 1 WHERE id = ?',
        [passwordHash, tokenRow.user_id]
      ),
      pool.query(
        'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?',
        [tokenRow.id]
      ),
    ])

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    console.error('[auth] resetPassword:', err.message)
    res.status(500).json({ error: 'Password reset failed. Please try again.' })
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns fresh user data from the DB on every page load.
// Querying the DB (not just decoding the JWT) ensures first_name / last_name
// are always current — even if the stored token predates the patient profile
// being linked or the name fields being populated.

async function me(req, res) {
  try {
    const [[user]] = await getPool().query(`
      SELECT u.*,
        COALESCE(p.first_name, d.first_name)   AS first_name,
        p.middle_name                           AS middle_name,
        COALESCE(p.last_name,  d.last_name)    AS last_name,
        p.second_last_name                      AS second_last_name,
        CONCAT_WS(' ',
          COALESCE(p.first_name, d.first_name),
          p.middle_name,
          COALESCE(p.last_name, d.last_name),
          p.second_last_name
        )                                       AS full_name
      FROM   users u
      LEFT JOIN patients p ON p.id = COALESCE(
                                u.patient_id,
                                (SELECT id FROM patients WHERE email = u.email LIMIT 1)
                              )
      LEFT JOIN doctors  d ON u.doctor_id = d.id
      WHERE  u.id = ?
    `, [req.user.id])

    if (!user) return res.status(404).json({ error: 'User not found.' })

    res.json({ user: buildPayload(user) })
  } catch (err) {
    console.error('[auth] me:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  patientRegister,
  login,
  requestOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  me,
}
