const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const {
  patientRegister,
  login,
  requestOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  me,
} = require('../controllers/authController')

const router = Router()

// ── public ────────────────────────────────────────────────────────────────────
// /register is the canonical public endpoint (defaults to patient role).
// /patient/register is kept as an alias for backward compatibility.
router.post('/register',         patientRegister)
router.post('/patient/register', patientRegister)
router.post('/login',            login)
router.post('/request-otp',      requestOtp)
router.post('/verify-otp',       verifyOtp)
router.post('/forgot-password',  forgotPassword)
router.post('/reset-password',   resetPassword)

// ── protected ─────────────────────────────────────────────────────────────────
router.get('/me', verifyToken, me)

module.exports = router
