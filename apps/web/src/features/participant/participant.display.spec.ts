import { BmiBand, Unit } from '@org/contracts';
import {
  bandLabel,
  formatBmi,
  formatDate,
  heightLabel,
  unitLabel,
  weightUnit,
} from './participant.display';

describe('display helpers', () => {
  it('labels BMI bands, and N/A when null', () => {
    expect(bandLabel(BmiBand.OBESE)).toBe('Obese');
    expect(bandLabel(null)).toBe('N/A');
  });

  it('formats BMI to one decimal', () => {
    expect(formatBmi(22.857)).toBe('22.9');
    expect(formatBmi(28)).toBe('28.0');
  });

  it('labels units and weight units', () => {
    expect(unitLabel(Unit.US)).toBe('US');
    expect(unitLabel(Unit.METRIC)).toBe('Metric');
    expect(weightUnit(Unit.US)).toBe('lb');
    expect(weightUnit(Unit.METRIC)).toBe('kg');
  });

  it('formats height per unit', () => {
    expect(heightLabel(Unit.US, 70)).toBe(`5'10"`);
    expect(heightLabel(Unit.METRIC, 175)).toBe('175 cm');
  });

  it('formats a date without throwing', () => {
    expect(typeof formatDate('2026-01-01T00:00:00.000Z')).toBe('string');
  });
});
