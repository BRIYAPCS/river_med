const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const {
  getAppointments,
  getMyAppointments,
  getTodayAppointments,
  getPatientAppointments,
  createAppointment,
  updateAppointmentStatus,
  assignDoctor,
  updateAppointment,
  deleteAppointment,
} = require('../controllers/appointmentsController')

const router = Router()

// All appointment routes require a valid JWT.
router.use(verifyToken)

// ── specific string segments first (before any :param routes) ─────────────────

// Role-aware: patient=own, doctor=assigned, admin=all
router.get('/me',                  getMyAppointments)

// Admin + doctor queue views
router.get('/today',               requireRole('admin', 'doctor'), getTodayAppointments)

// Patient ownership enforced inside controller
router.get('/patient/:patientId',  getPatientAppointments)

// Admin + doctor: full list
router.get('/',                    requireRole('admin', 'doctor'), getAppointments)

// ── write routes ──────────────────────────────────────────────────────────────

// Patient creates for self; admin creates for anyone
router.post('/',                   createAppointment)

// Doctor/admin only — doctor further restricted to own appointments in controller
router.put('/:id/status',          requireRole('doctor', 'admin'), updateAppointmentStatus)

// Admin only — assign or re-assign doctor
router.put('/:id/assign',          requireRole('admin'), assignDoctor)

// Admin only — full field update
router.put('/:id',                 requireRole('admin'), updateAppointment)

// Patient = soft-cancel own waiting appointment
// Admin   = hard delete
// Doctor  = 403 (use PUT /:id/status to set cancelled instead)
router.delete('/:id',              deleteAppointment)

module.exports = router
