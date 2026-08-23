/**
 * Idempotent Chart of Accounts + default account mapping for a company.
 * Mirrors GlService.ensureChartOfAccounts without Nest DI.
 */
import type { PrismaClient } from '../src/generated/prisma/client';
import { STANDARD_COA, coaLevel } from './coa-catalog';

export async function seedCompanyChartOfAccounts(
  prisma: PrismaClient,
  companyId: string,
): Promise<{ accountCount: number; mappingCreated: boolean }> {
  const sorted = [...STANDARD_COA].sort((a, b) => {
    const levelDiff = coaLevel(a.code) - coaLevel(b.code);
    if (levelDiff !== 0) return levelDiff;
    const lenDiff = a.code.length - b.code.length;
    if (lenDiff !== 0) return lenDiff;
    return a.code.localeCompare(b.code);
  });

  const codeToId = new Map<string, string>();
  const existing = await prisma.glAccount.findMany({
    where: { companyId },
    select: { id: true, code: true },
  });
  for (const row of existing) {
    codeToId.set(row.code, row.id);
  }

  for (const def of sorted) {
    const parentId = def.parentCode
      ? (codeToId.get(def.parentCode) ?? null)
      : null;
    if (def.parentCode && !parentId) {
      throw new Error(
        `Missing parent GL account ${def.parentCode} for ${def.code}`,
      );
    }

    const level = coaLevel(def.code);
    const data = {
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      accountType: def.type,
      normalBalance: def.normalBalance ?? 'DEBIT',
      parentId,
      level,
      isPostable: def.isPostable,
      isContra: def.isContra ?? false,
      isActive: true,
      sortOrder: Number(def.code) || 0,
    };

    const currentId = codeToId.get(def.code);
    if (currentId) {
      await prisma.glAccount.update({
        where: { id: currentId },
        data,
      });
    } else {
      const created = await prisma.glAccount.create({
        data: {
          companyId,
          code: def.code,
          ...data,
        },
      });
      codeToId.set(def.code, created.id);
    }
  }

  const existingMapping = await prisma.companyAccountMapping.findUnique({
    where: { companyId },
  });
  if (!existingMapping) {
    await prisma.companyAccountMapping.create({
      data: { companyId },
    });
  }

  return {
    accountCount: codeToId.size,
    mappingCreated: !existingMapping,
  };
}
