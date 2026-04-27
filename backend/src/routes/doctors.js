const { Router } = require('express')
const { getDoctors, createDoctor, getMyDoctor, updateMyDoctor, getMyAvailability, setMyAvailability, getDoctorAvailability } = require('../controllers/doctorsController')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')

const router = Router()

// public
router.get('/',                      getDoctors)
router.get('/:id/availability',      getDoctorAvailability)

// doctor-only profile management
router.get('/me',                    verifyToken, requireRole('doctor'), getMyDoctor)
router.put('/me',                    verifyToken, requireRole('doctor'), updateMyDoctor)
router.get('/me/availability',       verifyToken, requireRole('doctor'), getMyAvailability)
router.put('/me/availability',       verifyToken, requireRole('doctor'), setMyAvailability)

router.post('/',                     createDoctor)

module.exports = router
