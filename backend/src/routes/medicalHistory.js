const { Router } = require('express')
const { verifyToken } = require('../middleware/authMiddleware')
const {
  getAllergies,   createAllergy,   updateAllergy,   deleteAllergy,
  getConditions, createCondition, updateCondition, deleteCondition,
  getMedications,createMedication,updateMedication,deleteMedication,
} = require('../controllers/medicalHistoryController')

const router = Router()
router.use(verifyToken)

// ── allergies ─────────────────────────────────────────────────────────────────
router.get('/allergies',          getAllergies)
router.post('/allergies',         createAllergy)
router.put('/allergies/:id',      updateAllergy)
router.delete('/allergies/:id',   deleteAllergy)

// ── conditions ────────────────────────────────────────────────────────────────
router.get('/conditions',         getConditions)
router.post('/conditions',        createCondition)
router.put('/conditions/:id',     updateCondition)
router.delete('/conditions/:id',  deleteCondition)

// ── current medications ───────────────────────────────────────────────────────
router.get('/medications',        getMedications)
router.post('/medications',       createMedication)
router.put('/medications/:id',    updateMedication)
router.delete('/medications/:id', deleteMedication)

module.exports = router
