import {
  BmiBand,
  classifyMeasurements,
  computeBmi,
  convertMeasurements,
  CreateParticipantInput,
  feetInchesToInches,
  inchesToFeetInches,
  hasMeasurementPrecision,
  measurementErrors,
  normalizeEmail,
  ParticipantView,
  roundBmi,
  Unit,
} from '@org/contracts';
import type { NormalizedError } from '@/shared/api-error';

/**
 * The form's raw string state (inputs are strings) plus the pure functions that
 * turn it into a validated API payload, convert between unit systems, and
 * compute the live BMI preview. Keeping this logic here (not in the component)
 * makes it unit-testable and keeps the view declarative.
 */
export interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  unit: Unit;
  weight: string; // lb (US) or kg (METRIC)
  heightCm: string; // METRIC
  feet: string; // US
  inches: string; // US
  age: string;
}

export const emptyForm = (): FormValues => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  unit: Unit.US,
  weight: '',
  heightCm: '',
  feet: '',
  inches: '',
  age: '',
});

/** Prefill the form from an existing record (edit mode). */
export function fromView(view: ParticipantView): FormValues {
  const base: FormValues = {
    ...emptyForm(),
    firstName: view.firstName,
    lastName: view.lastName,
    email: view.email,
    phone: view.phone ?? '',
    unit: view.unit,
    weight: String(view.weight),
    age: String(view.age),
  };
  if (view.unit === Unit.US) {
    const { feet, inches } = inchesToFeetInches(view.height);
    base.feet = String(feet);
    base.inches = String(inches);
  } else {
    base.heightCm = String(view.height);
  }
  return base;
}

/** Total height in the form's current unit (inches for US, cm for METRIC). */
function heightValue(values: FormValues): number {
  if (values.unit === Unit.US) {
    return feetInchesToInches(num(values.feet), num(values.inches));
  }
  return num(values.heightCm);
}

const num = (s: string): number => (s.trim() === '' ? Number.NaN : Number(s));

/** Live BMI preview, or null while the inputs aren't usable yet. */
export function livePreview(
  values: FormValues,
): { bmi: number; band: BmiBand | null } | null {
  const weight = num(values.weight);
  const height = heightValue(values);
  const age = num(values.age);
  if (
    !(weight > 0) ||
    !(height > 0) ||
    !hasMeasurementPrecision(weight) ||
    !hasMeasurementPrecision(height)
  )
    return null;
  // Round the preview BMI to 2 decimals - the SAME rounding the API stores
  // (roundBmi(raw, 2)) - so the one-decimal display matches the table for the
  // same inputs (otherwise a preview rounded to 1dp and the stored 2dp value can
  // show a different tenth). Classify on the unrounded value via the shared rule,
  // the same the API uses on read, so the preview band never disagrees with the
  // stored record.
  const rawBmi = computeBmi(weight, height, values.unit);
  return {
    bmi: roundBmi(rawBmi, 2),
    band: classifyMeasurements(
      weight,
      height,
      values.unit,
      Number.isFinite(age) ? age : 0,
    ),
  };
}

/**
 * Convert the current measurements when the unit toggle flips. Weight and height
 * are converted *independently*: an incomplete field is blanked without wiping
 * the other, valid measurement. (Exact round-trips are preserved by the form,
 * which restores the untouched original on toggle-back instead of re-converting.)
 */
export function convertToUnit(values: FormValues, to: Unit): FormValues {
  if (values.unit === to) return values;
  const from = values.unit;
  const weight = num(values.weight);
  const height = heightValue(values);
  const next: FormValues = { ...values, unit: to };

  next.weight = Number.isFinite(weight)
    ? String(convertMeasurements(weight, 0, from, to).weight)
    : '';

  if (Number.isFinite(height)) {
    const convertedHeight = convertMeasurements(0, height, from, to).height;
    if (to === Unit.US) {
      const { feet, inches } = inchesToFeetInches(convertedHeight);
      next.feet = String(feet);
      next.inches = String(inches);
      next.heightCm = '';
    } else {
      next.heightCm = String(convertedHeight);
      next.feet = '';
      next.inches = '';
    }
  } else {
    next.feet = '';
    next.inches = '';
    next.heightCm = '';
  }
  return next;
}

export type FieldErrors = Partial<Record<keyof FormValues | 'form', string>>;

/** The server field names the create/update endpoint can report errors on
 * (the DTO fields). Passed to the shared error normalizer as its allow-list. */
export const PARTICIPANT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'weight',
  'height',
  'unit',
  'age',
] as const;
export type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];

/** Field names shared verbatim between the API and the form state. */
const DIRECT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'weight',
  'age',
] as const;

/**
 * Project a normalized API error onto the form's field-error shape. Most fields
 * map by name; `height` is a single server field that the form renders as two
 * controls (feet/inches in US, cm in metric), so its message attaches to the
 * visible one, and `unit` (no dedicated control) falls to the form-level banner
 * alongside any other non-field message.
 */
export function toFormErrors(
  error: NormalizedError<ParticipantField>,
  unit: Unit,
): FieldErrors {
  const { fieldErrors, formError } = error;
  const out: FieldErrors = {};
  for (const field of DIRECT_FIELDS) {
    const message = fieldErrors[field];
    if (message) out[field] = message;
  }
  if (fieldErrors.height) {
    out[unit === Unit.US ? 'feet' : 'heightCm'] = fieldErrors.height;
  }
  const banner = [formError, fieldErrors.unit].filter(Boolean).join(' · ');
  if (banner) out.form = banner;
  return out;
}

/** Client-side validation (mirrors the server; the server remains authoritative). */
export function validate(values: FormValues): {
  input?: CreateParticipantInput;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const email = normalizeEmail(values.email);
  if (!values.firstName.trim()) errors.firstName = 'First name is required';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required';
  // Linear, backtracking-free shape check (the server's IsEmail is authoritative):
  // local@label(.label)+, where each label excludes the dot delimiter so there is
  // no ambiguous overlap to backtrack over.
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email))
    errors.email = 'Enter a valid email';

  const weight = num(values.weight);
  const height = heightValue(values);
  const age = num(values.age);

  if (!Number.isFinite(weight)) errors.weight = 'Weight is required';
  if (!Number.isFinite(height)) {
    const key = values.unit === Unit.US ? 'feet' : 'heightCm';
    errors[key] = 'Height is required';
  }
  if (!Number.isInteger(age)) errors.age = 'Age is required';

  // Domain plausibility (shared rule). Attach to a sensible field.
  if (
    Number.isFinite(weight) &&
    Number.isFinite(height) &&
    Number.isInteger(age)
  ) {
    const domain = measurementErrors(weight, height, values.unit, age);
    for (const { field, message } of domain) {
      if (field === 'weight') errors.weight = message;
      else if (field === 'height')
        errors[values.unit === Unit.US ? 'feet' : 'heightCm'] = message;
      else if (field === 'age') errors.age = message;
      else errors.form = message; // 'unit'
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors: {},
    input: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email,
      phone: values.phone.trim() || null,
      weight,
      height,
      unit: values.unit,
      age,
    },
  };
}
