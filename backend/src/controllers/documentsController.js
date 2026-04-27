const path   = require('path')
const fs     = require('fs')
const multer = require('multer')
const { getPool } = require('../db/connection')

// ── upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// ── multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB
  fileFilter: (_req, file, cb) => {
    ALLOWED_TYPES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`File type "${file.mimetype}" is not allowed.`))
  },
})

// ─── GET /api/documents?patient_id=X ─────────────────────────────────────────
async function getDocuments(req, res) {
  const { role, patient_id: jwtPid } = req.user
  const pid = role === 'patient' ? jwtPid : (req.query.patient_id ?? null)

  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (role === 'patient' && Number(pid) !== Number(jwtPid)) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  const apptId = req.query.appointment_id ?? null

  try {
    let query = 'SELECT * FROM documents WHERE patient_id = ?'
    const params = [pid]
    if (apptId) { query += ' AND appointment_id = ?'; params.push(apptId) }
    query += ' ORDER BY created_at DESC'

    const [rows] = await getPool().query(query, params)
    res.json(rows)
  } catch (err) {
    console.error('[documents] getDocuments:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── POST /api/documents ──────────────────────────────────────────────────────
async function uploadDocument(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

  const { role, id: userId, patient_id: jwtPid } = req.user
  const pid    = role === 'patient' ? jwtPid : (req.body.patient_id ?? null)
  const apptId = req.body.appointment_id ?? null
  const { category = 'other', description } = req.body

  if (!pid) return res.status(400).json({ error: 'patient_id is required.' })
  if (role === 'patient' && Number(pid) !== Number(jwtPid)) {
    fs.unlinkSync(req.file.path)
    return res.status(403).json({ error: 'Access denied.' })
  }

  try {
    const [result] = await getPool().query(
      `INSERT INTO documents
         (patient_id, appointment_id, uploaded_by, filename, original_name,
          mime_type, size_bytes, storage_path, category, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pid, apptId ?? null, userId,
        req.file.filename, req.file.originalname,
        req.file.mimetype, req.file.size, req.file.path,
        category, description ?? null,
      ]
    )
    const [[saved]] = await getPool().query('SELECT * FROM documents WHERE id = ?', [result.insertId])
    res.status(201).json({ message: 'Document uploaded.', document: saved })
  } catch (err) {
    fs.unlinkSync(req.file.path)
    console.error('[documents] uploadDocument:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── GET /api/documents/:id/download ─────────────────────────────────────────
async function downloadDocument(req, res) {
  const { id } = req.params
  const { role, patient_id } = req.user
  try {
    const [[doc]] = await getPool().query('SELECT * FROM documents WHERE id = ?', [id])
    if (!doc) return res.status(404).json({ error: 'Document not found.' })

    if (role === 'patient' && Number(doc.patient_id) !== Number(patient_id)) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    if (!fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ error: 'File not found on server.' })
    }

    res.download(doc.storage_path, doc.original_name)
  } catch (err) {
    console.error('[documents] downloadDocument:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
async function deleteDocument(req, res) {
  const { id } = req.params
  const { role, patient_id, id: userId } = req.user
  try {
    const pool = getPool()
    const [[doc]] = await pool.query('SELECT * FROM documents WHERE id = ?', [id])
    if (!doc) return res.status(404).json({ error: 'Document not found.' })

    if (role === 'patient' && Number(doc.patient_id) !== Number(patient_id)) {
      return res.status(403).json({ error: 'Access denied.' })
    }
    if (role === 'doctor' && Number(doc.uploaded_by) !== Number(userId)) {
      return res.status(403).json({ error: 'You can only delete documents you uploaded.' })
    }

    if (fs.existsSync(doc.storage_path)) fs.unlinkSync(doc.storage_path)
    await pool.query('DELETE FROM documents WHERE id = ?', [id])
    res.json({ message: 'Document deleted.' })
  } catch (err) {
    console.error('[documents] deleteDocument:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { upload, getDocuments, uploadDocument, downloadDocument, deleteDocument }
