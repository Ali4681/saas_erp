/**
 * PM2 process file — same entry locally and on the server.
 *
 *   cd backend
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   # or: npm run pm2:start
 */
module.exports = {
  apps: [
    {
      name: 'erpwejha-backend',
      cwd: __dirname,
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
