// PM2 process manager config.
// Start with: pm2 start ecosystem.config.cjs --env production
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name:        'rivermed-api',
      script:      'src/server.js',
      cwd:         '/var/www/rivermed/backend',

      // Fork mode — required for Socket.IO without a Redis adapter.
      // Cluster mode needs sticky sessions; skip that complexity for a single server.
      exec_mode:   'fork',
      instances:   1,

      // Never watch in production — nodemon is for dev only.
      watch:       false,

      // Restart if heap exceeds 500 MB.
      max_memory_restart: '500M',

      // Merge stdout and stderr into one PM2 log stream.
      merge_logs:  true,

      // Graceful shutdown: give the HTTP server 10 s to drain connections.
      kill_timeout: 10000,
      listen_timeout: 5000,

      env_production: {
        NODE_ENV:       'production',
        PORT:           4000,

        // ── database ──────────────────────────────────────────────────────────
        DB_HOST:        '127.0.0.1',
        DB_PORT:        3306,
        DB_USER:        'rivermed',
        DB_PASSWORD:    'CHANGE_THIS_STRONG_PASSWORD',
        DB_NAME:        'river_med',

        // ── auth ──────────────────────────────────────────────────────────────
        // Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
        JWT_SECRET:     'CHANGE_THIS_TO_64_RANDOM_HEX_CHARS',
        JWT_EXPIRES_IN: '7d',
      },
    },
  ],
}
