import {
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  normalizeEmail,
} from './participant';

describe('normalizeEmail', () => {
  it('trims and lowercases so case/whitespace cannot create duplicates', () => {
    expect(normalizeEmail('  ADA@Example.COM ')).toBe('ada@example.com');
    expect(normalizeEmail('a@b.com')).toBe('a@b.com');
  });
});

describe('default sort', () => {
  it('is the one shared default both apps use', () => {
    expect(DEFAULT_SORT_FIELD).toBe('createdAt');
    expect(DEFAULT_SORT_DIR).toBe('desc');
  });
});
