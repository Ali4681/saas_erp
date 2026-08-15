/**
 * Saudi National ID / Iqama only (MOI / Absher format).
 * - Citizen (هوية وطنية): exactly 10 digits, starts with 1, Saudi checksum
 * - Resident (إقامة): exactly 10 digits, starts with 2, Saudi checksum
 */

export type SaudiIdentityKind = 'CITIZEN' | 'RESIDENT';

export function normalizeSaudiIdentity(value: string): string {
  return value.replace(/[\s-]+/g, '').replace(/[٠-٩]/g, (d) =>
    String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)),
  );
}

/** Official Saudi ID checksum (same scheme used for national ID and Iqama). */
function saudiIdChecksumOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  return sum % 10 === 0;
}

export function isValidSaudiIdentity(
  value: string,
  kind?: SaudiIdentityKind,
): boolean {
  const id = normalizeSaudiIdentity(value);
  // Saudi only: 10 ASCII digits, prefix 1 (citizen) or 2 (resident)
  if (!/^[12]\d{9}$/.test(id)) return false;
  if (kind === 'CITIZEN' && id[0] !== '1') return false;
  if (kind === 'RESIDENT' && id[0] !== '2') return false;
  return saudiIdChecksumOk(id);
}

export function assertValidSaudiIdentity(
  value: string,
  kind: SaudiIdentityKind,
): string {
  const id = normalizeSaudiIdentity(value);
  if (!isValidSaudiIdentity(id, kind)) {
    if (kind === 'CITIZEN') {
      throw new Error(
        'Invalid Saudi national ID: exactly 10 digits starting with 1, with a valid Saudi checksum',
      );
    }
    throw new Error(
      'Invalid Saudi residency (Iqama) number: exactly 10 digits starting with 2, with a valid Saudi checksum',
    );
  }
  return id;
}
