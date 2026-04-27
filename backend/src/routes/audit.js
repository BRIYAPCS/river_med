const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { getAuditLog } = require('../controllers/auditController')

const router = Router()
router.use(verifyToken)
router.use(requireRole('admin'))

router.get('/', getAuditLog)

module.exports = router
