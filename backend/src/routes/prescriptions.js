const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const {
  getPrescriptionsByPatient,
  createPrescription,
  requestRefill,
} = require('../controllers/prescriptionsController')

const router = Router()

// Read: any authenticated user (patient reads their own, doctor reads their patients')
router.get('/:patientId',  verifyToken, getPrescriptionsByPatient)

// Write: doctors only
router.post('/',           verifyToken, requireRole('doctor'), createPrescription)

// Refill via prescriptions route: any authenticated user (patient requests)
router.post('/:id/refill', verifyToken, requestRefill)

module.exports = router
