const { Router } = require('express')
const { getPatients, getPatientById, createPatient } = require('../controllers/patientsController')

const router = Router()

router.get('/',    getPatients)
router.get('/:id', getPatientById)
router.post('/',   createPatient)

module.exports = router
