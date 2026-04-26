const { getPool } = require('../db/connection')

async function getHealth(req, res) {
  let database = 'connected'

  try {
    await getPool().query('SELECT 1')
  } catch {
    database = 'disconnected'
  }

  res.json({
    status:    'ok',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date(),
    database,
  })
}

module.exports = { getHealth }
