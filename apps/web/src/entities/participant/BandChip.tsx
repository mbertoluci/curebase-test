import { BmiBand } from '@org/contracts';
import { cx } from '../../shared/ui';
import { BAND_CLASS, bandLabel } from './display';

/** A small tinted label for the BMI category (accent text on a soft tint). */
export function BandChip({ band }: { band: BmiBand | null }) {
  const color = band ? BAND_CLASS[band] : 'bg-muted/15 text-muted';
  // Stable hook for tests/styling that doesn't depend on the utility classes.
  const key = band ? band.toLowerCase() : 'na';
  return (
    <span
      data-band={key}
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
        color,
      )}
    >
      {bandLabel(band)}
    </span>
  );
}
