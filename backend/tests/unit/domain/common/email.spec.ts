import { Email } from '../../../../src/domain/common/Email';
import { DomainError } from '../../../../src/domain/common/exceptions/DomainError';

describe('Email Value Object', () => {
  it('normalises to lowercase', () => {
    expect(Email.create('Foo@Example.COM').value).toBe('foo@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(Email.create('  a@b.co  ').value).toBe('a@b.co');
  });

  it.each(['', '   ', 'not-an-email', '@no-user.com', 'no-at-sign.com', 'a@b'])(
    'rejects invalid input: %s',
    (bad) => {
      expect(() => Email.create(bad)).toThrow(DomainError);
    },
  );

  it('rejects non-string values', () => {
    expect(() => Email.create(42 as unknown as string)).toThrow(DomainError);
  });

  it('rejects emails longer than 255 chars', () => {
    const local = 'a'.repeat(250);
    expect(() => Email.create(`${local}@b.com`)).toThrow(DomainError);
  });

  it('compares by value', () => {
    expect(Email.create('A@b.com').equals(Email.create('a@b.com'))).toBe(true);
    expect(Email.create('a@b.com').equals(Email.create('a@c.com'))).toBe(false);
  });
});