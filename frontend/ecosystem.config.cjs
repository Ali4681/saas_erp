/**
 * PM2 process file for the Next.js frontend.
 *
 *   cd frontend
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'erpwejha-frontend',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3370',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        // Must be production on the live server (Secure session cookies + Next optimizations).
        NODE_ENV: 'production',
        PORT: 3370,
        // Do NOT set API_INTERNAL_URL=127.0.0.1 if Nest is on another host.
        // Point NEXT_PUBLIC_API_BASE_URL at the public API (or Nginx /api proxy).
      },
    },
  ],
};
