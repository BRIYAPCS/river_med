const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const {
  getMyRefillRequests,
  getPendingRefills,
  getRefillRequestsByPatient,
  updateRefillStatus,
  createRefillRequest,
} = require('../controllers/refillRequestsController')

const router = Router()

// All refill routes require authentication
router.use(verifyToken)

// ── specific string segments before :param routes ─────────────────────────────

// Role-aware: patient=own, doctor=their prescriptions, admin=all
router.get('/me',                   getMyRefillRequests)

// Doctor/admin — preserved exactly, required by existing dashboards
router.get('/pending',              requireRole('doctor', 'admin'), getPendingRefills)

// Backward-compatible — patient ownership enforced in controller
router.get('/patient/:patientId',   getRefillRequestsByPatient)

// ── write routes ──────────────────────────────────────────────────────────────

// Patient only — ownership + refill_allowed verified in controller
router.post('/',                    requireRole('patient'), createRefillRequest)

// Doctor (own prescriptions only) or admin
router.put('/:id/status',           requireRole('doctor', 'admin'), updateRefillStatus)

module.exports = router
