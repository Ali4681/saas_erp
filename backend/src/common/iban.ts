/**
 * Saudi IBAN (ISO 13616) — country SA, length 24, mod-97 checksum.
 * Structure: SA + 2 check digits + 20-digit BBAN (bank + account).
 */

export function normalizeIban(iban: string): string {
  return iban.replace(/[\s-]+/g, '').toUpperCase();
}

function mod97(numeric: string): number {
  let checksum = 0;
  for (const ch of numeric) {
    checksum = (checksum * 10 + Number(ch)) % 97;
  }
  return checksum;
}

function ibanMod97Ok(normalized: string): boolean {
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let expanded = '';
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    expanded +=
      code >= 65 && code <= 90 ? String(code - 55) : ch; // A=10 … Z=35
  }
  return mod97(expanded) === 1;
}

/** Generic IBAN (any country) — kept for non-HR uses if needed. */
export function isValidIban(iban: string): boolean {
  const normalized = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) return false;
  if (normalized.length < 15 || normalized.length > 34) return false;
  return ibanMod97Ok(normalized);
}

/** Saudi IBAN only: SA + 22 digits (total 24), valid checksum. */
export function isValidSaudiIban(iban: string): boolean {
  const normalized = normalizeIban(iban);
  if (!/^SA\d{22}$/.test(normalized)) return false;
  return ibanMod97Ok(normalized);
}

export function assertValidIban(iban: string): string {
  const normalized = normalizeIban(iban);
  if (!normalized) {
    throw new Error('IBAN is required');
  }
  if (!isValidIban(normalized)) {
    throw new Error('Invalid IBAN (failed format or checksum)');
  }
  return normalized;
}

export function assertValidSaudiIban(iban: string): string {
  const normalized = normalizeIban(iban);
  if (!normalized) {
    throw new Error('IBAN is required');
  }
  if (!isValidSaudiIban(normalized)) {
    throw new Error(
      'Invalid Saudi IBAN: must be 24 characters starting with SA (e.g. SA03…), digits only after SA, with a valid checksum',
    );
  }
  return normalized;
}
