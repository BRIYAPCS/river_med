const { Router } = require('express')
const {
  getAppointments,
  getTodayAppointments,
  getPatientAppointments,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  createAppointment,
} = require('../controllers/appointmentsController')

const router = Router()

// Specific string routes MUST come before parameterised routes
router.get('/today',              getTodayAppointments)
router.get('/patient/:patientId', getPatientAppointments)

router.get('/',             getAppointments)
router.post('/',            createAppointment)
router.put('/:id/status',   updateAppointmentStatus)
router.put('/:id',          updateAppointment)
router.delete('/:id',       deleteAppointment)

module.exports = router
