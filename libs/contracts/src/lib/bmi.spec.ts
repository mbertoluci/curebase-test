import {
  BmiBand,
  classifyBmi,
  classifyMeasurements,
  computeBmi,
  roundBmi,
} from './bmi';
import { convertMeasurements, MEASUREMENT_BOUNDS, Unit } from './units';

describe('computeBmi', () => {
  it('matches the US examples from the brief', () => {
    // Peter Pan: 85 lb, 54 in -> 20.5
    expect(roundBmi(computeBmi(85, 54, Unit.US))).toBe(20.5);
    // Patrick: 195 lb, 70 in -> 28.0
    expect(roundBmi(computeBmi(195, 70, Unit.US))).toBe(28);
  });

  it('computes the metric formula (kg / m^2) from height in cm', () => {
    // 70 kg, 175 cm -> 22.857... -> 22.9
    expect(roundBmi(computeBmi(70, 175, Unit.METRIC))).toBe(22.9);
  });

  it('agrees across unit systems for the same real body', () => {
    const metric = computeBmi(70, 175, Unit.METRIC);
    const us = computeBmi(154.324, 68.8976, Unit.US); // ~70 kg, ~175 cm
    expect(Math.abs(metric - us)).toBeLessThan(0.1);
  });

  it('throws on non-positive height instead of returning Infinity', () => {
    expect(() => computeBmi(70, 0, Unit.METRIC)).toThrow(RangeError);
  });

  it('keeps the BMI of the widest plausible pair within bmi_value Decimal(6,2)', () => {
    // bmi_value is Decimal(6,2) (max 9999.99). The heaviest + shortest valid
    // measurements must still fit, or an INSERT would overflow. This locks the
    // bounds <-> column invariant: widening the bounds too far fails here.
    for (const unit of [Unit.US, Unit.METRIC]) {
      const { weight, height } = MEASUREMENT_BOUNDS[unit];
      const maxBmi = roundBmi(computeBmi(weight.max, height.min, unit), 2);
      expect(maxBmi).toBeGreaterThan(0);
      expect(maxBmi).toBeLessThan(10000);
    }
  });
});

describe('classifyBmi', () => {
  it('uses floor-inclusive WHO bands on the raw value', () => {
    expect(classifyBmi(18.49, 30)).toBe(BmiBand.UNDERWEIGHT);
    expect(classifyBmi(18.5, 30)).toBe(BmiBand.NORMAL);
    expect(classifyBmi(24.99, 30)).toBe(BmiBand.NORMAL);
    expect(classifyBmi(25, 30)).toBe(BmiBand.OVERWEIGHT); // boundary -> overweight
    expect(classifyBmi(29.99, 30)).toBe(BmiBand.OVERWEIGHT);
    expect(classifyBmi(30, 30)).toBe(BmiBand.OBESE);
  });

  it('returns null below the adult age threshold (no pediatric bands)', () => {
    expect(classifyBmi(22, 17)).toBeNull();
    expect(classifyBmi(22, 18)).toBe(BmiBand.NORMAL);
  });

  it('returns null for a non-finite BMI instead of silently reporting OBESE', () => {
    // NaN/Infinity fail every `< below` check and would fall through to OBESE.
    expect(classifyBmi(NaN, 30)).toBeNull();
    expect(classifyBmi(Infinity, 30)).toBeNull();
  });
});

describe('classifyMeasurements', () => {
  it('classifies on the unrounded BMI, so a boundary rounding cannot flip the band', () => {
    // 72.24 kg / 170 cm -> BMI 24.9965: NORMAL. It rounds to 25.00, which
    // classifyBmi on the rounded value would wrongly call OVERWEIGHT; the band
    // must follow the raw value.
    expect(roundBmi(computeBmi(72.24, 170, Unit.METRIC), 2)).toBe(25);
    expect(classifyBmi(25, 30)).toBe(BmiBand.OVERWEIGHT);
    expect(classifyMeasurements(72.24, 170, Unit.METRIC, 30)).toBe(
      BmiBand.NORMAL,
    );
  });

  it('inherits the null-under-18 rule', () => {
    expect(classifyMeasurements(72.24, 170, Unit.METRIC, 17)).toBeNull();
  });
});

describe('convertMeasurements', () => {
  it('round-trips US <-> METRIC within entry precision', () => {
    const metric = convertMeasurements(180, 71, Unit.US, Unit.METRIC);
    expect(metric.weight).toBeCloseTo(81.6, 1); // lb -> kg
    expect(metric.height).toBe(180); // 71 in -> ~180 cm

    const back = convertMeasurements(
      metric.weight,
      metric.height,
      Unit.METRIC,
      Unit.US,
    );
    expect(back.weight).toBeCloseTo(180, 0);
    expect(back.height).toBeCloseTo(71, 0);
  });

  it('is a no-op when the units are equal', () => {
    expect(convertMeasurements(80, 170, Unit.METRIC, Unit.METRIC)).toEqual({
      weight: 80,
      height: 170,
    });
  });
});
