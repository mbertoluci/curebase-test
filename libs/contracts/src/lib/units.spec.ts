import {
  AGE_BOUNDS,
  convertMeasurements,
  feetInchesToInches,
  inchesToFeetInches,
  hasMeasurementPrecision,
  measurementErrors,
  MEASUREMENT_BOUNDS,
  Unit,
} from './units';

describe('measurement precision', () => {
  it.each([72.24, 70.01, 50, 500])('preserves storable value %s', (value) => {
    expect(hasMeasurementPrecision(value)).toBe(true);
  });

  it.each([72.249, 6.246, 50.014, NaN, Infinity])(
    'rejects value %s',
    (value) => {
      expect(hasMeasurementPrecision(value)).toBe(false);
    },
  );

  it('rejects precision that would change persisted measurements', () => {
    expect(measurementErrors(72.249, 170.001, Unit.METRIC, 30)).toEqual([
      { field: 'weight', message: 'weight must have at most 2 decimal places' },
      { field: 'height', message: 'height must have at most 2 decimal places' },
    ]);
  });
});

describe('measurementErrors', () => {
  it('returns no errors for a plausible US measurement', () => {
    expect(measurementErrors(180, 70, Unit.US, 30)).toEqual([]);
  });

  it('returns no errors for a plausible metric measurement', () => {
    expect(measurementErrors(80, 180, Unit.METRIC, 30)).toEqual([]);
  });

  it('flags an unknown unit', () => {
    const [first] = measurementErrors(80, 180, 'XX' as Unit, 30);
    expect(first).toMatchObject({ field: 'unit' });
    expect(first.message).toMatch(/unit must be one of/);
  });

  it('flags out-of-range weight, height and age, each tagged with its field', () => {
    const errors = measurementErrors(5000, 5000, Unit.METRIC, 200);
    expect(errors).toEqual([
      { field: 'weight', message: expect.stringMatching(/between 2 and 500 kg/) },
      {
        field: 'height',
        message: expect.stringMatching(/between 50 and 250 cm/),
      },
      {
        field: 'age',
        message: expect.stringMatching(/whole number between 0 and 120/),
      },
    ]);
  });

  it('rejects a non-integer age', () => {
    expect(
      measurementErrors(80, 180, Unit.METRIC, 30.5).some(
        (e) => e.field === 'age',
      ),
    ).toBe(true);
  });

  it('uses lb/in wording for US bounds', () => {
    const errors = measurementErrors(5000, 5000, Unit.US, 30);
    expect(errors[0].message).toMatch(/lb/);
    expect(errors[1].message).toMatch(/in/);
  });
});

describe('convertMeasurements', () => {
  it('converts metric -> US', () => {
    const us = convertMeasurements(80, 180, Unit.METRIC, Unit.US);
    expect(us.weight).toBeCloseTo(176.4, 1); // kg -> lb
    expect(us.height).toBeCloseTo(70.9, 1); // cm -> in
  });

  it('is a no-op for equal units', () => {
    expect(convertMeasurements(80, 180, Unit.US, Unit.US)).toEqual({
      weight: 80,
      height: 180,
    });
  });
});

describe('height helpers', () => {
  it('feetInchesToInches sums feet and inches', () => {
    expect(feetInchesToInches(5, 10)).toBe(70);
  });

  it('inchesToFeetInches splits total inches', () => {
    expect(inchesToFeetInches(70.01)).toEqual({ feet: 5, inches: 10.01 });
    expect(inchesToFeetInches(70)).toEqual({ feet: 5, inches: 10 });
    expect(inchesToFeetInches(54)).toEqual({ feet: 4, inches: 6 });
  });
});

describe('bounds constants', () => {
  it('expose the documented ranges', () => {
    expect(MEASUREMENT_BOUNDS[Unit.US].weight).toEqual({ min: 4, max: 1100 });
    expect(MEASUREMENT_BOUNDS[Unit.METRIC].height).toEqual({
      min: 50,
      max: 250,
    });
    expect(AGE_BOUNDS).toEqual({ min: 0, max: 120 });
  });
});
