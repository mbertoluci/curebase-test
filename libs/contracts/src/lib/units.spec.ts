import {
  AGE_BOUNDS,
  convertMeasurements,
  feetInchesToInches,
  inchesToFeetInches,
  measurementErrors,
  MEASUREMENT_BOUNDS,
  Unit,
} from './units';

describe('measurementErrors', () => {
  it('returns no errors for a plausible US measurement', () => {
    expect(measurementErrors(180, 70, Unit.US, 30)).toEqual([]);
  });

  it('returns no errors for a plausible metric measurement', () => {
    expect(measurementErrors(80, 180, Unit.METRIC, 30)).toEqual([]);
  });

  it('flags an unknown unit', () => {
    expect(measurementErrors(80, 180, 'XX' as Unit, 30)[0]).toMatch(
      /unit must be one of/,
    );
  });

  it('flags out-of-range weight, height and age with unit-aware messages', () => {
    const errors = measurementErrors(5000, 5000, Unit.METRIC, 200);
    expect(errors).toEqual([
      expect.stringMatching(/weight must be between 2 and 500 kg/),
      expect.stringMatching(/height must be between 50 and 250 cm/),
      expect.stringMatching(/age must be a whole number between 0 and 120/),
    ]);
  });

  it('rejects a non-integer age', () => {
    expect(
      measurementErrors(80, 180, Unit.METRIC, 30.5).some((m) =>
        m.startsWith('age'),
      ),
    ).toBe(true);
  });

  it('uses lb/in wording for US bounds', () => {
    const errors = measurementErrors(5000, 5000, Unit.US, 30);
    expect(errors[0]).toMatch(/lb/);
    expect(errors[1]).toMatch(/in/);
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
