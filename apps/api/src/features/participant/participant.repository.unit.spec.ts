import {
  isEmailUniqueTarget,
  uniqueTargetText,
} from './participant.repository';

/**
 * Pure unit tests for the P2002 target mapping - no database. They pin the
 * decision the integration suite exercises only through the live email index:
 * which `meta.target` shapes become an email 409 and which fall through to a
 * generic 500. If the fallback policy (empty target -> email) ever changes,
 * these are the tests that must change with it.
 */
describe('P2002 unique-target mapping', () => {
  describe('uniqueTargetText', () => {
    it('joins a column-array target', () => {
      expect(uniqueTargetText(['email'])).toBe('email');
      expect(uniqueTargetText(['userId', 'tenantId'])).toBe('userId,tenantId');
    });

    it('passes a string index name through', () => {
      expect(uniqueTargetText('profiles_email_active_key')).toBe(
        'profiles_email_active_key',
      );
    });

    it('normalizes an unsurfaced target to the empty string', () => {
      expect(uniqueTargetText(undefined)).toBe('');
      expect(uniqueTargetText(null)).toBe('');
      expect(uniqueTargetText([])).toBe('');
      expect(uniqueTargetText(42)).toBe('');
    });
  });

  describe('isEmailUniqueTarget', () => {
    it('maps the active-email index (column or index name, any case)', () => {
      expect(isEmailUniqueTarget('email')).toBe(true);
      expect(isEmailUniqueTarget('profiles_email_active_key')).toBe(true);
      expect(isEmailUniqueTarget('EMAIL')).toBe(true);
    });

    it('maps an unsurfaced (empty) target to email - the documented fallback', () => {
      expect(isEmailUniqueTarget('')).toBe(true);
    });

    it('does NOT map a named non-email unique (e.g. the userId key)', () => {
      expect(isEmailUniqueTarget('userId')).toBe(false);
      expect(isEmailUniqueTarget('user_id')).toBe(false);
      expect(isEmailUniqueTarget('profiles_user_id_key')).toBe(false);
    });
  });
});
