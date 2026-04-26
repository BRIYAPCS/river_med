import { useState, useEffect, useCallback } from 'react'
import { getPatients, getDoctors, adminCreateStaff, adminListUsers, adminUpdateUser, adminToggleUserStatus, adminVerifyUser } from '../../services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── micro components ─────────────────────────────────────────────────────────

function Spinner({ size = 4 }) {
  return (
    <svg className={`animate-spin w-${size} h-${size} flex-shrink-0`} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  return (
    <div onClick={onDismiss}
      className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: type === 'error' ? '#dc2626' : '#059669', maxWidth: 340 }}>
      <span>{type === 'error' ? '⚠' : '✓'}</span><span>{message}</span>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 14px', borderRadius: 12,
  border: '1px solid var(--border)', color: 'var(--text-h)',
  background: '#fff', fontSize: 14, outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 6,
}

// ─── PatientDetailPanel ───────────────────────────────────────────────────────

function PatientDetailPanel({ patient, onClose }) {
  if (!patient) return null
  const name = [patient.first_name, patient.middle_name, patient.last_name, patient.second_last_name]
    .filter(Boolean).join(' ')
  const ini = initials(name || patient.email)

  return (
    <div className="fixed inset-0 z-40 flex" style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ml-auto w-full max-w-sm bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-h)' }}>Patient Record</h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--text)' }}>×</button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          {/* avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: '#6366f1' }}>
              {ini}
            </div>
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--text-h)' }}>{name || '—'}</p>
              <p className="text-xs" style={{ color: 'var(--text)' }}>Patient #{patient.id}</p>
            </div>
            {patient.blood_type && (
              <span className="ml-auto text-sm font-bold px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}>
                {patient.blood_type}
              </span>
            )}
          </div>

          {/* info grid */}
          <div className="grid grid-cols-1 gap-4">
            {[
              { label: 'Email',         value: patient.email },
              { label: 'Phone',         value: patient.phone },
              { label: 'Date of Birth', value: fmtDate(patient.date_of_birth) },
              { label: 'Member Since',  value: fmtDate(patient.created_at) },
            ].map(({ label, value }) => value && value !== '—' ? (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text)' }}>
                  {label}
                </p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{value}</p>
              </div>
            ) : null)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CreateDoctorForm ─────────────────────────────────────────────────────────

