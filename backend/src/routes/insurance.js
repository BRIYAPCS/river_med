const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { getInsurance, upsertInsurance } = require('../controllers/insuranceController')

const router = Router()
router.use(verifyToken)

router.get('/',  getInsurance)
router.put('/',  upsertInsurance)

module.exports = router
