const jwt = require('jsonwebtoken')

// ─── verifyToken ──────────────────────────────────────────────────────────────
// Extracts and validates the Bearer token.
// On success: attaches decoded payload to req.user and calls next().
// On failure: returns 401.

function verifyToken(req, res, next) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' })
  }

  const token = header.slice(7)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // Expose all fields the controllers need — keep this in sync with buildPayload()
    req.user = {
      id:               decoded.id,
      email:            decoded.email            ?? null,
      phone:            decoded.phone            ?? null,
      role:             decoded.role,
      patient_id:       decoded.patient_id       ?? null,
      doctor_id:        decoded.doctor_id        ?? null,
      is_verified:      decoded.is_verified      ?? false,
      first_name:       decoded.first_name       ?? null,
      middle_name:      decoded.middle_name      ?? null,
      last_name:        decoded.last_name        ?? null,
      second_last_name: decoded.second_last_name ?? null,
      full_name:        decoded.full_name        ?? null,
    }
    next()
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token has expired — please log in again'
      : 'Invalid token'
    return res.status(401).json({ error: message })
  }
}

// ─── requireRole ─────────────────────────────────────────────────────────────
// Factory that returns middleware enforcing one or more allowed roles.
// Must be used AFTER verifyToken.
//
// Usage:
//   router.post('/', verifyToken, requireRole('doctor'), handler)
//   router.put('/:id/status', verifyToken, requireRole('doctor', 'admin'), handler)

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. This action requires role: ${roles.join(' or ')}`,
      })
    }
    next()
  }
}

module.exports = { verifyToken, requireRole }