function CreateDoctorForm({ onSuccess, onCancel }) {
  const [form, setForm]     = useState({ first_name: '', last_name: '', specialty: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await adminCreateStaff({
        role:       'doctor',
        first_name: form.first_name,
        last_name:  form.last_name,
        specialty:  form.specialty || undefined,
        email:      form.email,
        password:   form.password,
      })
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>Add Doctor Account</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>First Name *</label>
          <input required type="text" value={form.first_name}
            onChange={e => set('first_name', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Last Name *</label>
          <input required type="text" value={form.last_name}
            onChange={e => set('last_name', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Specialty</label>
          <input type="text" placeholder="e.g. General Practice"
            value={form.specialty} onChange={e => set('specialty', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input required type="email" value={form.email}
            onChange={e => set('email', e.target.value)} style={inputStyle} />
        </div>
        <div className="sm:col-span-2">
          <label style={labelStyle}>Temporary Password *</label>
          <input required type="password" minLength={8} value={form.password}
            onChange={e => set('password', e.target.value)} style={inputStyle} />
        </div>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
          ⚠ {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: '#6366f1', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? <><Spinner size={3} /> Creating…</> : 'Create Doctor'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-semibold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export default function AdminPatients() {
  const [tab,            setTab]            = useState('patients')
  const [patients,       setPatients]       = useState([])
  const [doctors,        setDoctors]        = useState([])
  const [users,          setUsers]          = useState([])
  const [loadingP,       setLoadingP]       = useState(true)
  const [loadingD,       setLoadingD]       = useState(true)
  const [loadingU,       setLoadingU]       = useState(true)
  const [search,         setSearch]         = useState('')
  const [selected,       setSelected]       = useState(null)
  const [showDoctorForm, setShowDoctorForm] = useState(false)
  const [toast,          setToast]          = useState(null)

  const loadPatients = useCallback(async () => {
    setLoadingP(true)
    getPatients().then(setPatients).catch(() => {}).finally(() => setLoadingP(false))
  }, [])

  const loadDoctors = useCallback(async () => {
    setLoadingD(true)
    getDoctors().then(setDoctors).catch(() => {}).finally(() => setLoadingD(false))
  }, [])

  const loadUsers = useCallback(async () => {
    setLoadingU(true)
    adminListUsers().then(setUsers).catch(() => {}).finally(() => setLoadingU(false))
  }, [])

  useEffect(() => { loadPatients(); loadDoctors(); loadUsers() }, [loadPatients, loadDoctors, loadUsers])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const filteredPatients = search.trim()
    ? patients.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search)
      )
    : patients

  const filteredDoctors = search.trim()
    ? doctors.filter(d =>
        `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        d.email?.toLowerCase().includes(search.toLowerCase()) ||
        d.specialty?.toLowerCase().includes(search.toLowerCase())
      )
    : doctors

  return (
    <>
      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
      {selected && <PatientDetailPanel patient={selected} onClose={() => setSelected(null)} />}

      <div className="flex flex-col gap-6">

        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>People</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
              {patients.length} patients · {doctors.length} doctors on file
            </p>
          </div>
          {tab === 'doctors' && !showDoctorForm && (
            <button onClick={() => setShowDoctorForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#6366f1' }}>
              + Add Doctor
            </button>
          )}
        </div>

        {/* tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f1f5f9' }}>
          {[
            ['patients', `Patients (${patients.length})`],
            ['doctors',  `Doctors (${doctors.length})`],
            ['users',    `Auth Users (${users.length})`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setSearch(''); setShowDoctorForm(false) }}
              className="px-5 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === key ? '#fff'          : 'transparent',
                color:      tab === key ? 'var(--text-h)' : 'var(--text)',
                boxShadow:  tab === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* create doctor form */}
        {tab === 'doctors' && showDoctorForm && (
          <CreateDoctorForm
            onSuccess={() => { setShowDoctorForm(false); loadDoctors(); setToast({ message: 'Doctor account created!', type: 'success' }) }}
            onCancel={() => setShowDoctorForm(false)}
          />
        )}

        {/* search */}
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <input type="text" placeholder={`Search ${tab}…`}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36 }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text)' }}>
            🔍
          </span>
        </div>

        {/* ── patients table ── */}
        {tab === 'patients' && (
          <div className="bg-white rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {loadingP ? (
              <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--text)' }}>
                <Spinner size={5} /> Loading patients…
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="text-4xl opacity-20">👥</span>
                <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                  {search ? `No patients matching "${search}"` : 'No patients on file'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                      {['Patient', 'Email', 'Phone', 'Blood Type', 'Member Since'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--text)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((p, i) => {
                      const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
                      return (
                        <tr key={p.id} onClick={() => setSelected(p)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50"
                          style={{ borderBottom: i < filteredPatients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: '#6366f1' }}>
                                {initials(name || p.email)}
                              </div>
                              <span className="font-medium" style={{ color: 'var(--text-h)' }}>
                                {name || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{p.email ?? '—'}</td>
                          <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{p.phone ?? '—'}</td>
                          <td className="px-5 py-3.5">
                            {p.blood_type
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}>
                                  {p.blood_type}
                                </span>
                              : <span style={{ color: 'var(--text)' }}>—</span>}
                          </td>
                          <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{fmtDate(p.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── doctors table ── */}
        {tab === 'doctors' && (
          <div className="bg-white rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {loadingD ? (
              <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--text)' }}>
                <Spinner size={5} /> Loading doctors…
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="text-4xl opacity-20">🩺</span>
                <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>
                  {search ? `No doctors matching "${search}"` : 'No doctors on file'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                      {['Doctor', 'Specialty', 'Email'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--text)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((d, i) => {
                      const name = [d.first_name, d.last_name].filter(Boolean).join(' ')
                      return (
                        <tr key={d.id}
                          style={{ borderBottom: i < filteredDoctors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: '#0d9488' }}>
                                {initials(name)}
                              </div>
                              <span className="font-medium" style={{ color: 'var(--text-h)' }}>
                                Dr. {name}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>
                            {d.specialty ?? <span className="italic">—</span>}
                          </td>
                          <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{d.email ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── users tab ── */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {loadingU ? (
              <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text)' }}>
                <Spinner /> Loading users…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                      {['User', 'Role', 'Status', 'Verified', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--text)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => {
                      const q = search.toLowerCase()
                      return !q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.role?.includes(q)
                    }).map((u, i, arr) => (
                      <tr key={u.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: 'var(--text-h)' }}>{u.full_name || '—'}</div>
                          <div className="text-xs" style={{ color: 'var(--text)' }}>{u.email ?? u.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize"
                            style={{
                              background: u.role === 'admin' ? 'rgba(99,102,241,0.1)' : u.role === 'doctor' ? 'rgba(13,148,136,0.1)' : 'rgba(30,58,138,0.08)',
                              color:      u.role === 'admin' ? '#6366f1'              : u.role === 'doctor' ? '#0d9488'              : 'var(--primary)',
                            }}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold" style={{ color: u.is_active ? '#059669' : '#dc2626' }}>
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold" style={{ color: u.is_verified ? '#059669' : '#d97706' }}>
                            {u.is_verified ? '✓ Verified' : '⚠ Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {!u.is_verified && (
                              <button
                                onClick={async () => {
                                  await adminVerifyUser(u.id)
                                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_verified: 1 } : x))
                                  setToast({ message: 'User verified.', type: 'success' })
                                }}
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                                style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                                Verify
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                const res = await adminToggleUserStatus(u.id)
                                setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: res.is_active } : x))
                                setToast({ message: res.message, type: 'success' })
                              }}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                              style={{
                                background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.1)',
                                color:      u.is_active ? '#dc2626'              : '#059669',
                              }}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
