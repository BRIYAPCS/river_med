const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { createStaffUser, verifyUser } = require('../controllers/adminController')

const router = Router()

// All admin routes require a valid JWT + admin role.
router.use(verifyToken, requireRole('admin'))

router.post('/users',           createStaffUser)
router.put('/users/:id/verify', verifyUser)

module.exports = router
