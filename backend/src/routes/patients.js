const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { getPatients, getPatientById, createPatient, getMyPatient, updateMyPatient } = require('../controllers/patientsController')

const router = Router()

router.get('/me',  verifyToken, getMyPatient)
router.put('/me',  verifyToken, updateMyPatient)

router.get('/',    getPatients)
router.get('/:id', getPatientById)
router.post('/',   createPatient)

module.exports = router
