import { useState, useEffect, useCallback } from 'react'
import {
  getAllergies,    createAllergy,    updateAllergy,    deleteAllergy,
  getConditions,  createCondition,  updateCondition,  deleteCondition,
  getMedications, createMedication, updateMedication, deleteMedication,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// ─── shared styles ────────────────────────────────────────────────────────────

const inp = {
  width: '100%', padding: '8px 11px', borderRadius: 9,
  border: '1px solid var(--border)', background: '#f8fafc',
  fontSize: 13, color: 'var(--text-h)', outline: 'none',
}
const lbl = {
  display: 'block', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 3,
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

function Tag({ children, color = '#6b7280', bg }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ color, background: bg ?? color + '18' }}>
      {children}
    </span>
  )
}

const SEVERITY_META = {
  mild:     { color: '#d97706', label: 'Mild' },
  moderate: { color: '#ea580c', label: 'Moderate' },
  severe:   { color: '#dc2626', label: 'Severe' },
}
const CONDITION_META = {
  active:   { color: '#dc2626', label: 'Active' },
  chronic:  { color: '#d97706', label: 'Chronic' },
  resolved: { color: '#059669', label: 'Resolved' },
}

// ─── generic section shell ────────────────────────────────────────────────────

function Section({ title, count, accent = '#0d9488', children, onAdd, canEdit }) {
  return (
    <div className="bg-white rounded-2xl border" style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>{title}</h3>
          {count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: accent }}>{count}</span>
          )}
        </div>
        {canEdit && onAdd && (
          <button onClick={onAdd}
            className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: accent + '18', color: accent }}>
            + Add
          </button>
        )}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {children}
      </div>
    </div>
  )
}

// ─── ALLERGIES ─────────────────────────────────────────────────────────────────

