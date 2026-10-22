/**
 * BMI computation and classification - the clinical heart of the app.
 *
 * One canonical implementation per the CDC formulas given in the brief:
 *   - US:     BMI = 703 * weight(lb) / height(in)^2
 *   - METRIC: BMI = weight(kg) / height(m)^2  (height entered in cm)
 *
 * The number is always derived server-side from the stored inputs and recomputed
 * on every update, so it can never drift out of sync with weight/height.
 */
import { ADULT_AGE_THRESHOLD, Unit } from './units';

/** Adult WHO classification bands. */
export enum BmiBand {
  UNDERWEIGHT = 'UNDERWEIGHT',
  NORMAL = 'NORMAL',
  OVERWEIGHT = 'OVERWEIGHT',
  OBESE = 'OBESE',
}

/** Upper bound (exclusive) of each band, in order. Classify on the raw value. */
const BAND_THRESHOLDS: ReadonlyArray<{ band: BmiBand; below: number }> = [
  { band: BmiBand.UNDERWEIGHT, below: 18.5 },
  { band: BmiBand.NORMAL, below: 25 },
  { band: BmiBand.OVERWEIGHT, below: 30 },
];

const US_FACTOR = 703;

/**
 * Compute a raw (unrounded) BMI from measurements in the given unit system.
 * @throws RangeError if height is non-positive (callers validate bounds first).
 */
export function computeBmi(weight: number, height: number, unit: Unit): number {
  if (height <= 0) {
    throw new RangeError('height must be greater than zero');
  }
  if (unit === Unit.US) {
    return (US_FACTOR * weight) / height ** 2; // weight lb, height in
  }
  const heightMeters = height / 100; // cm -> m
  return weight / heightMeters ** 2; // weight kg
}

/** Round a BMI value for storage/display (default 1 decimal place). */
export function roundBmi(bmi: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round((bmi + Number.EPSILON) * factor) / factor;
}

/**
 * Classify a BMI into an adult WHO band. Returns `null` under the adult age
 * threshold, where adult bands are clinically meaningless (pediatric percentile
 * curves are intentionally out of scope). Classification uses the raw value.
 */
export function classifyBmi(bmi: number, age: number): BmiBand | null {
  if (age < ADULT_AGE_THRESHOLD) return null;
  for (const { band, below } of BAND_THRESHOLDS) {
    if (bmi < below) return band;
  }
  return BmiBand.OBESE;
}

/**
 * Classify straight from measurements, on the unrounded BMI. This is the single
 * rule both the API (deriving the band on read) and the web preview call, so a
 * BMI rounding cannot flip the band. Callers validate measurement precision
 * before persistence/preview so both use the same inputs. The stored 2-decimal
 * bmiValue is for display and filtering,
 * never for classification.
 */
export function classifyMeasurements(
  weight: number,
  height: number,
  unit: Unit,
  age: number,
): BmiBand | null {
  return classifyBmi(computeBmi(weight, height, unit), age);
}

/** Human-readable label for a band (used by the UI). */
export const BMI_BAND_LABELS: Record<BmiBand, string> = {
  [BmiBand.UNDERWEIGHT]: 'Underweight',
  [BmiBand.NORMAL]: 'Normal',
  [BmiBand.OVERWEIGHT]: 'Overweight',
  [BmiBand.OBESE]: 'Obese',
};
