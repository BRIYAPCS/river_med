const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const {
  getMyPrescriptions,
  getPrescriptionsByPatient,
  createPrescription,
  requestRefill,
} = require('../controllers/prescriptionsController')

const router = Router()

// All prescription routes require authentication
router.use(verifyToken)

// /me must come before /:patientId to avoid being matched as a patient id
router.get('/me',          getMyPrescriptions)

// Backward-compatible: GET /api/prescriptions/:patientId
// Patient ownership enforced in controller
router.get('/:patientId',  getPrescriptionsByPatient)

// Doctor or admin only — doctor_id forced from JWT inside controller
router.post('/',           requireRole('doctor', 'admin'), createPrescription)

// Patient requests refill on one of their own prescriptions
router.post('/:id/refill', requireRole('patient'), requestRefill)

module.exports = router
