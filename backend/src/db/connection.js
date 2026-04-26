const mysql = require('mysql2/promise')

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
}

let pool = null

function initPool() {
  pool = mysql.createPool({
    host:               process.env.DB_HOST,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  })
}

// ─── public: called once in server.js before app.listen ──────────────────────
async function connectWithRetry(retries = 3, delay = 2000) {
  initPool()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1')
      console.log(
        `${C.green}${C.bold}[DB]${C.reset} Connected — ` +
        `${process.env.DB_NAME}@${process.env.DB_HOST}`
      )
      schedulePing()
      return
    } catch (err) {
      if (attempt < retries) {
        console.warn(
          `${C.yellow}[DB]${C.reset} Attempt ${attempt}/${retries} failed: ` +
          `${err.message} — retrying in ${delay / 1000}s...`
        )
        await sleep(delay)
      } else {
        console.error(`${C.red}${C.bold}[DB]${C.reset} All ${retries} attempts failed. Aborting.`)
        console.error(`${C.red}[DB]${C.reset} ${err.message}`)
        process.exit(1)
      }
    }
  }
}

// ─── public: used by every controller and health check ───────────────────────
function getPool() {
  if (!pool) throw new Error('[DB] Pool not ready — connectWithRetry() must be called first')
  return pool
}

// ─── ping every 30 s — logs if the DB goes away ──────────────────────────────
function schedulePing() {
  setInterval(async () => {
    try {
      await pool.query('SELECT 1')
    } catch (err) {
      console.error(`${C.red}[DB]${C.reset} Ping failed — ${err.message}`)
    }
  }, 30_000)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = { connectWithRetry, getPool }
