import { BmiBand, ParticipantView, Unit } from '@org/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api, ApiError } from '../lib/api';
import { ParticipantForm } from './ParticipantForm';

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return {
    __esModule: true,
    ...actual,
    api: { create: jest.fn(), update: jest.fn(), list: jest.fn() },
  };
});
const mockApi = api as jest.Mocked<typeof api>;

const view: ParticipantView = {
  id: 'p1',
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

const handlers = () => ({
  onSaved: jest.fn(),
  onCancelEdit: jest.fn(),
  onRequestEdit: jest.fn(),
});

function fillValidUs() {
  fireEvent.change(screen.getByLabelText('First name'), {
    target: { value: 'Peter' },
  });
  fireEvent.change(screen.getByLabelText('Last name'), {
    target: { value: 'Pan' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'peter@x.com' },
  });
  fireEvent.change(screen.getByLabelText('Weight (lb)'), {
    target: { value: '85' },
  });
  fireEvent.change(screen.getByLabelText('Height (ft / in)'), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByLabelText('inches'), { target: { value: '6' } });
  fireEvent.change(screen.getByLabelText('Age (years)'), {
    target: { value: '30' },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('ParticipantForm', () => {
  it('shows validation errors and does not submit an empty form', async () => {
    render(<ParticipantForm editing={null} {...handlers()} />);
    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));
    expect(await screen.findByText('First name is required')).toBeTruthy();
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('shows a live BMI and creates the participant', async () => {
    const h = handlers();
    mockApi.create.mockResolvedValue(view);
    render(<ParticipantForm editing={null} {...h} />);
    fillValidUs();
    expect(screen.getByText('BMI 20.5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));
    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
    expect(mockApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'peter@x.com',
        weight: 85,
        height: 54,
        unit: Unit.US,
        age: 30,
      }),
    );
    expect(h.onSaved).toHaveBeenCalledWith(view, 'created');
  });

  it('converts the measurements when the unit toggle flips', () => {
    render(<ParticipantForm editing={null} {...handlers()} />);
    fireEvent.change(screen.getByLabelText('Weight (lb)'), {
      target: { value: '180' },
    });
    fireEvent.change(screen.getByLabelText('Height (ft / in)'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText('inches'), {
      target: { value: '10' },
    });

    fireEvent.click(screen.getByLabelText('Metric (kg, cm)'));
    expect(
      (screen.getByLabelText('Weight (kg)') as HTMLInputElement).value,
    ).toBe('81.6');
    expect(
      (screen.getByLabelText('Height (cm)') as HTMLInputElement).value,
    ).toBe('178');
  });

  it.each(['peter@x.com', 'Peter@X.com'])(
    'offers the exact-case record for %s, not a substring or case-only match',
    async (email) => {
      const h = handlers();
      const peter = { ...view, id: 'p9', email };
      const caseOnlyHit = {
        ...view,
        id: 'p2',
        email: email === 'peter@x.com' ? 'Peter@X.com' : 'peter@x.com',
      };
      // A substring hit (someone whose email merely contains the typed one) sorts
      // first; the exact-email record is the one that must be offered.
      const substringHit = { ...view, id: 'p1', email: 'peter@x.com.br' };
      mockApi.create.mockRejectedValue(
        new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'dup'),
      );
      mockApi.list.mockResolvedValue({
        data: [substringHit, caseOnlyHit, peter],
        pageInfo: { page: 1, pageSize: 25, total: 3, totalPages: 1 },
      });
      render(<ParticipantForm editing={null} {...h} />);
      fillValidUs();
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: email },
      });
      fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));

      const editBtn = await screen.findByText('Edit their record');
      fireEvent.click(editBtn);
      expect(h.onRequestEdit).toHaveBeenCalledWith(peter);
      expect(mockApi.list).toHaveBeenCalledWith({ search: email });
      expect(mockApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ email }),
      );
    },
  );

  it('offers nothing when no returned row matches the email exactly', async () => {
    const h = handlers();
    mockApi.create.mockRejectedValue(
      new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'dup'),
    );
    // The exact row is on page 2; page 1 contains only substring matches.
    mockApi.list.mockResolvedValue({
      data: Array.from({ length: 25 }, (_, i) => ({
        ...view,
        id: `substring-${i}`,
        email: `other${i}-peter@x.com`,
      })),
      pageInfo: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    });
    render(<ParticipantForm editing={null} {...h} />);
    fillValidUs();
    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));

    expect(
      await screen.findByText('A participant with this email already exists'),
    ).toBeTruthy();
    // Wait for the awaited lookup and handleSubmit's finally, not just the
    // duplicate error rendered before api.list resolves.
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: /Save participant/,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(mockApi.list).toHaveBeenCalledWith({ search: 'peter@x.com' });
    expect(screen.queryByText('Edit their record')).toBeNull();
    expect(h.onRequestEdit).not.toHaveBeenCalled();
  });

  it('prefills and updates in edit mode', async () => {
    const h = handlers();
    mockApi.update.mockResolvedValue(view);
    render(<ParticipantForm editing={view} {...h} />);
    expect(screen.getByText('Edit participant')).toBeTruthy();
    expect(
      (screen.getByLabelText('First name') as HTMLInputElement).value,
    ).toBe('Ada');

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() =>
      expect(mockApi.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ email: 'ada@x.com' }),
      ),
    );
    expect(h.onSaved).toHaveBeenCalledWith(view, 'updated');
  });

  it('cancels edit mode', () => {
    const h = handlers();
    render(<ParticipantForm editing={view} {...h} />);
    fireEvent.click(screen.getByText('Cancel edit'));
    expect(h.onCancelEdit).toHaveBeenCalled();
  });

  it('shows a generic message for a non-API failure', async () => {
    mockApi.create.mockRejectedValue(new Error('kaboom'));
    render(<ParticipantForm editing={null} {...handlers()} />);
    fillValidUs();
    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));
    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeTruthy();
  });

  it('surfaces server-side validation details', async () => {
    mockApi.create.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', [
        'weight too high',
        'bad age',
      ]),
    );
    render(<ParticipantForm editing={null} {...handlers()} />);
    fillValidUs();
    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));
    expect(await screen.findByText('weight too high · bad age')).toBeTruthy();
  });

  it('shows the message for a generic API error', async () => {
    mockApi.create.mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Server exploded'),
    );
    render(<ParticipantForm editing={null} {...handlers()} />);
    fillValidUs();
    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));
    expect(await screen.findByText('Server exploded')).toBeTruthy();
  });
});
