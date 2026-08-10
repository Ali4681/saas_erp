/**
 * Quick MySQL connectivity check (no Prisma). Usage:
 *   npx tsx scripts/db-ping.ts
 */
import 'dotenv/config';
import mariadb from 'mariadb';

function configFromEnv() {
  const url = process.env.DATABASE_URL;
  let fromUrl: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
  } = {};

  if (url) {
    try {
      const u = new URL(url);
      fromUrl = {
        host: u.hostname,
        port: u.port ? Number(u.port) : 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, '') || undefined,
      };
    } catch {
      /* ignore malformed DATABASE_URL */
    }
  }

  const host = process.env.DATABASE_HOST || fromUrl.host || 'localhost';
  return {
    host,
    port: Number(process.env.DATABASE_PORT || fromUrl.port || 3306),
    user: process.env.DATABASE_USER || fromUrl.user || 'root',
    password: process.env.DATABASE_PASSWORD ?? fromUrl.password ?? '',
    database: process.env.DATABASE_NAME || fromUrl.database || 'saas_erp',
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT ?? 10000),
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const cfg = configFromEnv();
  console.log('Ping config:', {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    database: cfg.database,
    passwordSet: Boolean(cfg.password),
  });

  let conn: mariadb.Connection | undefined;
  try {
    conn = await mariadb.createConnection(cfg);
    const rows = await conn.query('SELECT 1 AS ok, DATABASE() AS db, USER() AS user');
    console.log('OK:', rows[0]);
  } catch (err) {
    const e = err as { code?: string; errno?: number; sqlMessage?: string; message?: string };
    console.error('FAILED:', {
      code: e.code,
      errno: e.errno,
      sqlMessage: e.sqlMessage,
      message: e.message,
    });
    console.error(`
Hints (Plesk / Linux):
- Prefer DATABASE_HOST=localhost (socket) over 127.0.0.1 (TCP) — MySQL treats them as different users.
- Create a DB user in Plesk and set DATABASE_USER / DATABASE_PASSWORD (root is often locked).
- Ensure database exists: CREATE DATABASE saas_erp;
- Test: mysql -h localhost -u USER -p saas_erp -e "SELECT 1"
`);
    process.exit(1);
  } finally {
    await conn?.end();
  }
}

main();
