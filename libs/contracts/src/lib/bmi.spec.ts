import { BmiBand, classifyBmi, computeBmi, roundBmi } from './bmi';
import { convertMeasurements, Unit } from './units';

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
