import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'
import {
  getAnalytics,
  getAppointmentsPerDay,
  getTopMedications,
  getDoctorLoad,
} from '../../services/api'

// ─── design tokens ────────────────────────────────────────────────────────────

const TEAL    = '#0d9488'
const INDIGO  = '#6366f1'
const GREEN   = '#10b981'
const AMBER   = '#f59e0b'
const BLUE    = '#3b82f6'
const SLATE   = '#94a3b8'
const RED     = '#ef4444'

const STATUS_META = {
  waiting:       { label: 'Waiting',     color: AMBER   },
  in_progress:   { label: 'In Progress', color: BLUE    },
  'in-progress': { label: 'In Progress', color: BLUE    },
  completed:     { label: 'Completed',   color: GREEN   },
  cancelled:     { label: 'Cancelled',   color: SLATE   },
}

const REFILL_META = {
  Pending:  { color: AMBER },
  Approved: { color: GREEN },
  Denied:   { color: RED   },
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fillDays(apiData, days = 30) {
  const map = {}
  apiData.forEach(d => { map[d.date] = d })

  const out = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const row = map[key] ?? {}
    out.push({
      date:      key,
      label:     d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      total:     Number(row.total     ?? 0),
      completed: Number(row.completed ?? 0),
      active:    Number(row.active    ?? 0),
      cancelled: Number(row.cancelled ?? 0),
    })
  }
  return out
}

function fillMonths(apiData, months = 6) {
  const map = {}
  apiData.forEach(d => { map[d.month] = Number(d.count) })

  const out = []
  const today = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d   = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({
      month: key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count: map[key] ?? 0,
    })
  }
  return out
}

// Shorten "Dr. FirstName LastName" → "FirstName L."
function shortName(full = '') {
  const parts = full.trim().split(' ')
  if (parts.length === 1) return full
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:   '#fff',
      border:       '1px solid var(--border)',
      borderRadius: 12,
      padding:      '8px 14px',
      boxShadow:    '0 4px 16px rgba(0,0,0,0.08)',
      fontSize:     13,
    }}>
      {label && (
        <p style={{ color: 'var(--text)', fontSize: 11, marginBottom: 4 }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.stroke || p.fill || 'var(--text-h)', fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ''}{p.value}
        </p>
      ))}
    </div>
  )
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color, loading }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="h-1" style={{ background: color }} />
      <div className="p-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
          style={{ background: color + '18' }}>
          {icon}
        </div>
        {loading
          ? <div className="h-9 w-20 rounded-xl animate-pulse mb-1" style={{ background: 'var(--border)' }} />
          : <div className="text-3xl font-bold leading-none mb-1" style={{ color: 'var(--text-h)' }}>{value ?? '—'}</div>
        }
        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</div>
        {sub && !loading && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{sub}</div>
        )}
      </div>
    </div>
  )
}

// ─── chart card ───────────────────────────────────────────────────────────────

