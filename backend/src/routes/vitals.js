const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { getVitals, recordVitals }  = require('../controllers/vitalsController')

const router = Router()
router.use(verifyToken)

// Nested under /api/appointments/:id/vitals — mounted in app.js
router.get('/',  getVitals)
router.post('/', requireRole('doctor', 'admin'), recordVitals)

module.exports = router
