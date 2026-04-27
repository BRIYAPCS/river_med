const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { getReferrals, createReferral, updateReferralStatus } = require('../controllers/referralsController')

const router = Router()
router.use(verifyToken)

router.get('/',           getReferrals)
router.post('/',          createReferral)
router.put('/:id/status', updateReferralStatus)

module.exports = router