function ChartCard({ title, sub, className = '', children }) {
  return (
    <div className={`bg-white rounded-2xl border p-6 flex flex-col gap-4 ${className}`}
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>{title}</h3>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function SkeletonChart({ height = 220 }) {
  return <div className="rounded-xl animate-pulse" style={{ height, background: '#f1f5f9' }} />
}

function PieLabel({ cx, cy, midAngle, outerRadius, percent }) {
  if (percent < 0.06) return null
  const R = Math.PI / 180
  const x = cx + (outerRadius + 18) * Math.cos(-midAngle * R)
  const y = cy + (outerRadius + 18) * Math.sin(-midAngle * R)
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text)' }}>
      {(percent * 100).toFixed(0)}%
    </text>
  )
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [summary,    setSummary]    = useState(null)
  const [perDay,     setPerDay]     = useState([])
  const [topMeds,    setTopMeds]    = useState([])
  const [doctorLoad, setDoctorLoad] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sum, days, meds, docs] = await Promise.all([
        getAnalytics(),
        getAppointmentsPerDay(),
        getTopMedications(),
        getDoctorLoad(),
      ])
      setSummary(sum)
      setPerDay(days)
      setTopMeds(meds)
      setDoctorLoad(docs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── derived data ─────────────────────────────────────────────────────────────

  const dailyLine  = fillDays(perDay, 30)
  const monthArea  = summary ? fillMonths(summary.appointments_by_month) : []

  const statusData = summary
    ? summary.appointments_by_status
        .map(d => ({
          name:  STATUS_META[d.status]?.label ?? d.status,
          value: Number(d.count),
          color: STATUS_META[d.status]?.color ?? SLATE,
        }))
        .filter(d => d.value > 0)
    : []

  const refillData = summary
    ? summary.refills_by_status
        .map(d => ({
          name:  d.status,
          value: Number(d.count),
          color: REFILL_META[d.status]?.color ?? SLATE,
        }))
        .filter(d => d.value > 0)
    : []

  const medsData = topMeds.map(m => ({
    name:      m.name,
    count:     Number(m.count),
    refillable: Number(m.refillable),
  }))

  const docData = doctorLoad.map(d => ({
    name:      shortName(d.doctor_name),
    full:      d.doctor_name,
    specialty: d.specialty ?? '—',
    total:     Number(d.total),
    completed: Number(d.completed),
    active:    Number(d.active),
    cancelled: Number(d.cancelled),
  }))

  const t = summary?.totals ?? {}
  const completionRate = t.total_appointments > 0
    ? Math.round((t.completed_appointments / t.total_appointments) * 100)
    : 0

  if (error) return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
      <span>⚠</span>
      <span>Failed to load analytics: {error}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* ── header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
            Clinic performance overview · live data
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-opacity"
          style={{ borderColor: 'var(--border)', color: 'var(--text)', opacity: loading ? 0.5 : 1 }}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Patients"   value={t.total_patients}       icon="👥" color={INDIGO} loading={loading} />
        <StatCard label="Appointments"     value={t.total_appointments}   icon="📅" color={BLUE}   loading={loading}
          sub={`${t.active_appointments ?? 0} active`} />
        <StatCard label="Completion Rate"  value={`${completionRate}%`}   icon="✅" color={GREEN}  loading={loading}
          sub={`${t.completed_appointments ?? 0} done`} />
        <StatCard label="Pending Refills"  value={t.pending_refills}      icon="💊" color={AMBER}  loading={loading} />
        <StatCard label="Doctors on Staff" value={t.total_doctors}        icon="🩺" color={TEAL}   loading={loading} />
      </div>

      {/* ── row 1: appointments per day (line) + status donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <ChartCard className="lg:col-span-2"
          title="Appointments Over Time"
          sub="Daily — last 30 days · completed vs active">
          {loading ? <SkeletonChart height={240} /> : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyLine}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'var(--text)' }}
                    tickLine={false} axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text)' }}
                    tickLine={false} axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={v => <span style={{ fontSize: 11, color: 'var(--text)' }}>{v}</span>}
                  />
                  <Line dataKey="total"     name="Total"     stroke={INDIGO} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line dataKey="completed" name="Completed" stroke={GREEN}  strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
                  <Line dataKey="active"    name="Active"    stroke={BLUE}   strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Appointment Status" sub="All time distribution">
          {loading ? <SkeletonChart height={240} /> : statusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text)' }}>
              No data yet
            </div>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData} dataKey="value"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={82}
                    paddingAngle={3}
                    labelLine={false} label={PieLabel}>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={v => <span style={{ fontSize: 11, color: 'var(--text)' }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── row 2: top medications (bar) ── */}
      <ChartCard title="Top Medications" sub="Most prescribed — top 10">
        {loading ? <SkeletonChart height={240} /> : medsData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text)' }}>
            No prescriptions on file
          </div>
        ) : (
          <div style={{ height: Math.max(200, medsData.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={medsData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'var(--text)' }}
                  tickLine={false} axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category" dataKey="name"
                  width={160}
                  tick={{ fontSize: 11, fill: 'var(--text-h)' }}
                  tickLine={false} axisLine={false}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, color: 'var(--text)' }}>{v}</span>}
                />
                <Bar dataKey="count"      name="Total Rx"   fill={TEAL}  radius={[0, 4, 4, 0]} />
                <Bar dataKey="refillable" name="Refillable" fill={GREEN} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* ── row 3: doctor load (stacked bar) ── */}
      <ChartCard title="Doctor Load" sub="Appointments per doctor — all time">
        {loading ? <SkeletonChart height={220} /> : docData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text)' }}>
            No doctors on file
          </div>
        ) : (
          <div style={{ height: Math.max(200, docData.length * 48) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={docData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'var(--text)' }}
                  tickLine={false} axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category" dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'var(--text-h)' }}
                  tickLine={false} axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const doc = docData.find(d => d.name === label)
                    return (
                      <div style={{
                        background: '#fff', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '8px 14px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 13,
                      }}>
                        <p style={{ color: 'var(--text-h)', fontWeight: 700, marginBottom: 4 }}>
                          Dr. {doc?.full ?? label}
                        </p>
                        {doc?.specialty && (
                          <p style={{ color: 'var(--text)', fontSize: 11, marginBottom: 6 }}>
                            {doc.specialty}
                          </p>
                        )}
                        {payload.map((p, i) => (
                          <p key={i} style={{ color: p.fill, fontWeight: 600 }}>
                            {p.name}: {p.value}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, color: 'var(--text)' }}>{v}</span>}
                />
                <Bar dataKey="completed" name="Completed" stackId="a" fill={GREEN}  radius={[0, 0, 0, 0]} />
                <Bar dataKey="active"    name="Active"    stackId="a" fill={BLUE}   radius={[0, 0, 0, 0]} />
                <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill={SLATE}  radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* ── row 4: monthly trend (area) + refills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <ChartCard className="lg:col-span-2"
          title="Monthly Trend"
          sub="Appointment volume — last 6 months">
          {loading ? <SkeletonChart height={180} /> : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthArea}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={INDIGO} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={INDIGO} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label"
                    tick={{ fontSize: 10, fill: 'var(--text)' }}
                    tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text)' }}
                    tickLine={false} axisLine={false}
                    allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    dataKey="count" name="Appointments"
                    stroke={INDIGO} strokeWidth={2}
                    fill="url(#areaGrad)"
                    dot={{ r: 3, fill: INDIGO, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Refill Requests" sub="By status">
          {loading ? <SkeletonChart height={180} /> : refillData.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-sm" style={{ color: 'var(--text)' }}>
              No refills yet
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {refillData.map(d => {
                  const total = refillData.reduce((s, r) => s + r.value, 0)
                  const pct   = total > 0 ? Math.round((d.value / total) * 100) : 0
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-h)' }}>
                          {d.name}
                        </span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>
                          {d.value} <span style={{ color: 'var(--text)', fontWeight: 400 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: d.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ height: 110 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={refillData} dataKey="value"
                      cx="50%" cy="50%"
                      innerRadius={32} outerRadius={48}
                      paddingAngle={4}>
                      {refillData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ChartCard>

      </div>
    </div>
  )
}