function AllergyForm({ initial, patientId, onSave, onCancel }) {
  const [form, setForm] = useState({
    allergen:   initial?.allergen  ?? '',
    severity:   initial?.severity  ?? 'mild',
    reaction:   initial?.reaction  ?? '',
    notes:      initial?.notes     ?? '',
    patient_id: patientId,
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, reaction: form.reaction || null, notes: form.notes || null }
      const result = initial
        ? await updateAllergy(initial.id, data)
        : await createAllergy(data)
      onSave(result)
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={lbl}>Allergen *</label>
          <input style={inp} required value={form.allergen} onChange={e => set('allergen', e.target.value)} placeholder="Penicillin, Pollen…" />
        </div>
        <div>
          <label style={lbl}>Severity</label>
          <select style={inp} value={form.severity} onChange={e => set('severity', e.target.value)}>
            {Object.entries(SEVERITY_META).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={lbl}>Reaction</label>
        <input style={inp} value={form.reaction} onChange={e => set('reaction', e.target.value)} placeholder="Hives, anaphylaxis…" />
      </div>
      <div>
        <label style={lbl}>Notes</label>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-bold text-white"
          style={{ background: '#dc2626', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Save'}
        </button>
      </div>
    </form>
  )
}

function AllergyRow({ item, canEdit, onEdit, onDelete }) {
  const { color, label } = SEVERITY_META[item.severity] ?? SEVERITY_META.mild
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>{item.allergen}</span>
          <Tag color={color}>{label}</Tag>
        </div>
        {item.reaction && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{item.reaction}</p>}
        {item.notes    && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text)' }}>{item.notes}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(item)} className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text)' }}>Edit</button>
          <button onClick={() => onDelete(item.id)} className="text-xs px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: '#dc2626' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── CONDITIONS ───────────────────────────────────────────────────────────────

function ConditionForm({ initial, patientId, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '', status: initial?.status ?? 'active',
    diagnosed_at: initial?.diagnosed_at?.slice(0,10) ?? '', notes: initial?.notes ?? '',
    patient_id: patientId,
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, diagnosed_at: form.diagnosed_at || null, notes: form.notes || null }
      const result = initial ? await updateCondition(initial.id, data) : await createCondition(data)
      onSave(result)
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={lbl}>Condition *</label>
          <input style={inp} required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Hypertension, Diabetes…" />
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(CONDITION_META).map(([k,{label}]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Diagnosed</label>
          <input type="date" style={inp} value={form.diagnosed_at} onChange={e => set('diagnosed_at', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={lbl}>Notes</label>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-bold text-white"
          style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Save'}
        </button>
      </div>
    </form>
  )
}

function ConditionRow({ item, canEdit, onEdit, onDelete }) {
  const { color, label } = CONDITION_META[item.status] ?? CONDITION_META.active
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-h)' }}>{item.name}</span>
          <Tag color={color}>{label}</Tag>
          {item.diagnosed_at && <span className="text-xs" style={{ color: 'var(--text)' }}>Since {item.diagnosed_at?.slice(0,10)}</span>}
        </div>
        {item.notes && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text)' }}>{item.notes}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(item)} className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text)' }}>Edit</button>
          <button onClick={() => onDelete(item.id)} className="text-xs px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: '#dc2626' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── CURRENT MEDICATIONS ──────────────────────────────────────────────────────

function MedicationForm({ initial, patientId, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '', dosage: initial?.dosage ?? '',
    frequency: initial?.frequency ?? '', started_at: initial?.started_at?.slice(0,10) ?? '',
    notes: initial?.notes ?? '', patient_id: patientId,
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...form,
        dosage: form.dosage || null, frequency: form.frequency || null,
        started_at: form.started_at || null, notes: form.notes || null,
      }
      const result = initial ? await updateMedication(initial.id, data) : await createMedication(data)
      onSave(result)
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={lbl}>Medication *</label>
          <input style={inp} required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Metformin…" />
        </div>
        <div>
          <label style={lbl}>Dosage</label>
          <input style={inp} value={form.dosage} onChange={e => set('dosage', e.target.value)} placeholder="500mg" />
        </div>
        <div>
          <label style={lbl}>Frequency</label>
          <input style={inp} value={form.frequency} onChange={e => set('frequency', e.target.value)} placeholder="Twice daily" />
        </div>
        <div>
          <label style={lbl}>Started</label>
          <input type="date" style={inp} value={form.started_at} onChange={e => set('started_at', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={lbl}>Notes</label>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-bold text-white"
          style={{ background: '#6366f1', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Save'}
        </button>
      </div>
    </form>
  )
}

function MedicationRow({ item, canEdit, onEdit, onDelete, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: item.is_active ? 'var(--text-h)' : 'var(--text)', textDecoration: item.is_active ? 'none' : 'line-through' }}>{item.name}</span>
          {item.dosage    && <span className="text-xs" style={{ color: 'var(--text)' }}>{item.dosage}</span>}
          {item.frequency && <span className="text-xs" style={{ color: 'var(--text)' }}>· {item.frequency}</span>}
          {!item.is_active && <Tag color="#6b7280">Inactive</Tag>}
        </div>
        {item.notes && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text)' }}>{item.notes}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onToggle(item)} className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100"
            style={{ color: item.is_active ? '#d97706' : '#059669' }}>
            {item.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => onEdit(item)} className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text)' }}>Edit</button>
          <button onClick={() => onDelete(item.id)} className="text-xs px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: '#dc2626' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── MedicalHistory ───────────────────────────────────────────────────────────
// patientIdOverride: passed by doctor to view a specific patient's history.
// When undefined the logged-in patient's own records are shown.

export default function MedicalHistory({ patientIdOverride }) {
  const { user }   = useAuth()
  const canEdit    = !patientIdOverride || user?.role === 'doctor' || user?.role === 'admin'
  const patientId  = patientIdOverride ?? user?.patient_id ?? null

  const [allergies,   setAllergies]   = useState([])
  const [conditions,  setConditions]  = useState([])
  const [medications, setMedications] = useState([])
  const [loading,     setLoading]     = useState(true)

  const [addAllergy,   setAddAllergy]   = useState(false)
  const [editAllergy,  setEditAllergy]  = useState(null)
  const [addCondition, setAddCondition] = useState(false)
  const [editCondition,setEditCondition]= useState(null)
  const [addMed,       setAddMed]       = useState(false)
  const [editMed,      setEditMed]      = useState(null)

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return }
    setLoading(true)
    try {
      const [a, c, m] = await Promise.all([
        getAllergies(patientId),
        getConditions(patientId),
        getMedications(patientId),
      ])
      setAllergies(a)
      setConditions(c)
      setMedications(m)
    } catch (err) {
      console.error('[MedicalHistory] load error:', err.message)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  // ── allergy handlers ────────────────────────────────────────────────────────
  function handleAllergySaved(item) {
    setAllergies(prev => {
      const idx = prev.findIndex(a => a.id === item.id)
      return idx >= 0 ? prev.map(a => a.id === item.id ? item : a) : [item, ...prev]
    })
    setAddAllergy(false); setEditAllergy(null)
  }
  async function handleDeleteAllergy(id) {
    if (!confirm('Remove this allergy?')) return
    await deleteAllergy(id)
    setAllergies(prev => prev.filter(a => a.id !== id))
  }

  // ── condition handlers ──────────────────────────────────────────────────────
  function handleConditionSaved(item) {
    setConditions(prev => {
      const idx = prev.findIndex(c => c.id === item.id)
      return idx >= 0 ? prev.map(c => c.id === item.id ? item : c) : [item, ...prev]
    })
    setAddCondition(false); setEditCondition(null)
  }
  async function handleDeleteCondition(id) {
    if (!confirm('Remove this condition?')) return
    await deleteCondition(id)
    setConditions(prev => prev.filter(c => c.id !== id))
  }

  // ── medication handlers ─────────────────────────────────────────────────────
  function handleMedSaved(item) {
    setMedications(prev => {
      const idx = prev.findIndex(m => m.id === item.id)
      return idx >= 0 ? prev.map(m => m.id === item.id ? item : m) : [item, ...prev]
    })
    setAddMed(false); setEditMed(null)
  }
  async function handleDeleteMed(id) {
    if (!confirm('Remove this medication?')) return
    await deleteMedication(id)
    setMedications(prev => prev.filter(m => m.id !== id))
  }
  async function handleToggleMed(item) {
    const updated = await updateMedication(item.id, { is_active: !item.is_active })
    setMedications(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  if (!patientId) return (
    <div className="text-center py-12" style={{ color: 'var(--text)' }}>No patient profile linked.</div>
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Medical History</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Allergies, conditions and current medications</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--text)' }}>
          <Spinner /> Loading…
        </div>
      ) : (
        <>
          {/* ── Allergies ── */}
          <Section title="Allergies" count={allergies.length} accent="#dc2626" canEdit={canEdit}
            onAdd={() => { setAddAllergy(true); setEditAllergy(null) }}>
            {addAllergy && (
              <AllergyForm patientId={patientId} onSave={handleAllergySaved} onCancel={() => setAddAllergy(false)} />
            )}
            {allergies.length === 0 && !addAllergy && (
              <p className="px-5 py-4 text-sm" style={{ color: 'var(--text)' }}>No known allergies recorded.</p>
            )}
            {allergies.map(item => editAllergy?.id === item.id ? (
              <AllergyForm key={item.id} initial={item} patientId={patientId}
                onSave={handleAllergySaved} onCancel={() => setEditAllergy(null)} />
            ) : (
              <AllergyRow key={item.id} item={item} canEdit={canEdit}
                onEdit={setEditAllergy} onDelete={handleDeleteAllergy} />
            ))}
          </Section>

          {/* ── Conditions ── */}
          <Section title="Medical Conditions" count={conditions.length} accent="#d97706" canEdit={canEdit}
            onAdd={() => { setAddCondition(true); setEditCondition(null) }}>
            {addCondition && (
              <ConditionForm patientId={patientId} onSave={handleConditionSaved} onCancel={() => setAddCondition(false)} />
            )}
            {conditions.length === 0 && !addCondition && (
              <p className="px-5 py-4 text-sm" style={{ color: 'var(--text)' }}>No conditions on record.</p>
            )}
            {conditions.map(item => editCondition?.id === item.id ? (
              <ConditionForm key={item.id} initial={item} patientId={patientId}
                onSave={handleConditionSaved} onCancel={() => setEditCondition(null)} />
            ) : (
              <ConditionRow key={item.id} item={item} canEdit={canEdit}
                onEdit={setEditCondition} onDelete={handleDeleteCondition} />
            ))}
          </Section>

          {/* ── Current Medications ── */}
          <Section title="Current Medications" count={medications.filter(m => m.is_active).length} accent="#6366f1" canEdit={canEdit}
            onAdd={() => { setAddMed(true); setEditMed(null) }}>
            {addMed && (
              <MedicationForm patientId={patientId} onSave={handleMedSaved} onCancel={() => setAddMed(false)} />
            )}
            {medications.length === 0 && !addMed && (
              <p className="px-5 py-4 text-sm" style={{ color: 'var(--text)' }}>No current medications listed.</p>
            )}
            {medications.map(item => editMed?.id === item.id ? (
              <MedicationForm key={item.id} initial={item} patientId={patientId}
                onSave={handleMedSaved} onCancel={() => setEditMed(null)} />
            ) : (
              <MedicationRow key={item.id} item={item} canEdit={canEdit}
                onEdit={setEditMed} onDelete={handleDeleteMed} onToggle={handleToggleMed} />
            ))}
          </Section>
        </>
      )}
    </div>
  )
}
