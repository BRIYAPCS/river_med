import { useState, useEffect, useCallback } from 'react'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { getAppointments } from '../../services/api'
import AppointmentModal from '../../components/calendar/AppointmentModal'

// ─── localizer ────────────────────────────────────────────────────────────────
const localizer = momentLocalizer(moment)

// ─── status → colour map ──────────────────────────────────────────────────────
const STATUS_COLOR = {
  waiting:      '#3b82f6',
  in_progress:  '#f59e0b',
  'in-progress':'#f59e0b',
  completed:    '#10b981',
  cancelled:    '#6b7280',
}

const LEGEND = [
  { label: 'Waiting',     color: STATUS_COLOR.waiting },
  { label: 'In Progress', color: STATUS_COLOR.in_progress },
  { label: 'Completed',   color: STATUS_COLOR.completed },
  { label: 'Cancelled',   color: STATUS_COLOR.cancelled },
]

// ─── appointment row → calendar event ─────────────────────────────────────────
function toEvent(appt) {
  const start = new Date(appt.appointment_date)
  const end   = new Date(start.getTime() + 60 * 60 * 1000) // 1-hour blocks
  return {
    id:       appt.id,
    title:    appt.reason
      ? `${appt.patient_name} — ${appt.reason}`
      : appt.patient_name,
    start,
    end,
    resource: appt,
  }
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // controlled calendar state (view + date live here so toolbar is consistent)
  const [view, setView] = useState('week')
  const [date, setDate] = useState(new Date())

  // modal: null | { mode: 'create', slot } | { mode: 'edit', event }
  const [modal, setModal] = useState(null)

  // ── fetch all appointments on mount ──
  useEffect(() => {
    getAppointments()
      .then(rows  => setEvents(rows.map(toEvent)))
      .catch(err  => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // ── colour events by status ──
  const eventPropGetter = useCallback(event => ({
    style: {
      backgroundColor: STATUS_COLOR[event.resource?.status] ?? STATUS_COLOR.waiting,
      borderRadius:    '6px',
      border:          'none',
      color:           '#fff',
      fontSize:        '12px',
      fontWeight:      '500',
      padding:         '2px 6px',
    },
  }), [])

  // ── slot click → create modal ──
  function handleSelectSlot(slot) {
    setModal({ mode: 'create', slot })
  }

  // ── event click → edit modal ──
  function handleSelectEvent(event) {
    setModal({ mode: 'edit', event })
  }

  // ── after create: refetch to get joined names ──
  // ── after edit:   replace the one event in-place ──
  function handleSave(savedAppt) {
    if (modal.mode === 'create') {
      getAppointments().then(rows => setEvents(rows.map(toEvent)))
    } else {
      setEvents(prev =>
        prev.map(e => e.id === savedAppt.id ? toEvent(savedAppt) : e)
      )
    }
    setModal(null)
  }

  function handleDelete(id) {
    setEvents(prev => prev.filter(e => e.id !== id))
    setModal(null)
  }

  // ── render ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ color: 'var(--primary)' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Loading appointments…
        </span>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
      <span>⚠</span>
      <span>{error}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">

      {/* ── page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>
            Appointments
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
            Click a time slot to schedule · click an event to edit or delete
          </p>
        </div>
        <button
          onClick={() => setModal({
            mode: 'create',
            slot: { start: new Date(), end: new Date() },
          })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}>
          <span className="text-base leading-none">+</span>
          New
        </button>
      </div>

      {/* ── legend ── */}
      <div className="flex flex-wrap gap-4">
        {LEGEND.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: color }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── calendar ── */}
      <div
        className="bg-white rounded-2xl border p-4"
        style={{ borderColor: 'var(--border)', height: 680 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          // controlled view + navigation
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          views={['month', 'week', 'day']}
          // interactions
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          // styling
          eventPropGetter={eventPropGetter}
          style={{ height: '100%' }}
          // show truncated events as a popup in month view
          popup
        />
      </div>

      {/* ── modal ── */}
      {modal && (
        <AppointmentModal
          mode={modal.mode}
          slot={modal.slot}
          event={modal.event}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
