const { Router } = require('express')
const { getMessages, getThreads, getThread, sendMessage } = require('../controllers/messagesController')

const router = Router()

// ── specific string routes MUST come before parameterised routes ──────────────
router.get('/threads',                getThreads)
router.get('/:patient_id/:doctor_id', getThread)

router.get('/',  getMessages)
router.post('/', sendMessage)

module.exports = router
