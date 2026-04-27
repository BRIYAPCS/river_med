const { Router } = require('express')
const { verifyToken, requireRole } = require('../middleware/authMiddleware')
const { getInvoices, createInvoice, updateInvoice, deleteInvoice } = require('../controllers/invoicesController')

const router = Router()
router.use(verifyToken)

router.get('/',    getInvoices)
router.post('/',   requireRole('admin'), createInvoice)
router.put('/:id', requireRole('admin'), updateInvoice)
router.delete('/:id', requireRole('admin'), deleteInvoice)

module.exports = router
