import { ParticipantNotFoundError } from '../../features/participants/participants.error';
import { Throws } from './throws.decorator';

describe('Throws', () => {
  it('builds a decorator from the given error classes without throwing', () => {
    const decorate = Throws(ParticipantNotFoundError);
    expect(typeof decorate).toBe('function');
    // Applying it to a method descriptor should be a no-op that succeeds.
    class Sample {
      handler() {
        return null;
      }
    }
    expect(() =>
      decorate(Sample.prototype, 'handler', { value: Sample.prototype.handler }),
    ).not.toThrow();
  });
});
