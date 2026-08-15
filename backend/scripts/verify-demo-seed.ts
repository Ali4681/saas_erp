/**
 * Verify demo-co seed is present in the DB from backend/.env
 *
 *   cd backend
 *   npx tsx scripts/verify-demo-seed.ts
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

function dbConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const u = new URL(url);
  return {
    host: process.env.DATABASE_HOST || u.hostname || 'localhost',
    port: Number(process.env.DATABASE_PORT || u.port || 3306),
    user: process.env.DATABASE_USER || u.username || 'root',
    password: process.env.DATABASE_PASSWORD ?? decodeURIComponent(u.password || ''),
    database: process.env.DATABASE_NAME || u.pathname.replace(/^\//, '') || 'saas_erp',
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const db = dbConfig();
  console.log(
    `Checking ${db.user}@${db.host}:${db.port}/${db.database}`,
  );
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(db) });

  const company = await prisma.company.findUnique({
    where: { slug: 'demo-co' },
    select: { id: true, slug: true, displayName: true, status: true },
  });
  if (!company) {
    console.error('NO company with slug=demo-co — run: npm run seed');
    process.exit(1);
  }

  const [
    users,
    memberships,
    employees,
    items,
    invoices,
    contacts,
  ] = await Promise.all([
    prisma.user.count({
      where: { email: { endsWith: '@demo-co.local' } },
    }),
    prisma.companyUser.count({ where: { companyId: company.id } }),
    prisma.employee.count({ where: { companyId: company.id } }),
    prisma.item.count({ where: { companyId: company.id } }),
    prisma.salesInvoice.count({ where: { companyId: company.id } }),
    prisma.crmContact.count({ where: { companyId: company.id } }),
  ]);

  const owner = await prisma.user.findUnique({
    where: { email: 'owner@demo-co.local' },
    select: {
      id: true,
      email: true,
      status: true,
      memberships: {
        where: { companyId: company.id },
        select: { status: true, role: { select: { code: true } } },
      },
    },
  });

  console.log('company:', company);
  console.log('counts:', {
    demoUsers: users,
    memberships,
    employees,
    items,
    salesInvoices: invoices,
    crmContacts: contacts,
  });
  console.log('owner@demo-co.local:', owner);

  if (employees === 0 || items === 0) {
    console.error(
      '\nDemo data missing. From this backend folder run:\n  npx prisma migrate deploy\n  npm run seed\n  pm2 reload ecosystem.config.cjs --update-env\n',
    );
    process.exit(2);
  }

  console.log('\nOK — seed data is in this database. If the site is still empty:');
  console.log('  1) Confirm frontend NEXT_PUBLIC_API_BASE_URL points at this API');
  console.log('  2) Log out / log in again as owner@demo-co.local / Admin123!');
  console.log('  3) Browser Network tab: check /api/companies/.../hr/employees status');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
