// ── env loader ────────────────────────────────────────────────────────────────
// Must run before any other module reads process.env.
// NODE_ENV is set by the OS / PM2 before this process starts, so it is
// readable here even before dotenv runs.
const path = require('path')
const fs   = require('fs')

;(function loadEnv() {
  const isProd   = process.env.NODE_ENV === 'production'
  const target   = path.join(__dirname, '..', isProd ? '.env.production' : '.env')
  const fallback = path.join(__dirname, '..', '.env')

  if (fs.existsSync(target)) {
    require('dotenv').config({ path: target })
  } else if (fs.existsSync(fallback)) {
    // .env.production missing — fall back to .env so the app never crashes
    require('dotenv').config({ path: fallback })
  }
  // If neither file exists dotenv is simply not called; process.env values
  // set by PM2 / the OS are still available.
})()

const http = require('http')
const os   = require('os')
const app  = require('./app')
const { connectWithRetry } = require('./db/connection')
const socket = require('./socket')

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  dim:     '\x1b[2m',
}

const PORT = process.env.PORT || 4000

async function startServer() {
  await connectWithRetry(3, 2000)

  const httpServer = http.createServer(app)

  // Attach Socket.IO — must happen before httpServer.listen
  socket.init(httpServer)

  // Handle port-in-use cleanly so nodemon gets a proper exit instead of
  // an unhandled 'error' event that locks the process in a crash loop.
  httpServer.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n\x1b[31m[ERROR]\x1b[0m Port ${PORT} is already in use.\n` +
        `  Run this in PowerShell to free it:\n` +
        `  \x1b[2mStop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\x1b[0m\n`
      )
      process.exit(1)   // clean exit → nodemon will retry on next file save
    } else {
      throw err
    }
  })

  httpServer.listen(PORT, '0.0.0.0', () => {
    const lan = getLanIp()

    console.log('')
    console.log(`  ${C.green}${C.bold}River Med API${C.reset}  ${C.dim}ready${C.reset}`)
    console.log('')
    console.log(`  ${C.cyan}Local  ${C.reset}  http://localhost:${PORT}`)
    if (lan) {
      console.log(`  ${C.cyan}Network${C.reset}  http://${lan}:${PORT}`)
    }
    console.log(`  ${C.cyan}Health ${C.reset}  http://localhost:${PORT}/api/health`)
    console.log(`  ${C.magenta}Socket ${C.reset}  ws://localhost:${PORT}`)
    console.log('')
  })
}

function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return null
}

startServer()
