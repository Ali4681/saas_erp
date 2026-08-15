import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

type SequenceKey =
  | 'quote'
  | 'receipt'
  | 'creditNote'
  | 'contract'
  | 'purchaseOrder'
  | 'supplierPayment'
  | 'stockCount';

const DEFAULT_PREFIX: Record<SequenceKey, string> = {
  quote: 'QT',
  receipt: 'RCP',
  creditNote: 'CN',
  contract: 'CT',
  purchaseOrder: 'PO',
  supplierPayment: 'SP',
  stockCount: 'SC',
};

/** Accepts base or extended Prisma clients / interactive transactions. */
type SettingsClient = {
  companySettings: {
    findUnique: (args: { where: { companyId: string } }) => Promise<{
      invoicePrefix: string;
      nextInvoiceNumber: bigint;
      settings: Prisma.JsonValue;
    } | null>;
    create: (args: { data: { companyId: string } }) => Promise<{
      invoicePrefix: string;
      nextInvoiceNumber: bigint;
      settings: Prisma.JsonValue;
    }>;
    update: (args: {
      where: { companyId: string };
      data: {
        nextInvoiceNumber?: bigint;
        settings?: Prisma.InputJsonValue;
      };
    }) => Promise<unknown>;
  };
};

@Injectable()
export class DocumentNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /** Atomically allocate next sales invoice number from company_settings. */
  async nextInvoiceNumber(
    tx: SettingsClient,
    companyId: string,
  ): Promise<string> {
    const settings = await tx.companySettings.findUnique({
      where: { companyId },
    });
    if (!settings) {
      await tx.companySettings.create({ data: { companyId } });
      return 'INV-0001';
    }
    const next = settings.nextInvoiceNumber;
    await tx.companySettings.update({
      where: { companyId },
      data: { nextInvoiceNumber: next + 1n },
    });
    const padded = next.toString().padStart(4, '0');
    return `${settings.invoicePrefix}-${padded}`;
  }

  /** Allocate other document numbers from CompanySettings.settings JSON bag. */
  async nextSequence(
    tx: SettingsClient,
    companyId: string,
    key: SequenceKey,
  ): Promise<string> {
    let settings = await tx.companySettings.findUnique({
      where: { companyId },
    });
    if (!settings) {
      settings = await tx.companySettings.create({ data: { companyId } });
    }

    const bag =
      settings.settings &&
      typeof settings.settings === 'object' &&
      !Array.isArray(settings.settings)
        ? ({ ...(settings.settings as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};

    const sequences =
      bag.docSequences &&
      typeof bag.docSequences === 'object' &&
      !Array.isArray(bag.docSequences)
        ? ({
            ...(bag.docSequences as Record<string, unknown>),
          } as Record<string, { prefix?: string; next?: number }>)
        : {};

    const current = sequences[key] ?? {};
    const prefix = current.prefix ?? DEFAULT_PREFIX[key];
    const next = Number(current.next ?? 1);
    sequences[key] = { prefix, next: next + 1 };
    bag.docSequences = sequences;

    await tx.companySettings.update({
      where: { companyId },
      data: { settings: bag as Prisma.InputJsonValue },
    });

    return `${prefix}-${String(next).padStart(4, '0')}`;
  }
}
