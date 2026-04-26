const { Router } = require('express')
const { getDoctors, createDoctor } = require('../controllers/doctorsController')

const router = Router()

router.get('/',  getDoctors)
router.post('/', createDoctor)

module.exports = router
