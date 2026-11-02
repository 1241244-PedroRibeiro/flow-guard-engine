import { PersonName } from '../../../../src/domain/common/PersonName';
import { DomainError } from '../../../../src/domain/common/exceptions/DomainError';

describe('PersonName Value Object', () => {
  it('trims and preserves case', () => {
    const name = PersonName.create('  Alice  ', ' Smith ');
    expect(name.firstName).toBe('Alice');
    expect(name.lastName).toBe('Smith');
    expect(name.fullName()).toBe('Alice Smith');
  });

  it.each([
    ['', 'Doe'],
    ['John', ''],
    ['   ', 'Doe'],
    ['John', '   '],
  ])('rejects blank names (%p, %p)', (fn, ln) => {
    expect(() => PersonName.create(fn, ln)).toThrow(DomainError);
  });

  it('rejects names longer than 75 chars', () => {
    expect(() => PersonName.create('a'.repeat(76), 'Doe')).toThrow(DomainError);
  });

  it('compares by value', () => {
    expect(PersonName.create('A', 'B').equals(PersonName.create('A', 'B'))).toBe(true);
    expect(PersonName.create('A', 'B').equals(PersonName.create('A', 'C'))).toBe(false);
  });
});