'use client';

import {
  AGE_BOUNDS,
  normalizeEmail,
  ParticipantView,
  Unit,
} from '@org/contracts';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../shared/http';
import { Button, Field, Input, Notice, cardSurface, cx } from '../../shared/ui';
import { api } from './participant.api';
import { formatBmi, weightUnit } from './participant.display';
import {
  convertToUnit,
  emptyForm,
  FieldErrors,
  fromView,
  FormValues,
  livePreview,
  validate,
} from './participant.model';
import { BandChip } from './BandChip';

interface Props {
  editing: ParticipantView | null;
  onSaved: (view: ParticipantView, action: 'created' | 'updated') => void;
  onCancelEdit: () => void;
  onRequestEdit: (view: ParticipantView) => void;
}

const LEGEND =
  'mb-2.5 text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-muted';

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
  const submitInFlight = useRef(false);
  // Latest email shown in the form, readable from an async handler after the
  // render-time closure has gone stale (the duplicate lookup below).
  const emailRef = useRef(values.email);
  useEffect(() => {
    emailRef.current = values.email;
  }, [values.email]);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitInFlight.current) return; // synchronous guard, including before React renders
    const { input, errors: validationErrors } = validate(values);
    setErrors(validationErrors);
    if (!input) return;

    submitInFlight.current = true;
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
      submitInFlight.current = false;
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
      // Offer to edit the existing record. `search` is a substring match, so
      // we must pick the row whose email matches exactly (the uniqueness the
      // server rejected on) - never just the first substring hit, which could
      // be a different person.
      try {
        // Compare on the normalized email (the form the server stores and
        // de-duplicates on), so a case difference can't hide the real match.
        const query = normalizeEmail(values.email);
        const page = await api.list({ search: query });
        // The user may have corrected the email while this lookup was in
        // flight (e.g. typed a new one and kept going); offering the old
        // email's record then would point at the wrong person.
        if (normalizeEmail(emailRef.current) !== query) return;
        const exact = page.data.find((p) => normalizeEmail(p.email) === query);
        setDuplicate(exact ?? null);
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
    <form className={cardSurface} onSubmit={handleSubmit} noValidate>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[1.15rem] font-semibold">
          {editing ? 'Edit participant' : 'New participant'}
        </h2>
        {editing && (
          <Button variant="ghost" onClick={onCancelEdit}>
            Cancel edit
          </Button>
        )}
      </div>

      <fieldset className="mb-[18px] border-0 p-0">
        <legend className={LEGEND}>Demographics</legend>
        <div className="grid grid-cols-2 gap-[14px] max-[760px]:grid-cols-1">
          <Field id="firstName" label="First name" error={errors.firstName}>
            <Input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set('firstName')(e.target.value)}
            />
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName}>
            <Input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set('lastName')(e.target.value)}
            />
          </Field>
          <Field id="email" label="Email" error={errors.email}>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          </Field>
          <Field id="phone" label="Phone (optional)" error={errors.phone}>
            <Input
              id="phone"
              value={values.phone}
              onChange={(e) => set('phone')(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mb-[18px] border-0 p-0">
        <legend className={LEGEND}>Measurements</legend>

        <div
          className="mb-3.5 flex gap-2.5"
          role="radiogroup"
          aria-label="Unit system"
        >
          {[Unit.US, Unit.METRIC].map((u) => (
            <label
              key={u}
              className={cx(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[7px] text-[0.9rem]',
                values.unit === u
                  ? 'border-primary bg-primary/10'
                  : 'border-border',
              )}
            >
              <input
                type="radio"
                name="unit"
                className="accent-primary"
                checked={values.unit === u}
                onChange={() => setValues((prev) => convertToUnit(prev, u))}
              />
              {u === Unit.US ? 'US (lb, ft/in)' : 'Metric (kg, cm)'}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-[14px] max-[760px]:grid-cols-1">
          <Field
            id="weight"
            label={`Weight (${weightUnit(values.unit)})`}
            error={errors.weight}
          >
            <Input
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
              <div className="flex gap-2">
                <Input
                  aria-invalid={errors.feet ? true : undefined}
                  aria-describedby={errors.feet ? 'feet-error' : undefined}
                  id="feet"
                  type="number"
                  min="0"
                  placeholder="ft"
                  value={values.feet}
                  onChange={(e) => set('feet')(e.target.value)}
                />
                <Input
                  aria-invalid={errors.feet ? true : undefined}
                  aria-describedby={errors.feet ? 'feet-error' : undefined}
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
              <Input
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
            <Input
              id="age"
              type="number"
              min={AGE_BOUNDS.min}
              max={AGE_BOUNDS.max}
              value={values.age}
              onChange={(e) => set('age')(e.target.value)}
            />
          </Field>
        </div>

        <div
          className="mt-1.5 flex min-h-[30px] items-center gap-2.5"
          aria-live="polite"
        >
          {preview ? (
            <>
              <span className="text-[1.1rem] font-bold">
                BMI {formatBmi(preview.bmi)}
              </span>
              <BandChip band={preview.band} />
            </>
          ) : (
            <span className="text-muted">
              Enter weight and height to see the BMI
            </span>
          )}
        </div>
        <p className="mt-2 text-[0.8rem] text-muted">
          BMI is a screening estimate, not a diagnosis. It does not account for
          muscle, body composition or pregnancy.
        </p>
      </fieldset>

      {duplicate && (
        <Notice tone="warn">
          This person already exists.{' '}
          <Button variant="link" onClick={() => onRequestEdit(duplicate)}>
            Edit their record
          </Button>
        </Notice>
      )}
      {errors.form && (
        <Notice tone="error" role="alert">
          {errors.form}
        </Notice>
      )}
      {serverError && <Notice tone="error">{serverError}</Notice>}

      <div className="flex justify-end">
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : 'Save participant'}
        </Button>
      </div>
    </form>
  );
}
