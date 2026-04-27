const express = require('express')
const helmet  = require('helmet')
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
const medicalHistoryRouter = require('./routes/medicalHistory')
const vitalsRouter         = require('./routes/vitals')
const notificationsRouter  = require('./routes/notifications')
const insuranceRouter      = require('./routes/insurance')
const documentsRouter      = require('./routes/documents')

const app = express()

// ── security headers ──────────────────────────────────────────────────────────
app.use(helmet())

// ── CORS ──────────────────────────────────────────────────────────────────────
// Placed before all routes so OPTIONS pre-flight requests are handled first.
const allowedOrigins = [
  'https://river-med-app.vercel.app',
  'http://localhost:5173',   // Vite dev
  'http://localhost:4173',   // Vite preview
]

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin: mobile apps, curl, Postman, server-to-server
    if (!origin) return callback(null, true)

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true)
    }

    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,   // forward Authorization header and cookies
}))
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

// ── Tier 1 routes ─────────────────────────────────────────────────────────────
app.use('/api/medical',                   medicalHistoryRouter)
app.use('/api/appointments/:id/vitals',   vitalsRouter)

// ── Tier 2 routes ─────────────────────────────────────────────────────────────
app.use('/api/notifications',             notificationsRouter)
app.use('/api/insurance',                 insuranceRouter)
app.use('/api/documents',                 documentsRouter)

app.get('/', (_req, res) => res.json({ message: 'River Med API running' }))

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// global error handler
app.use((err, _req, res, _next) => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

module.exports = app
