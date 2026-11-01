/**
 * Unit systems and measurement bounds shared by the API and the web app.
 *
 * Measurements are stored *as entered* together with their unit (per the given
 * schema's `unit` column), so every consumer needs the same conversion and
 * plausibility rules. Keeping them here is the single source of truth.
 */

/**
 * Unit system a measurement was entered in.
 *
 * Modelled as a const object + string union (not a TS `enum`) so the value is
 * structurally `'US' | 'METRIC'`. That matches what Prisma generates for its own
 * enum, so a value read from the database flows into this type with no cast,
 * while `@IsEnum(Unit)` and `Unit.US` still work.
 */
export const Unit = {
  US: 'US',
  METRIC: 'METRIC',
} as const;
export type Unit = (typeof Unit)[keyof typeof Unit];

/** Inclusive numeric range. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * Plausibility bounds. These reject impossible input at the boundary (a typo
 * like height 5500) instead of clamping it. US height is in inches, US weight
 * in pounds; METRIC height is in centimetres, weight in kilograms.
 */
export const MEASUREMENT_BOUNDS: Record<
  Unit,
  { weight: Range; height: Range }
> = {
  [Unit.US]: {
    weight: { min: 4, max: 1100 }, // lb
    height: { min: 20, max: 100 }, // in
  },
  [Unit.METRIC]: {
    weight: { min: 2, max: 500 }, // kg
    height: { min: 50, max: 250 }, // cm
  },
};

/** Age is a plain integer per the schema; derive-from-DOB was out of scope. */
export const AGE_BOUNDS: Range = { min: 0, max: 120 };

/**
 * Bounds for the numeric BMI filter. BMI is non-negative, and the stored column
 * is Decimal(6,2), so no real record can carry a value outside this range.
 * Bounding minBmi/maxBmi at the DTO boundary rejects nonsense (a negative value,
 * 1e6) while still covering every value the column can actually hold.
 */
export const BMI_VALUE_BOUNDS: Range = { min: 0, max: 9999.99 };

/** Below this age the adult WHO bands are not meaningful. */
export const ADULT_AGE_THRESHOLD = 18;

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/** Whether a measurement can be stored at 2dp without changing its value. */
export function hasMeasurementPrecision(value: number): boolean {
  return Number.isFinite(value) && round(value, 2) === value;
}

/**
 * Convert a {weight, height} pair between unit systems, rounding to sensible
 * entry precision (whole cm, 0.1 for everything else) so repeated UI toggles
 * do not drift the value.
 */
export function convertMeasurements(
  weight: number,
  height: number,
  from: Unit,
  to: Unit,
): { weight: number; height: number } {
  if (from === to) return { weight, height };

  if (from === Unit.US && to === Unit.METRIC) {
    return {
      weight: round(weight / LB_PER_KG, 1), // lb -> kg
      height: round(height * CM_PER_IN, 0), // in -> cm
    };
  }
  // METRIC -> US
  return {
    weight: round(weight * LB_PER_KG, 1), // kg -> lb
    height: round(height / CM_PER_IN, 1), // cm -> in
  };
}

/** Which input a domain error belongs to, so consumers route by field, not by
 * parsing the message text. */
export type MeasurementErrorField = 'weight' | 'height' | 'age' | 'unit';

export interface MeasurementError {
  field: MeasurementErrorField;
  message: string;
}

/**
 * Business-rule validation for a measurement set. Returns a list of field-tagged
 * errors (empty = valid). This is the *domain* rule (per-unit plausibility +
 * age), separate from the structural/type checks done at the DTO boundary, and
 * is shared so the web and the API agree on what counts as plausible. Each error
 * carries its `field` so callers map to the right input without string-matching
 * the message.
 */
export function measurementErrors(
  weight: number,
  height: number,
  unit: Unit,
  age: number,
): MeasurementError[] {
  const errors: MeasurementError[] = [];
  const bounds = MEASUREMENT_BOUNDS[unit];
  if (!bounds) {
    errors.push({
      field: 'unit',
      message: `unit must be one of: ${Object.values(Unit).join(', ')}`,
    });
    return errors;
  }
  const weightUnit = unit === Unit.US ? 'lb' : 'kg';
  const heightUnit = unit === Unit.US ? 'in' : 'cm';
  if (!(weight >= bounds.weight.min && weight <= bounds.weight.max)) {
    errors.push({
      field: 'weight',
      message: `weight must be between ${bounds.weight.min} and ${bounds.weight.max} ${weightUnit}`,
    });
  } else if (!hasMeasurementPrecision(weight)) {
    errors.push({
      field: 'weight',
      message: 'weight must have at most 2 decimal places',
    });
  }
  if (!(height >= bounds.height.min && height <= bounds.height.max)) {
    errors.push({
      field: 'height',
      message: `height must be between ${bounds.height.min} and ${bounds.height.max} ${heightUnit}`,
    });
  } else if (!hasMeasurementPrecision(height)) {
    errors.push({
      field: 'height',
      message: 'height must have at most 2 decimal places',
    });
  }
  if (!Number.isInteger(age) || age < AGE_BOUNDS.min || age > AGE_BOUNDS.max) {
    errors.push({
      field: 'age',
      message: `age must be a whole number between ${AGE_BOUNDS.min} and ${AGE_BOUNDS.max}`,
    });
  }
  return errors;
}

/** US height is entered as feet + inches; storage uses total inches. */
export function feetInchesToInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}

/** Split total inches back into feet + inches for display. */
export function inchesToFeetInches(totalInches: number): {
  feet: number;
  inches: number;
} {
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: round(totalInches - feet * 12, 2) };
}
