/**
 * Ensure a cashier user has a linked Employee + active PosCashier on POS MAIN.
 *
 *   cd backend
 *   npx tsx scripts/ensure-cashier-employee.ts
 *
 * Optional env:
 *   COMPANY_SLUG=demo-co
 *   CASHIER_EMAIL=cashier@demo-co.local
 *   CASHIER_PASSWORD=Admin123!
 *   POS_CODE=MAIN
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
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
    password:
      process.env.DATABASE_PASSWORD ?? decodeURIComponent(u.password || ''),
    database:
      process.env.DATABASE_NAME || u.pathname.replace(/^\//, '') || 'saas_erp',
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  };
}

const COMPANY_SLUG = process.env.COMPANY_SLUG || 'demo-co';
const CASHIER_EMAIL = (
  process.env.CASHIER_EMAIL || 'cashier@demo-co.local'
).trim().toLowerCase();
const CASHIER_PASSWORD = process.env.CASHIER_PASSWORD || 'Admin123!';
const POS_CODE = process.env.POS_CODE || 'MAIN';

const cashierPerms = {
  priceOverride: false,
  priceOverrideMaxPct: 0,
  discounts: false,
  discountMaxPct: 5,
  voidBeforeSave: true,
  returns: false,
  creditSales: false,
  giftCards: false,
  openCashDrawer: false,
  holdRetrieve: true,
  holdSeeOthers: false,
  shiftClose: false,
  reprint: true,
  customerAssign: true,
  multiCurrency: true,
};

async function main() {
  const db = dbConfig();
  console.log(`DB ${db.user}@${db.host}:${db.port}/${db.database}`);
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(db) });

  try {
    const company = await prisma.company.findUnique({
      where: { slug: COMPANY_SLUG },
    });
    if (!company) {
      throw new Error(`Company slug=${COMPANY_SLUG} not found`);
    }

    const role = await prisma.role.findUnique({ where: { code: 'CASHIER' } });
    if (!role) {
      throw new Error('Role CASHIER missing — run npm run seed first');
    }

    const passwordHash = await bcrypt.hash(CASHIER_PASSWORD, 12);
    let user = await prisma.user.findUnique({ where: { email: CASHIER_EMAIL } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: CASHIER_EMAIL,
          fullName: 'Cashier',
          passwordHash,
          status: 'ACTIVE',
          isPlatformAdmin: false,
        },
      });
      console.log(`Created user ${CASHIER_EMAIL}`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
          fullName: user.fullName || 'Cashier',
        },
      });
      console.log(`Reset password for ${CASHIER_EMAIL}`);
    }

    const membership = await prisma.companyUser.findFirst({
      where: { companyId: company.id, userId: user.id },
    });
    if (!membership) {
      await prisma.companyUser.create({
        data: {
          companyId: company.id,
          userId: user.id,
          roleId: role.id,
          status: 'ACTIVE',
        },
      });
      console.log('Created company membership with role CASHIER');
    } else if (membership.roleId !== role.id || membership.status !== 'ACTIVE') {
      await prisma.companyUser.update({
        where: { id: membership.id },
        data: { roleId: role.id, status: 'ACTIVE' },
      });
      console.log('Updated membership → CASHIER / ACTIVE');
    }

    let employee = await prisma.employee.findFirst({
      where: { companyId: company.id, userId: user.id },
    });
    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { employeeNumber: 'EMP-CASH' },
            { email: CASHIER_EMAIL },
          ],
        },
      });
      if (employee) {
        employee = await prisma.employee.update({
          where: { id: employee.id },
          data: {
            userId: user.id,
            userKey: user.id,
            email: CASHIER_EMAIL,
            employmentStatus: 'ACTIVE',
          },
        });
        console.log(`Linked existing employee ${employee.employeeNumber}`);
      } else {
        employee = await prisma.employee.create({
          data: {
            companyId: company.id,
            userId: user.id,
            userKey: user.id,
            employeeNumber: 'EMP-CASH',
            fullName: user.fullName || 'Cashier',
            email: CASHIER_EMAIL,
            jobTitle: 'Cashier',
            hireDate: new Date(),
            employmentStatus: 'ACTIVE',
            basicSalary: '4500.00',
            currency: 'SAR',
          },
        });
        console.log(`Created employee EMP-CASH → ${employee.id}`);
      }
    } else {
      console.log(`Employee already linked: ${employee.employeeNumber}`);
    }

    let pos = await prisma.pointOfSale.findFirst({
      where: { companyId: company.id, code: POS_CODE },
    });
    if (!pos) {
      pos = await prisma.pointOfSale.create({
        data: {
          companyId: company.id,
          code: POS_CODE,
          name: 'Main POS',
          status: 'ACTIVE',
          locationNote: 'Front counter',
        },
      });
      console.log(`Created POS ${POS_CODE}`);
    }

    const existingCashier = await prisma.posCashier.findFirst({
      where: {
        companyId: company.id,
        pointOfSaleId: pos.id,
        userId: user.id,
      },
    });
    if (existingCashier) {
      await prisma.posCashier.update({
        where: { id: existingCashier.id },
        data: {
          employeeId: employee.id,
          displayName: employee.fullName,
          status: 'ACTIVE',
          permissionsJson: cashierPerms,
        },
      });
      console.log('Updated PosCashier assignment');
    } else {
      await prisma.posCashier.create({
        data: {
          companyId: company.id,
          pointOfSaleId: pos.id,
          employeeId: employee.id,
          userId: user.id,
          displayName: employee.fullName,
          status: 'ACTIVE',
          permissionsJson: cashierPerms,
        },
      });
      console.log('Created PosCashier assignment');
    }

    console.log('\n--- Send to client ---');
    console.log(`Email:    ${CASHIER_EMAIL}`);
    console.log(`Password: ${CASHIER_PASSWORD}`);
    console.log(`Company:  ${company.displayName} (${company.slug})`);
    console.log(`Portal:   /c/${company.id}/me`);
    console.log(`POS:      /c/${company.id}/me/pos`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
