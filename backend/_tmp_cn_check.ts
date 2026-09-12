import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './src/generated/prisma/client';
import { config } from 'dotenv';
config();

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'saas_erp',
  connectionLimit: 3,
  allowPublicKeyRetrieval: true,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const inv = await prisma.salesInvoice.findFirst({
    where: { invoiceNumber: 'INV-978604' },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      balanceDue: true,
      status: true,
    },
  });
  console.log('invoice', JSON.stringify(inv));
  if (!inv) return;
  const notes = await prisma.salesCreditNote.findMany({
    where: { salesInvoiceId: inv.id },
    select: {
      id: true,
      creditNoteNumber: true,
      status: true,
      totalAmount: true,
      reason: true,
    },
  });
  console.log('notes_for_invoice', JSON.stringify(notes));
  const recent = await prisma.salesCreditNote.findMany({
    orderBy: { issuedOn: 'desc' },
    take: 5,
    select: {
      id: true,
      creditNoteNumber: true,
      salesInvoiceId: true,
      status: true,
      totalAmount: true,
    },
  });
  console.log('recent_notes', JSON.stringify(recent));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
