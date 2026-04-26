const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { getMessages, getThreads, getThread, sendMessage, markRead } = require('../controllers/messagesController')

const router = Router()

// All message routes require authentication
router.use(verifyToken)

// ── string segments before :param routes ─────────────────────────────────────

// Role-aware thread list: patient=own, doctor=assigned, admin=all
router.get('/threads',                           getThreads)

// Canonical new path — access enforced in controller
router.get('/thread/:patientId/:doctorId',       getThread)

// ── parameterised routes ──────────────────────────────────────────────────────

// Backward-compat alias for existing frontend/socket consumers
router.get('/:patient_id/:doctor_id',            getThread)

// Admin only — full message dump
router.get('/',                                  requireRole('admin'), getMessages)

// Patient or doctor only — sender_role derived from JWT, never body
router.post('/',                                 sendMessage)

// Receiver or admin marks a specific message as read
router.put('/:id/read',                          markRead)

module.exports = router
