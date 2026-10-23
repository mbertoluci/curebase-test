import {
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  normalizeEmail,
  PARTICIPANT_SORT_FIELDS,
  SORT_DIRECTIONS,
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

describe('sort allow-lists', () => {
  it('expose the fields and directions the DTO validates against', () => {
    expect(PARTICIPANT_SORT_FIELDS).toEqual([
      'createdAt',
      'bmiValue',
      'age',
      'lastName',
    ]);
    expect(SORT_DIRECTIONS).toEqual(['asc', 'desc']);
    expect(PARTICIPANT_SORT_FIELDS).toContain(DEFAULT_SORT_FIELD);
    expect(SORT_DIRECTIONS).toContain(DEFAULT_SORT_DIR);
  });
});
