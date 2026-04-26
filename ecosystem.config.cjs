// PM2 process manager config — River Med Backend
//
// Start (production):   pm2 start ecosystem.config.cjs --env production
// Start (development):  pm2 start ecosystem.config.cjs
// Reload (zero-down):   pm2 reload river-med-backend
// Stop:                 pm2 stop river-med-backend
// Delete:               pm2 delete river-med-backend
// Save after start:     pm2 save
// Auto-start on boot:   pm2 startup  (then run the command it prints)
//
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      // ── identity ─────────────────────────────────────────────────────────────
      name:   'river-med-backend',
      script: 'src/server.js',

      // Absolute path to the backend folder on the server.
      // Adjust if your repo is cloned to a different location.
      cwd:    '/home/briya/river-med-app/backend',

      // ── process model ─────────────────────────────────────────────────────────
      // Fork mode is required for Socket.IO.
      // Cluster mode needs a Redis adapter for shared rooms — skip for a single VPS.
      exec_mode: 'fork',
      instances: 1,

      // ── reliability ───────────────────────────────────────────────────────────
      autorestart: true,
      watch:       false,           // never watch files in production

      // Restart if the Node.js heap exceeds 500 MB
      max_memory_restart: '500M',

      // Graceful shutdown: give open HTTP/WebSocket connections 10 s to drain
      kill_timeout:    10000,
      listen_timeout:  8000,

      // ── logging ───────────────────────────────────────────────────────────────
      // Separate files make it easy to tail errors without wading through stdout.
      // Create the folder first on the server: mkdir -p /home/briya/logs
      merge_logs:  false,
      out_file:    '/home/briya/logs/river-med-out.log',
      error_file:  '/home/briya/logs/river-med-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── development env ───────────────────────────────────────────────────────
      // Used when you run: pm2 start ecosystem.config.cjs
      // All other secrets are read from backend/.env by server.js
      env: {
        NODE_ENV: 'development',
        PORT:     4001,
      },

      // ── production env ────────────────────────────────────────────────────────
      // Used when you run: pm2 start ecosystem.config.cjs --env production
      // Secrets (DB password, JWT secret, email key) are read from
      // backend/.env.production by server.js — do NOT hardcode them here.
      env_production: {
        NODE_ENV: 'production',
        PORT:     4001,
      },
    },
  ],
}
