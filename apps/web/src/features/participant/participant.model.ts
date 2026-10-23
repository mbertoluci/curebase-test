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

const num = (s: string): number => (s.trim() === '' ? NaN : Number(s));

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
  // Display the rounded BMI, but classify on the unrounded value via the shared
  // rule - the same the API uses on read, so the preview band never disagrees
  // with the stored record.
  const rawBmi = computeBmi(weight, height, values.unit);
  return {
    bmi: roundBmi(rawBmi),
    band: classifyMeasurements(
      weight,
      height,
      values.unit,
      Number.isFinite(age) ? age : 0,
    ),
  };
}

/** Convert the current measurements when the unit toggle flips. */
export function convertToUnit(values: FormValues, to: Unit): FormValues {
  if (values.unit === to) return values;
  const weight = num(values.weight);
  const height = heightValue(values);
  if (!Number.isFinite(weight) || !Number.isFinite(height)) {
    return {
      ...values,
      unit: to,
      weight: '',
      heightCm: '',
      feet: '',
      inches: '',
    };
  }
  const converted = convertMeasurements(weight, height, values.unit, to);
  const next: FormValues = {
    ...values,
    unit: to,
    weight: String(converted.weight),
  };
  if (to === Unit.US) {
    const { feet, inches } = inchesToFeetInches(converted.height);
    next.feet = String(feet);
    next.inches = String(inches);
    next.heightCm = '';
  } else {
    next.heightCm = String(converted.height);
    next.feet = '';
    next.inches = '';
  }
  return next;
}

export type FieldErrors = Partial<Record<keyof FormValues | 'form', string>>;

/** Client-side validation (mirrors the server; the server remains authoritative). */
export function validate(values: FormValues): {
  input?: CreateParticipantInput;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const email = normalizeEmail(values.email);
  if (!values.firstName.trim()) errors.firstName = 'First name is required';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
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
