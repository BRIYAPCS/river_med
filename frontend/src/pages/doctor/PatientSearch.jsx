import { useState, useCallback } from 'react'
import { getPatients, getPatientAppointments, getMyPrescriptions } from '../../services/api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

const BLOOD_COLOR = {
  'A+': '#6366f1','A-': '#8b5cf6','B+': '#0d9488','B-': '#14b8a6',
  'O+': '#f59e0b','O-': '#d97706','AB+': '#3b82f6','AB-': '#2563eb',
}

function PatientCard({ patient, onSelect, selected }) {
  const initials = [patient.first_name?.[0], patient.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const btColor  = BLOOD_COLOR[patient.blood_type] ?? '#6b7280'
  const patientAge = age(patient.date_of_birth)

  return (
    <div
      onClick={() => onSelect(patient)}
      className="bg-white rounded-2xl border p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md"
      style={{
        borderColor: selected ? '#0d9488' : 'var(--border)',
        boxShadow: selected ? '0 0 0 2px rgba(13,148,136,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
        style={{ background: '#0d9488' }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate" style={{ color: 'var(--text-h)' }}>
          {[patient.first_name, patient.last_name].filter(Boolean).join(' ') || '(no name)'}
        </div>
        <div className="text-xs" style={{ color: 'var(--text)' }}>
          {patient.email ?? '—'}
          {patientAge ? ` · Age ${patientAge}` : ''}
          {patient.phone ? ` · ${patient.phone}` : ''}
        </div>
      </div>
      {patient.blood_type && (
        <span className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: btColor + '18', color: btColor }}>
          {patient.blood_type}
        </span>
      )}
    </div>
  )
}

function PatientDetail({ patient, onClose }) {
  const patientAge = age(patient.date_of_birth)

  return (
    <div className="bg-white rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: '#0d9488', boxShadow: '0 2px 8px rgba(13,148,136,0.10)' }}>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{ background: '#0d9488' }}>
            {[patient.first_name?.[0], patient.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>
              {[patient.first_name, patient.middle_name, patient.last_name, patient.second_last_name].filter(Boolean).join(' ') || '(no name)'}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text)' }}>
              Patient #{patient.id}{patientAge ? ` · ${patientAge} years old` : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          ['Email',      patient.email],
          ['Phone',      patient.phone],
          ['DOB',        fmtDate(patient.date_of_birth)],
          ['Blood Type', patient.blood_type],
          ['Member Since', fmtDate(patient.created_at)],
        ].filter(([,v]) => v && v !== '—').map(([lbl, val]) => (
          <div key={lbl}>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{lbl}</dt>
            <dd className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-h)' }}>{val}</dd>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DoctorPatientSearch() {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(null)
  const [error,    setError]    = useState(null)

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); setSelected(null); return }
    setLoading(true); setError(null)
    try {
      const all = await getPatients()
      const lq  = q.toLowerCase()
      const matched = all.filter(p =>
        [p.first_name, p.last_name, p.middle_name, p.email, p.phone]
          .some(v => v?.toLowerCase().includes(lq))
      )
      setResults(matched)
      if (selected && !matched.find(p => p.id === selected.id)) setSelected(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selected])

  function handleChange(e) {
    const v = e.target.value
    setQuery(v)
    clearTimeout(window._searchTimer)
    window._searchTimer = setTimeout(() => search(v), 350)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Find Patient</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
          Search by name, email, or phone number
        </p>
      </div>

      {/* search box */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text)', pointerEvents: 'none' }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search patients…"
          autoFocus
          style={{
            width: '100%', padding: '12px 14px 12px 42px', borderRadius: 14,
            border: '1.5px solid var(--border)', background: '#fff',
            fontSize: 14, color: 'var(--text-h)', outline: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text)' }}>
            <Spinner />
          </span>
        )}
      </div>

      {error && (
        <div className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* selected patient detail */}
      {selected && (
        <PatientDetail patient={selected} onClose={() => setSelected(null)} />
      )}

      {/* results */}
      {results !== null && (
        <>
          {results.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text)' }}>
              <span className="text-4xl opacity-20 block mb-3">🔍</span>
              <p className="text-sm font-medium">No patients found for "{query}"</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {results.length} patient{results.length !== 1 ? 's' : ''} found
              </p>
              {results.map(p => (
                <PatientCard key={p.id} patient={p}
                  selected={selected?.id === p.id}
                  onSelect={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      {results === null && !loading && (
        <div className="text-center py-16" style={{ color: 'var(--text)' }}>
          <span className="text-5xl opacity-15 block mb-4">🔍</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>Start typing to search patients</p>
          <p className="text-xs mt-1">Search by first/last name, email, or phone</p>
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
