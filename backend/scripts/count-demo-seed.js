require('dotenv').config();
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('../dist/generated/prisma/client');

const companyId =
  process.env.COMPANY_ID || '019f989b-6d98-7429-80ae-32d0c1cbf7f9';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    }),
  });

  const rows = [
    ['users', await prisma.user.count()],
    ['companyUsers', await prisma.companyUser.count({ where: { companyId } })],
    ['crmContacts', await prisma.crmContact.count({ where: { companyId } })],
    ['suppliers', await prisma.supplier.count({ where: { companyId } })],
    ['items', await prisma.item.count({ where: { companyId } })],
    ['warehouses', await prisma.warehouse.count({ where: { companyId } })],
    ['stockCounts', await prisma.stockCount.count({ where: { companyId } })],
    [
      'stockCountsOpen',
      await prisma.stockCount.count({
        where: {
          companyId,
          status: { in: ['DRAFT', 'IN_PROGRESS', 'SUBMITTED'] },
        },
      }),
    ],
    ['salesInvoices', await prisma.salesInvoice.count({ where: { companyId } })],
    ['supplierBills', await prisma.supplierBill.count({ where: { companyId } })],
    [
      'billsPayable',
      await prisma.supplierBill.count({
        where: {
          companyId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          balanceDue: { gt: 0 },
        },
      }),
    ],
    [
      'connectedProjects',
      await prisma.connectedProject.count({ where: { companyId } }),
    ],
    ['externalOrders', await prisma.externalOrder.count()],
    ['sandboxCompanies', await prisma.sandboxCompany.count()],
    ['sandboxItems', await prisma.sandboxItem.count()],
    [
      'paymentMethods',
      await prisma.companyPaymentMethod.count({ where: { companyId } }),
    ],
    ['workProjects', await prisma.workProject.count({ where: { companyId } })],
    ['employees', await prisma.employee.count({ where: { companyId } })],
  ];

  for (const [name, count] of rows) {
    console.log(`${name.padEnd(22)} ${count}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
