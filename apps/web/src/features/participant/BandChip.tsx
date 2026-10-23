import { BmiBand } from '@org/contracts';
import { BAND_CLASS, bandLabel } from './participant.display';

/** A small, restrained colour chip for the BMI category (never alarming). */
export function BandChip({ band }: { band: BmiBand | null }) {
  const className = band ? BAND_CLASS[band] : 'band--na';
  return <span className={`band ${className}`}>{bandLabel(band)}</span>;
}
