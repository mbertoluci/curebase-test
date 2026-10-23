import { BmiBand } from '@org/contracts';
import { cx } from '../../shared/ui';
import { BAND_CLASS, bandLabel } from './participant.display';

/** A small, restrained colour chip for the BMI category (never alarming). */
export function BandChip({ band }: { band: BmiBand | null }) {
  const color = band ? BAND_CLASS[band] : 'bg-muted';
  // Stable hook for tests/styling that doesn't depend on the utility classes.
  const key = band ? band.toLowerCase() : 'na';
  return (
    <span
      data-band={key}
      className={cx(
        'inline-block rounded-full px-2 py-0.5 text-[0.74rem] font-semibold text-white',
        color,
      )}
    >
      {bandLabel(band)}
    </span>
  );
}
