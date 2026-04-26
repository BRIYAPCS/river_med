const { Server } = require('socket.io')
const { getPool } = require('./db/connection')

const C = {
  reset:   '\x1b[0m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
}

let io = null

// ─── broadcast helpers (called by controllers) ────────────────────────────────

// Sends an appointment event to every admin, every doctor, and the specific patient.
function broadcastAppointment(event, appt) {
  if (!io || !appt) return
  io.to('role:admin').emit(event, appt)
  io.to('role:doctor').emit(event, appt)
  if (appt.patient_id) io.to(`patient:${appt.patient_id}`).emit(event, appt)
}

// Sends a refill event to every admin, every doctor, and the specific patient.
function broadcastRefill(refill) {
  if (!io || !refill) return
  io.to('role:admin').emit('refill_updated', refill)
  io.to('role:doctor').emit('refill_updated', refill)
  if (refill.patient_id) io.to(`patient:${refill.patient_id}`).emit('refill_updated', refill)
}

// ─── init ─────────────────────────────────────────────────────────────────────

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:  '*',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', socket => {
    console.log(
      `${C.magenta}${C.bold}[WS]${C.reset}  Client connected    ${C.dim}${socket.id}${C.reset}`
    )

    // ── join_user ─────────────────────────────────────────────────────────────
    // Dashboards emit this right after connecting so the server can route
    // role-scoped events (appointment_created/updated, refill_updated) correctly.
    socket.on('join_user', ({ role, patient_id, doctor_id } = {}) => {
      if (role)       socket.join(`role:${role}`)
      if (patient_id) socket.join(`patient:${patient_id}`)
      if (doctor_id)  socket.join(`doctor:${doctor_id}`)

      console.log(
        `${C.cyan}[WS]${C.reset}  ${C.dim}${socket.id}${C.reset} → role:${role ?? '?'}` +
        (patient_id ? ` / patient:${patient_id}` : '') +
        (doctor_id  ? ` / doctor:${doctor_id}`   : '')
      )
    })

    // ── join_chat ─────────────────────────────────────────────────────────────
    socket.on('join_chat', ({ patient_id, doctor_id }) => {
      if (!patient_id || !doctor_id) return

      for (const room of socket.rooms) {
        if (room !== socket.id) socket.leave(room)
      }

      const room = `chat_p${patient_id}_d${doctor_id}`
      socket.join(room)

      console.log(
        `${C.cyan}[WS]${C.reset}  ${C.dim}${socket.id}${C.reset} joined ${C.bold}${room}${C.reset}`
      )
    })

    // ── send_message ──────────────────────────────────────────────────────────
    socket.on('send_message', async ({ patient_id, doctor_id, sender_role, body }) => {
      if (!patient_id || !doctor_id || !sender_role || !body?.trim()) {
        socket.emit('message_error', { error: 'Missing required fields' })
        return
      }

      try {
        const pool = getPool()

        const [result] = await pool.query(
          'INSERT INTO messages (patient_id, doctor_id, sender_role, body) VALUES (?, ?, ?, ?)',
          [patient_id, doctor_id, sender_role, body.trim()]
        )

        const [[msg]] = await pool.query(`
          SELECT m.*,
            CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
            CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
          FROM messages m
          JOIN patients p ON m.patient_id = p.id
          JOIN doctors  d ON m.doctor_id  = d.id
          WHERE m.id = ?
        `, [result.insertId])

        const room = `chat_p${patient_id}_d${doctor_id}`
        io.to(room).emit('receive_message', msg)

        // also notify the other party's dashboard via new_message
        io.to(`patient:${patient_id}`).emit('new_message', { patient_id, doctor_id })
        io.to(`doctor:${doctor_id}`).emit('new_message',  { patient_id, doctor_id })

        console.log(
          `${C.cyan}[WS]${C.reset}  msg #${result.insertId} → ${C.bold}${room}${C.reset}`
        )
      } catch (err) {
        console.error(`${C.magenta}[WS]${C.reset}  send_message error:`, err.message)
        socket.emit('message_error', { error: 'Failed to save message' })
      }
    })

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', reason => {
      console.log(
        `${C.magenta}[WS]${C.reset}  Client disconnected ${C.dim}${socket.id} (${reason})${C.reset}`
      )
    })
  })

  return io
}

// ─── getIO ────────────────────────────────────────────────────────────────────

function getIO() {
  if (!io) throw new Error('[Socket] io not initialized — call init(httpServer) in server.js first')
  return io
}

module.exports = { init, getIO, broadcastAppointment, broadcastRefill }
