import { BMI_BAND_LABELS, BmiBand, Unit } from '@org/contracts';

/** Tinted label classes per band (tint background + accent text), iOS-style. */
export const BAND_CLASS: Record<BmiBand, string> = {
  [BmiBand.UNDERWEIGHT]: 'bg-band-under/15 text-band-under',
  [BmiBand.NORMAL]: 'bg-band-normal/15 text-band-normal',
  [BmiBand.OVERWEIGHT]: 'bg-band-over/15 text-band-over',
  [BmiBand.OBESE]: 'bg-band-obese/15 text-band-obese',
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
    let feet = Math.floor(height / 12);
    let inches = Math.round((height - feet * 12) * 10) / 10;
    // Rounding the remainder to 1dp can reach a full 12 (e.g. 71.95 in rounds to
    // 12.0): carry it into the feet so the label never shows an invalid 5'12".
    if (inches >= 12) {
      feet += 1;
      inches = 0;
    }
    return `${feet}'${inches}"`;
  }
  return `${height} cm`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatDate(iso: string): string {
  // Hand-formatted from UTC components (no Intl/locale) so the output is byte-
  // identical on the server and the client regardless of each runtime's ICU
  // build - the SSR markup hydrates without a mismatch, and the audit time is
  // unambiguous across time zones.
  const d = new Date(iso);
  const hour24 = d.getUTCHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = String(d.getUTCMinutes()).padStart(2, '0');
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${hour12}:${minute} ${meridiem}`;
}
