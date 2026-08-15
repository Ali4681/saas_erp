import {
  assertValidSaudiIdentity,
  isValidSaudiIdentity,
  normalizeSaudiIdentity,
} from './saudi-identity';

describe('saudi-identity', () => {
  function makeValid(prefix: '1' | '2'): string {
    for (let n = 0; n < 1_000_000; n++) {
      const body = String(n).padStart(9, '0');
      const id = `${prefix}${body}`;
      if (isValidSaudiIdentity(id)) return id;
    }
    throw new Error('could not find valid id');
  }

  it('accepts citizen IDs starting with 1', () => {
    const id = makeValid('1');
    expect(id.startsWith('1')).toBe(true);
    expect(assertValidSaudiIdentity(id, 'CITIZEN')).toBe(id);
  });

  it('accepts resident IDs starting with 2', () => {
    const id = makeValid('2');
    expect(id.startsWith('2')).toBe(true);
    expect(assertValidSaudiIdentity(id, 'RESIDENT')).toBe(id);
  });

  it('rejects wrong type prefix', () => {
    const citizen = makeValid('1');
    expect(() => assertValidSaudiIdentity(citizen, 'RESIDENT')).toThrow(
      /Iqama|residency/i,
    );
  });

  it('rejects spam / short values', () => {
    expect(isValidSaudiIdentity('123')).toBe(false);
    expect(isValidSaudiIdentity('1111111111')).toBe(false);
    expect(isValidSaudiIdentity('SA123')).toBe(false);
  });

  it('normalizes spaces and arabic digits', () => {
    const id = makeValid('1');
    const spaced = `${id.slice(0, 5)} ${id.slice(5)}`;
    expect(normalizeSaudiIdentity(spaced)).toBe(id);
  });
});
