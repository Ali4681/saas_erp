/**
 * Re-point company memberships from custom *\_CASHIER / *\_SALES_REP / *\_POS_MARKETER
 * roles onto the matching system roles, and ensure POS permissions exist.
 *
 * Usage: npx tsx scripts/fix-pos-portal-roles.ts
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const PORTAL = ['CASHIER', 'SALES_REP', 'POS_MARKETER'] as const;

const POS_OPS: Array<[string, string]> = [
  ['pos', 'invoice_create'],
  ['pos', 'quote_create'],
  ['pos', 'quote_delete'],
  ['pos', 'quote_convert'],
  ['pos', 'invoice_send_whatsapp'],
  ['pos', 'quote_send_whatsapp'],
];

function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 5,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(parseDatabaseUrl(url)),
  });

  try {
    for (const [module, action] of POS_OPS) {
      const code = `${module}.${action}`;
      await prisma.permission.upsert({
        where: { code },
        update: { module, action },
        create: { code, module, action, description: `${action} ${module}` },
      });
    }

    for (const code of PORTAL) {
      const system = await prisma.role.findFirst({
        where: { code, isSystem: true, scope: 'TENANT' },
      });
      if (!system) {
        console.warn('missing system role', code);
        continue;
      }

      const posPerms = await prisma.permission.findMany({
        where: { code: { startsWith: 'pos.' } },
      });
      const basePerms = await prisma.permission.findMany({
        where: {
          code: { in: ['companies.read', 'attachments.read', 'hr.self'] },
        },
      });
      const allPermIds = [...posPerms, ...basePerms].map((p) => p.id);
      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: system.id } });
        if (allPermIds.length) {
          await tx.rolePermission.createMany({
            data: allPermIds.map((permissionId) => ({
              roleId: system.id,
              permissionId,
            })),
          });
        }
      });
      console.log('synced system', code, allPermIds.length, 'perms');

      const customs = await prisma.role.findMany({
        where: {
          isSystem: false,
          scope: 'TENANT',
          OR: [
            { code: { endsWith: `_${code}` } },
            { code },
          ],
        },
      });

      for (const custom of customs) {
        const updated = await prisma.companyUser.updateMany({
          where: { roleId: custom.id },
          data: { roleId: system.id },
        });
        console.log(
          `moved ${updated.count} user(s) from ${custom.code} → ${system.code}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
