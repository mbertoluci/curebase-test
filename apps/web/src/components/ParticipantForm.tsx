'use client';

import { ParticipantView, Unit } from '@org/contracts';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { formatBmi, weightUnit } from '../lib/display';
import {
  convertToUnit,
  emptyForm,
  FieldErrors,
  fromView,
  FormValues,
  livePreview,
  validate,
} from '../lib/form-model';
import { BandChip } from './BandChip';

interface Props {
  editing: ParticipantView | null;
  onSaved: (view: ParticipantView, action: 'created' | 'updated') => void;
  onCancelEdit: () => void;
  onRequestEdit: (view: ParticipantView) => void;
}

export function ParticipantForm({
  editing,
  onSaved,
  onCancelEdit,
  onRequestEdit,
}: Props) {
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<ParticipantView | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Keep the form in sync with the record being edited (or reset on cancel).
  useEffect(() => {
    setValues(editing ? fromView(editing) : emptyForm());
    setErrors({});
    setServerError(null);
    setDuplicate(null);
  }, [editing]);

  const preview = livePreview(values);
  const set = (field: keyof FormValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const { input, errors: validationErrors } = validate(values);
    setErrors(validationErrors);
    if (!input) return;

    setSubmitting(true);
    setServerError(null);
    setDuplicate(null);
    try {
      const saved = editing
        ? await api.update(editing.id, input)
        : await api.create(input);
      onSaved(saved, editing ? 'updated' : 'created');
      if (!editing) setValues(emptyForm());
    } catch (error) {
      await handleError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setServerError('Something went wrong. Please try again.');
      return;
    }
    if (error.code === 'EMAIL_ALREADY_EXISTS' && !editing) {
      setErrors((prev) => ({
        ...prev,
        email: 'A participant with this email already exists',
      }));
      // Offer to edit the existing record.
      try {
        const page = await api.list({
          search: values.email.trim(),
          pageSize: 1,
        });
        setDuplicate(page.data[0] ?? null);
      } catch {
        /* non-fatal: the inline message is enough */
      }
      return;
    }
    if (Array.isArray(error.details)) {
      setServerError((error.details as string[]).join(' · '));
      return;
    }
    setServerError(error.message);
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <div className="form__header">
        <h2>{editing ? 'Edit participant' : 'New participant'}</h2>
        {editing && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancelEdit}
          >
            Cancel edit
          </button>
        )}
      </div>

      <fieldset>
        <legend>Demographics</legend>
        <div className="grid grid--2">
          <Field id="firstName" label="First name" error={errors.firstName}>
            <input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set('firstName')(e.target.value)}
            />
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName}>
            <input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set('lastName')(e.target.value)}
            />
          </Field>
          <Field id="email" label="Email" error={errors.email}>
            <input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          </Field>
          <Field id="phone" label="Phone (optional)" error={errors.phone}>
            <input
              id="phone"
              value={values.phone}
              onChange={(e) => set('phone')(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>Measurements</legend>

        <div className="units" role="radiogroup" aria-label="Unit system">
          {[Unit.US, Unit.METRIC].map((u) => (
            <label
              key={u}
              className={`chip-radio ${values.unit === u ? 'is-active' : ''}`}
            >
              <input
                type="radio"
                name="unit"
                checked={values.unit === u}
                onChange={() => setValues((prev) => convertToUnit(prev, u))}
              />
              {u === Unit.US ? 'US (lb, ft/in)' : 'Metric (kg, cm)'}
            </label>
          ))}
        </div>

        <div className="grid grid--3">
          <Field
            id="weight"
            label={`Weight (${weightUnit(values.unit)})`}
            error={errors.weight}
          >
            <input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              value={values.weight}
              onChange={(e) => set('weight')(e.target.value)}
            />
          </Field>

          {values.unit === Unit.US ? (
            <Field id="feet" label="Height (ft / in)" error={errors.feet}>
              <div className="inline">
                <input
                  id="feet"
                  type="number"
                  min="0"
                  placeholder="ft"
                  value={values.feet}
                  onChange={(e) => set('feet')(e.target.value)}
                />
                <input
                  aria-label="inches"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="in"
                  value={values.inches}
                  onChange={(e) => set('inches')(e.target.value)}
                />
              </div>
            </Field>
          ) : (
            <Field id="heightCm" label="Height (cm)" error={errors.heightCm}>
              <input
                id="heightCm"
                type="number"
                step="0.1"
                min="0"
                value={values.heightCm}
                onChange={(e) => set('heightCm')(e.target.value)}
              />
            </Field>
          )}

          <Field id="age" label="Age (years)" error={errors.age}>
            <input
              id="age"
              type="number"
              min="0"
              max="120"
              value={values.age}
              onChange={(e) => set('age')(e.target.value)}
            />
          </Field>
        </div>

        <div className="bmi" aria-live="polite">
          {preview ? (
            <>
              <span className="bmi__value">BMI {formatBmi(preview.bmi)}</span>
              <BandChip band={preview.band} />
            </>
          ) : (
            <span className="bmi__hint">
              Enter weight and height to see the BMI
            </span>
          )}
        </div>
        <p className="disclaimer">
          BMI is a screening estimate, not a diagnosis. It does not account for
          muscle, body composition or pregnancy.
        </p>
      </fieldset>

      {duplicate && (
        <div className="notice notice--warn">
          This person already exists.{' '}
          <button
            type="button"
            className="link"
            onClick={() => onRequestEdit(duplicate)}
          >
            Edit their record
          </button>
        </div>
      )}
      {serverError && <div className="notice notice--error">{serverError}</div>}

      <div className="form__actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : 'Save participant'}
        </button>
      </div>
    </form>
  );
}

/** Labelled field wrapper: visible label + accessible error wiring. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
