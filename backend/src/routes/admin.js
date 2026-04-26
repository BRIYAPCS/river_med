const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { createStaffUser, verifyUser, listUsers, updateUser, toggleUserStatus } = require('../controllers/adminController')

const router = Router()

// All admin routes require a valid JWT + admin role.
router.use(verifyToken, requireRole('admin'))

router.get('/users',                listUsers)
router.post('/users',               createStaffUser)
router.put('/users/:id',            updateUser)
router.put('/users/:id/verify',     verifyUser)
router.put('/users/:id/status',     toggleUserStatus)

module.exports = router
