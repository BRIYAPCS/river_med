const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const {
  getPendingRefills,
  getRefillRequestsByPatient,
  updateRefillStatus,
  createRefillRequest,
} = require('../controllers/refillRequestsController')

const router = Router()

// Doctor/admin: view all pending + action them
router.get('/pending',            verifyToken, requireRole('doctor', 'admin'), getPendingRefills)
router.put('/:id/status',         verifyToken, requireRole('doctor', 'admin'), updateRefillStatus)

// Patient: view own requests + submit new ones
router.get('/patient/:patientId', verifyToken, getRefillRequestsByPatient)
router.post('/',                  verifyToken, createRefillRequest)

module.exports = router
