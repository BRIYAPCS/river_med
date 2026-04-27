import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getDocuments, uploadDocument, deleteDocument, documentDownloadUrl } from '../../services/api'

const CATEGORIES = ['lab_result','imaging','prescription','referral','insurance','other']

function fmtSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function fileIcon(mime) {
  if (mime?.includes('pdf'))   return '📄'
  if (mime?.includes('image')) return '🖼'
  if (mime?.includes('word'))  return '📝'
  return '📎'
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

function Toast({ msg, onDismiss }) {
  if (!msg) return null
  const isErr = msg.startsWith('Error')
  return (
    <div onClick={onDismiss}
      className="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: isErr ? '#dc2626' : '#059669' }}>
      {isErr ? '⚠ ' : '✓ '}{msg}
    </div>
  )
}

// ─── UploadForm ───────────────────────────────────────────────────────────────

function UploadForm({ patientId, onUploaded, onCancel }) {
  const [file,     setFile]     = useState(null)
  const [category, setCategory] = useState('other')
  const [desc,     setDesc]     = useState('')
  const [uploading,setUploading]= useState(false)
  const [error,    setError]    = useState(null)
  const inputRef = useRef()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('patient_id', patientId)
      fd.append('category', category)
      if (desc) fd.append('description', desc)
      const res = await uploadDocument(fd)
      onUploaded(res.document)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#f8fafc', fontSize: 14, color: 'var(--text-h)', outline: 'none' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: 4 }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

      <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>Upload Document</h3>

      {/* file drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-blue-400"
        style={{ borderColor: file ? 'var(--primary)' : 'var(--border)', background: '#f8fafc' }}>
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <span className="text-2xl">{file ? fileIcon(file.type) : '📁'}</span>
        {file ? (
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>{file.name}</p>
            <p className="text-xs" style={{ color: 'var(--text)' }}>{fmtSize(file.size)}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>Click to choose a file</p>
            <p className="text-xs" style={{ color: 'var(--text)' }}>PDF, JPG, PNG, WEBP, DOC — max 10 MB</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={lbl}>Category</label>
          <select style={inp} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Description (optional)</label>
          <input style={inp} placeholder="Brief note…" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</p>
      )}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel}
          className="px-5 py-2 rounded-xl text-sm font-semibold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!file || uploading}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: 'var(--primary)', opacity: (!file || uploading) ? 0.6 : 1 }}>
          {uploading ? <><Spinner /> Uploading…</> : '⬆ Upload'}
        </button>
      </div>
    </form>
  )
}

// ─── DocumentRow ──────────────────────────────────────────────────────────────

function DocumentRow({ doc, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const url = documentDownloadUrl(doc.id)

  async function handleDelete() {
    if (!confirm(`Delete "${doc.original_name}"?`)) return
    setDeleting(true)
    try { await deleteDocument(doc.id); onDelete(doc.id) }
    catch { setDeleting(false) }
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border hover:shadow-sm transition-all"
      style={{ borderColor: 'var(--border)' }}>
      <span className="text-2xl flex-shrink-0">{fileIcon(doc.mime_type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-h)' }}>{doc.original_name}</p>
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          {doc.category?.replace(/_/g, ' ')} · {fmtSize(doc.size_bytes)} · {fmtDate(doc.created_at)}
        </p>
        {doc.description && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text)' }}>{doc.description}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors hover:bg-blue-50"
          style={{ borderColor: 'var(--border)', color: 'var(--primary)', textDecoration: 'none' }}>
          Download
        </a>
        <button onClick={handleDelete} disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors hover:bg-red-50"
          style={{ borderColor: 'var(--border)', color: '#dc2626' }}>
          {deleting ? <Spinner /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}

// ─── PatientDocuments ─────────────────────────────────────────────────────────

export default function PatientDocuments() {
  const { user }          = useAuth()
  const patientId         = user?.patient_id
  const [docs,     setDocs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast,    setToast]    = useState(null)
  const [filter,   setFilter]   = useState('all')

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await getDocuments(patientId)
      setDocs(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [patientId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function handleUploaded(doc) {
    setDocs(prev => [doc, ...prev])
    setShowForm(false)
    setToast('Document uploaded.')
  }

  function handleDelete(id) {
    setDocs(prev => prev.filter(d => d.id !== id))
    setToast('Document deleted.')
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.category === filter)
  const usedCats = [...new Set(docs.map(d => d.category).filter(Boolean))]

  if (!patientId) return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="text-5xl opacity-20">📁</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>Account not linked to a patient record</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Toast msg={toast} onDismiss={() => setToast(null)} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Documents</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Lab results, prescriptions, insurance cards, and more</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}>
            + Upload
          </button>
        )}
      </div>

      {showForm && (
        <UploadForm patientId={patientId} onUploaded={handleUploaded} onCancel={() => setShowForm(false)} />
      )}

      {/* category filter */}
      {docs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {['all', ...usedCats].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-all"
              style={{
                borderColor: filter === cat ? 'var(--primary)' : 'var(--border)',
                background:  filter === cat ? 'rgba(30,58,138,0.08)' : '#fff',
                color:       filter === cat ? 'var(--primary)' : 'var(--text)',
              }}>
              {cat === 'all' ? `All (${docs.length})` : cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text)' }}>
          <Spinner /> Loading documents…
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl opacity-20">📁</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No documents yet</p>
          <p className="text-xs" style={{ color: 'var(--text)' }}>Upload lab results, referral letters, or insurance cards</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map(doc => (
            <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {!loading && filter !== 'all' && filtered.length === 0 && docs.length > 0 && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--text)' }}>
          No documents in this category
        </p>
      )}
    </div>
  )
}
