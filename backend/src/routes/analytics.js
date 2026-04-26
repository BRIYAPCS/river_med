const { Router } = require('express')
const {
  getAnalytics,
  getAppointmentsPerDay,
  getTopMedications,
  getDoctorLoad,
} = require('../controllers/analyticsController')

const router = Router()

router.get('/',                    getAnalytics)
router.get('/appointments-per-day', getAppointmentsPerDay)
router.get('/top-medications',      getTopMedications)
router.get('/doctor-load',          getDoctorLoad)

module.exports = router
