import { useState, useEffect, useCallback } from 'react'
import { getMyDoctor, updateMyDoctor, getMyAvailability, setMyAvailability } from '../../services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: '#f8fafc',
  fontSize: 14, color: 'var(--text-h)', outline: 'none',
}
const lbl = {
  display: 'block', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text)', marginBottom: 4,
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

// ─── AvailabilityEditor ───────────────────────────────────────────────────────

function AvailabilityEditor({ initial, onSave }) {
  const blank = DAYS.map((_, i) => ({
    day_of_week: i,
    start_time: '08:00',
    end_time: '17:00',
    is_active: false,
  }))

  const [slots, setSlots] = useState(() => {
    const base = [...blank]
    initial.forEach(s => {
      base[s.day_of_week] = {
        day_of_week: s.day_of_week,
        start_time:  s.start_time?.slice(0,5) ?? '08:00',
        end_time:    s.end_time?.slice(0,5)   ?? '17:00',
        is_active:   Boolean(s.is_active),
      }
    })
    return base
  })
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState(null)

  function toggle(i)    { setSlots(s => s.map((d, idx) => idx === i ? { ...d, is_active: !d.is_active } : d)) }
  function setTime(i, k, v) { setSlots(s => s.map((d, idx) => idx === i ? { ...d, [k]: v } : d)) }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      await onSave(slots.filter(s => s.is_active))
      setMsg({ ok: true, text: 'Schedule saved.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {slots.map((slot, i) => (
        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${slot.is_active ? '' : 'opacity-50'}`}
          style={{ borderColor: slot.is_active ? '#0d9488' : 'var(--border)', background: slot.is_active ? 'rgba(13,148,136,0.04)' : 'transparent' }}>
          <input type="checkbox" checked={slot.is_active} onChange={() => toggle(i)}
            className="w-4 h-4 cursor-pointer accent-teal-600" />
          <span className="w-24 text-sm font-semibold flex-shrink-0" style={{ color: 'var(--text-h)' }}>{DAYS[i]}</span>
          <div className="flex items-center gap-2 flex-1">
            <input type="time" value={slot.start_time} disabled={!slot.is_active}
              onChange={e => setTime(i, 'start_time', e.target.value)}
              style={{ ...inp, width: 120, padding: '6px 8px', fontSize: 13 }} />
            <span className="text-xs" style={{ color: 'var(--text)' }}>to</span>
            <input type="time" value={slot.end_time} disabled={!slot.is_active}
              onChange={e => setTime(i, 'end_time', e.target.value)}
              style={{ ...inp, width: 120, padding: '6px 8px', fontSize: 13 }} />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between mt-1">
        {msg && <span className="text-xs font-medium" style={{ color: msg.ok ? '#059669' : '#dc2626' }}>{msg.text}</span>}
        <button onClick={handleSave} disabled={saving}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Saving…</> : 'Save Schedule'}
        </button>
      </div>
    </div>
  )
}

// ─── DoctorProfile ────────────────────────────────────────────────────────────

export default function DoctorProfile() {
  const [doctor,   setDoctor]   = useState(null)
  const [avail,    setAvail]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(false)
  const [form,     setForm]     = useState({})
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, a] = await Promise.all([getMyDoctor(), getMyAvailability()])
      setDoctor(d)
      setAvail(a)
      setForm({ first_name: d.first_name, last_name: d.last_name, specialty: d.specialty ?? '', phone: d.phone ?? '' })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updateMyDoctor(form)
      setDoctor(res.doctor)
      setEditing(false)
      setToast('Profile updated.')
    } catch (err) {
      setToast('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAvail(slots) {
    const res = await setMyAvailability(slots)
    setAvail(res.availability)
  }

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-20" style={{ color: 'var(--text)' }}>
      <Spinner /> Loading…
    </div>
  )

  const initials = [doctor?.first_name?.[0], doctor?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'DR'

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white"
          style={{ background: toast.startsWith('Error') ? '#dc2626' : '#059669' }}>
          {toast.startsWith('Error') ? '⚠ ' : '✓ '}{toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Profile</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Manage your professional information and schedule</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>
            ✏ Edit Profile
          </button>
        )}
      </div>

      {/* identity card */}
      <div className="bg-white rounded-2xl border p-6 flex items-center gap-5"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
          style={{ background: '#0d9488' }}>
          {initials}
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-h)' }}>
            Dr. {doctor?.first_name} {doctor?.last_name}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{doctor?.specialty ?? 'General Practice'}</p>
          {doctor?.email && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{doctor.email}</p>}
        </div>
      </div>

      {/* profile form / read view */}
      <div className="bg-white rounded-2xl border p-6"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text)' }}>
          Professional Information
        </h3>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {[['first_name','First Name'],['last_name','Last Name']].map(([k, l]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input style={inp} required value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={lbl}>Specialty</label>
                <input style={inp} value={form.specialty ?? ''} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="General Practice" />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input style={inp} value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditing(false)}
                className="px-5 py-2 rounded-xl text-sm font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: '#0d9488', opacity: saving ? 0.6 : 1 }}>
                {saving ? <><Spinner /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-5">
            {[
              ['First Name', doctor?.first_name],
              ['Last Name',  doctor?.last_name],
              ['Specialty',  doctor?.specialty],
              ['Phone',      doctor?.phone],
              ['Email',      doctor?.email],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{label}</dt>
                <dd className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* availability schedule */}
      <div className="bg-white rounded-2xl border p-6"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text)' }}>
          Weekly Schedule
        </h3>
        <AvailabilityEditor initial={avail} onSave={handleSaveAvail} />
      </div>
    </div>
  )
}
