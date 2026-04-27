const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const { upload, getDocuments, uploadDocument, downloadDocument, deleteDocument } = require('../controllers/documentsController')

const router = Router()
router.use(verifyToken)

router.get('/',              getDocuments)
router.post('/',             upload.single('file'), uploadDocument)
router.get('/:id/download',  downloadDocument)
router.delete('/:id',        deleteDocument)

module.exports = router
