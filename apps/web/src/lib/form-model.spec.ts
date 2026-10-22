import { BmiBand, ParticipantView, Unit } from '@org/contracts';
import {
  convertToUnit,
  emptyForm,
  fromView,
  livePreview,
  validate,
} from './form-model';

describe('form-model', () => {
  const usForm = {
    ...emptyForm(),
    firstName: 'Peter',
    lastName: 'Pan',
    email: 'peter@example.com',
    unit: Unit.US,
    weight: '85',
    feet: '4',
    inches: '6', // 54 in total
    age: '30',
  };

  describe('validate', () => {
    it('builds an API input from valid US values (feet+inches -> total inches)', () => {
      const { input, errors } = validate(usForm);
      expect(errors).toEqual({});
      expect(input).toMatchObject({
        weight: 85,
        height: 54,
        unit: Unit.US,
        age: 30,
      });
    });

    it('reports required fields and a bad email', () => {
      const { input, errors } = validate(emptyForm());
      expect(input).toBeUndefined();
      expect(errors.firstName).toBeDefined();
      expect(errors.email).toBeDefined();
    });

    it('applies the shared domain bounds (implausible height)', () => {
      const { errors } = validate({ ...usForm, feet: '0', inches: '5' }); // 5 in
      expect(errors.feet).toMatch(/height must be between/);
    });
  });

  describe('convertToUnit', () => {
    it('converts US measurements to metric when the unit flips', () => {
      const next = convertToUnit(usForm, Unit.METRIC);
      expect(next.unit).toBe(Unit.METRIC);
      expect(Number(next.weight)).toBeCloseTo(38.6, 1); // 85 lb -> kg
      expect(Number(next.heightCm)).toBe(137); // 54 in -> cm
      expect(next.feet).toBe('');
    });
  });

  describe('livePreview', () => {
    it('keeps the raw band when the displayed BMI rounds to 25', () => {
      expect(
        livePreview({
          ...usForm,
          unit: Unit.METRIC,
          weight: '72.24',
          heightCm: '170',
        }),
      ).toEqual({ bmi: 25, band: BmiBand.NORMAL });
    });

    it('rejects excess precision instead of previewing a band that changes on save', () => {
      const values = {
        ...usForm,
        unit: Unit.METRIC,
        weight: '72.249',
        heightCm: '170',
      };
      expect(livePreview(values)).toBeNull();
      expect(validate(values).errors.weight).toMatch(/2 decimal places/);
      expect(
        livePreview({ ...values, weight: '72.24', heightCm: '170.001' }),
      ).toBeNull();
    });

    it('preserves stored US height precision when reopening a participant', () => {
      const view = {
        id: 'p1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@x.com',
        phone: null,
        weight: 174.3,
        height: 70.01,
        unit: Unit.US,
        age: 30,
        bmiValue: 25,
        bmiBand: BmiBand.NORMAL,
        createdAt: '',
        updatedAt: '',
      };
      const values = fromView(view);
      expect(validate(values).input?.height).toBe(70.01);
      expect(livePreview(values)?.band).toBe(BmiBand.NORMAL);
    });
    it('computes BMI and band from the current values', () => {
      const preview = livePreview(usForm);
      expect(preview?.bmi).toBeCloseTo(20.5, 1);
      expect(preview?.band).toBe('NORMAL');
    });

    it('is null until weight and height are usable', () => {
      expect(livePreview(emptyForm())).toBeNull();
    });

    it('returns a null band for an under-18 participant', () => {
      const preview = livePreview({ ...usForm, age: '15' });
      expect(preview?.band).toBeNull();
    });
  });

  describe('convertToUnit', () => {
    it('clears the fields when the current values are not numeric', () => {
      const next = convertToUnit(
        { ...emptyForm(), unit: Unit.US },
        Unit.METRIC,
      );
      expect(next.unit).toBe(Unit.METRIC);
      expect(next.weight).toBe('');
      expect(next.heightCm).toBe('');
    });
  });

  describe('validate (missing height)', () => {
    it('flags a missing US height on the feet field', () => {
      const errors = validate({ ...usForm, feet: '', inches: '' }).errors;
      expect(errors.feet).toBe('Height is required');
    });

    it('flags a missing metric height on the cm field', () => {
      const metric = {
        ...usForm,
        unit: Unit.METRIC,
        feet: '',
        inches: '',
        heightCm: '',
      };
      expect(validate(metric).errors.heightCm).toBe('Height is required');
    });
  });

  describe('fromView', () => {
    const base: ParticipantView = {
      id: '1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@x.com',
      phone: null,
      weight: 70,
      height: 175,
      unit: Unit.METRIC,
      age: 36,
      bmiValue: 22.86,
      bmiBand: BmiBand.NORMAL,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('prefills metric height as cm', () => {
      const values = fromView(base);
      expect(values.heightCm).toBe('175');
      expect(values.weight).toBe('70');
    });

    it('prefills US height as feet + inches', () => {
      const values = fromView({ ...base, unit: Unit.US, height: 70 });
      expect(values.feet).toBe('5');
      expect(values.inches).toBe('10');
    });
  });

  describe('convertToUnit (metric -> US)', () => {
    it('splits the converted height into feet + inches and clears cm', () => {
      const next = convertToUnit(
        { ...emptyForm(), unit: Unit.METRIC, weight: '80', heightCm: '180' },
        Unit.US,
      );
      expect(next.unit).toBe(Unit.US);
      expect(Number(next.feet)).toBeGreaterThan(0);
      expect(next.heightCm).toBe('');
    });
  });

  describe('validate (form-level error)', () => {
    it('routes an invalid-unit domain error to errors.form', () => {
      // Finite weight/height/age so validation reaches the domain rule, with a bad unit.
      const errors = validate({
        ...usForm,
        unit: 'XX' as Unit,
        heightCm: '175',
      }).errors;
      expect(errors.form).toBeDefined();
    });
  });
});
