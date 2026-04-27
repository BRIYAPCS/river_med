const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { getNotifications, markRead, markAllRead } = require('../controllers/notificationsController')

const router = Router()
router.use(verifyToken)

router.get('/',                 getNotifications)
router.put('/read-all',         markAllRead)
router.put('/:id/read',         markRead)

module.exports = router
