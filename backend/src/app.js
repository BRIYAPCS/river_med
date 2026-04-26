const express = require('express')
const cors    = require('cors')

const { verifyToken, requireRole } = require('./middleware/authMiddleware')

const authRouter           = require('./routes/auth')
const adminRouter          = require('./routes/admin')
const healthRouter         = require('./routes/health')
const patientsRouter       = require('./routes/patients')
const doctorsRouter        = require('./routes/doctors')
const appointmentsRouter   = require('./routes/appointments')
const messagesRouter       = require('./routes/messages')
const prescriptionsRouter  = require('./routes/prescriptions')
const refillRequestsRouter = require('./routes/refillRequests')
const analyticsRouter      = require('./routes/analytics')

const app = express()

app.use(cors())
app.use(express.json())

// request logger
app.use((req, _res, next) => {
  console.log(`\x1b[36m[API]\x1b[0m ${req.method} ${req.url}`)
  next()
})

// ── public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter)
app.use('/api/health',    healthRouter)
app.use('/api/analytics', analyticsRouter)

// ── admin-only routes (JWT + role enforced inside the router) ─────────────────
app.use('/api/admin', adminRouter)

// ── semi-public: read operations accessible without auth for demo ──────────────
app.use('/api/patients',     patientsRouter)
app.use('/api/doctors',      doctorsRouter)
app.use('/api/appointments', appointmentsRouter)
app.use('/api/messages',     messagesRouter)

// ── protected: prescriptions ──────────────────────────────────────────────────
// POST (write prescription) → doctor only
// GET  (read)               → any authenticated user (handled in the route file)
app.use('/api/prescriptions', prescriptionsRouter)

// ── protected: refill requests ────────────────────────────────────────────────
// GET /pending + PUT /:id/status → doctor or admin (handled in the route file)
// POST + GET /patient/:id        → any authenticated user
app.use('/api/refill_requests', refillRequestsRouter)

app.get('/', (_req, res) => res.json({ message: 'River Med API running' }))

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// global error handler
app.use((err, _req, res, _next) => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

module.exports = app
