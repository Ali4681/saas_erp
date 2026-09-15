/**
 * Upsert POS role permissions + كاشير / مندوب مبيعات / مسوق system roles
 * without running the full seed.
 *
 * Usage: npx tsx scripts/ensure-pos-permissions.ts
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const POS_OPS: Array<[string, string]> = [
  ['pos', 'invoice_create'],
  ['pos', 'quick_invoice'],
  ['pos', 'quote_create'],
  ['pos', 'quote_delete'],
  ['pos', 'quote_convert'],
  ['pos', 'invoice_send_whatsapp'],
  ['pos', 'quote_send_whatsapp'],
];

const POS_CODES = POS_OPS.map(([m, a]) => `${m}.${a}`);

const POS_PORTAL_BASE = [
  'companies.read',
  'attachments.read',
  'hr.self',
  ...POS_CODES,
];

const ROLES: Array<{
  code: string;
  name: string;
  financialProfile: string;
  permissions: string[];
}> = [
  {
    code: 'CASHIER',
    name: 'كاشير',
    financialProfile: 'CASHIER',
    permissions: POS_PORTAL_BASE,
  },
  {
    code: 'SALES_REP',
    name: 'مندوب مبيعات',
    financialProfile: 'SALES_DELIVERY',
    permissions: POS_PORTAL_BASE,
  },
  {
    code: 'POS_MARKETER',
    name: 'مسوق',
    financialProfile: 'NONE',
    permissions: POS_PORTAL_BASE,
  },
];

const OWNER_LIKE = ['COMPANY_OWNER', 'COMPANY_ADMIN', 'PLATFORM_SUPER_ADMIN'];

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
        update: { module, action, description: `${action} ${module}` },
        create: {
          code,
          module,
          action,
          description: `${action} ${module}`,
        },
      });
      console.log('permission', code);
    }

    for (const roleDef of ROLES) {
      const role = await prisma.role.upsert({
        where: { code: roleDef.code },
        update: {
          name: roleDef.name,
          isSystem: true,
          scope: 'TENANT',
          financialProfile: roleDef.financialProfile as never,
        },
        create: {
          code: roleDef.code,
          name: roleDef.name,
          isSystem: true,
          scope: 'TENANT',
          financialProfile: roleDef.financialProfile as never,
        },
      });
      const permissionIds: string[] = [];
      for (const code of roleDef.permissions) {
        const p = await prisma.permission.findUnique({ where: { code } });
        if (!p) throw new Error(`Missing permission ${code}`);
        permissionIds.push(p.id);
      }
      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      });
      console.log('role synced', roleDef.code, permissionIds.length);
    }

    for (const roleCode of OWNER_LIKE) {
      const role = await prisma.role.findUnique({ where: { code: roleCode } });
      if (!role) continue;
      for (const code of POS_CODES) {
        const p = await prisma.permission.findUniqueOrThrow({ where: { code } });
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: p.id,
            },
          },
          update: {},
          create: { roleId: role.id, permissionId: p.id },
        });
      }
      console.log('owner-like +pos', roleCode);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
