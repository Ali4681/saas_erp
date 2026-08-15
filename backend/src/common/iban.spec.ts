import {
  assertValidSaudiIban,
  isValidSaudiIban,
  normalizeIban,
} from './iban';

describe('saudi IBAN', () => {
  const sample = 'SA0380000000608010167519';

  it('accepts a known valid Saudi IBAN', () => {
    expect(isValidSaudiIban(sample)).toBe(true);
    expect(assertValidSaudiIban(` ${sample} `)).toBe(sample);
  });

  it('rejects non-SA country codes', () => {
    expect(isValidSaudiIban('DE89370400440532013000')).toBe(false);
  });

  it('rejects wrong length / spam', () => {
    expect(isValidSaudiIban('SA00')).toBe(false);
    expect(isValidSaudiIban('SA00SPAMSPAMSPAMSPAM0000')).toBe(false);
    expect(isValidSaudiIban('SA038000000060801016751')).toBe(false); // 23
  });

  it('normalizes spaces', () => {
    expect(normalizeIban('SA03 8000 0000 6080 1016 7519')).toBe(sample);
  });
});
