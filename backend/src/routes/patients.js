const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { getPatients, getPatientById, createPatient, getMyPatient } = require('../controllers/patientsController')

const router = Router()

// /me must be declared before /:id — otherwise Express matches "me" as an id value.
router.get('/me', verifyToken, getMyPatient)

router.get('/',    getPatients)
router.get('/:id', getPatientById)
router.post('/',   createPatient)

module.exports = router
