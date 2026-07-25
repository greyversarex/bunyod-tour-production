// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'bunyod-tour',
    cwd: '/srv/bunyod-tour',
    script: 'index.js',       // или build/server.js — как у вас в проде
    exec_mode: 'fork',
    instances: 1,
    interpreter: process.env.PM2_NODE || '/usr/bin/node',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }],
};
