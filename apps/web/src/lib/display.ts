import { BMI_BAND_LABELS, BmiBand, Unit } from '@org/contracts';

/** CSS modifier class per band (defined in global.css). Restrained, not alarming. */
export const BAND_CLASS: Record<BmiBand, string> = {
  [BmiBand.UNDERWEIGHT]: 'band--underweight',
  [BmiBand.NORMAL]: 'band--normal',
  [BmiBand.OVERWEIGHT]: 'band--overweight',
  [BmiBand.OBESE]: 'band--obese',
};

export function bandLabel(band: BmiBand | null): string {
  return band ? BMI_BAND_LABELS[band] : 'N/A';
}

/** BMI is stored to 2dp but shown to 1dp (display rounding only). */
export function formatBmi(value: number): string {
  return value.toFixed(1);
}

export function unitLabel(unit: Unit): string {
  return unit === Unit.US ? 'US' : 'Metric';
}

export function weightUnit(unit: Unit): string {
  return unit === Unit.US ? 'lb' : 'kg';
}

export function heightLabel(unit: Unit, height: number): string {
  if (unit === Unit.US) {
    const feet = Math.floor(height / 12);
    const inches = Math.round((height - feet * 12) * 10) / 10;
    return `${feet}'${inches}"`;
  }
  return `${height} cm`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
