const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { exportAppointments, exportPatients, exportPrescriptions, exportRevenue } = require('../controllers/reportsController')

const router = Router()
router.use(verifyToken)
router.use(requireRole('admin'))

router.get('/appointments',  exportAppointments)
router.get('/patients',      exportPatients)
router.get('/prescriptions', exportPrescriptions)
router.get('/revenue',       exportRevenue)

module.exports = router
