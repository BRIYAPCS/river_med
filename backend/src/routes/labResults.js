const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { getLabResults, createLabResult, updateLabResult, deleteLabResult } = require('../controllers/labResultsController')

const router = Router()
router.use(verifyToken)

router.get('/',    getLabResults)
router.post('/',   createLabResult)
router.put('/:id', updateLabResult)
router.delete('/:id', deleteLabResult)

module.exports = router
