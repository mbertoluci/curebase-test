import { BmiBand, Unit } from '@org/contracts';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApiError } from '@/shared/http';
import { api } from '@/entities/participant/api';
import HomePage from './page';

jest.mock('@/entities/participant/api', () => ({
  __esModule: true,
  api: {
    list: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));
const mockApi = api as jest.Mocked<typeof api>;

const view = {
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
const onePage = {
  data: [view],
  pageInfo: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
};

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
  mockApi.list.mockResolvedValue(onePage);
  mockApi.remove.mockResolvedValue(undefined);
});

describe('HomePage', () => {
  it('loads and renders participants from the API', async () => {
    render(<HomePage />);
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
    expect(mockApi.list).toHaveBeenCalled();
  });

  it('puts the form into edit mode when a row Edit is clicked', async () => {
    render(<HomePage />);
    fireEvent.click(await screen.findByText('Edit'));
    expect(await screen.findByText('Edit participant')).toBeTruthy();
  });

  it('deletes a participant after confirmation and shows a toast', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<HomePage />);
    fireEvent.click(await screen.findByText('Delete'));
    await waitFor(() => expect(mockApi.remove).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText('Participant deleted.')).toBeTruthy();
  });

  it('does not delete when the confirmation is declined', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HomePage />);
    fireEvent.click(await screen.findByText('Delete'));
    expect(mockApi.remove).not.toHaveBeenCalled();
  });

  it('reloads with a search filter as the user types', async () => {
    render(<HomePage />);
    await screen.findByText('Ada Lovelace');
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'ada' },
    });
    await waitFor(() =>
      expect(mockApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ada', page: 1 }),
        expect.anything(),
      ),
    );
  });

  it('reloads sorted when a column header is clicked', async () => {
    render(<HomePage />);
    await screen.findByText('Ada Lovelace');
    fireEvent.click(screen.getByRole('button', { name: 'BMI' }));
    await waitFor(() =>
      expect(mockApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'bmiValue' }),
        expect.anything(),
      ),
    );
  });

  it('creates via the form and shows a success toast', async () => {
    mockApi.create.mockResolvedValue(view);
    render(<HomePage />);
    await screen.findByText('Ada Lovelace');

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
    fireEvent.change(screen.getByLabelText('inches'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByLabelText('Age (years)'), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save participant/ }));

    expect(await screen.findByText('Participant created.')).toBeTruthy();
  });

  it('paginates to the next page', async () => {
    mockApi.list.mockResolvedValue({
      data: [view],
      pageInfo: { page: 1, pageSize: 2, total: 3, totalPages: 2 },
    });
    render(<HomePage />);
    await screen.findByText('Ada Lovelace');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(mockApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    );
  });

  it('shows an error toast when a delete fails', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi.remove.mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'delete boom'),
    );
    render(<HomePage />);
    fireEvent.click(await screen.findByText('Delete'));
    expect(await screen.findByText('delete boom')).toBeTruthy();
  });

  it('updates a record and shows an updated toast', async () => {
    mockApi.update.mockResolvedValue(view);
    render(<HomePage />);
    fireEvent.click(await screen.findByText('Edit'));
    await screen.findByText('Edit participant');
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(await screen.findByText('Participant updated.')).toBeTruthy();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('list request ordering', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each(['success', 'failure'] as const)(
    'ignores stale %s after the newer response',
    async (outcome) => {
      const a = deferred<typeof onePage>();
      const b = deferred<typeof onePage>();
      mockApi.list
        .mockReturnValueOnce(a.promise)
        .mockReturnValueOnce(b.promise);
      render(<HomePage />);
      await act(async () => {
        jest.advanceTimersByTime(250);
      });
      fireEvent.change(screen.getByLabelText('Search'), {
        target: { value: 'Grace' },
      });
      await act(async () => {
        jest.advanceTimersByTime(250);
      });
      expect(mockApi.list).toHaveBeenCalledTimes(2);
      await act(async () => {
        b.resolve({ ...onePage, data: [{ ...view, firstName: 'Grace' }] });
      });
      expect(screen.getByText('Grace Lovelace')).toBeTruthy();
      expect(screen.queryByText('Loading participants…')).toBeNull();
      await act(async () => {
        if (outcome === 'success') a.resolve(onePage);
        else a.reject(new Error('stale failure'));
      });
      expect(screen.getByText('Grace Lovelace')).toBeTruthy();
      expect(screen.queryByText('Ada Lovelace')).toBeNull();
      expect(screen.queryByText('Could not load participants.')).toBeNull();
    },
  );

  it('keeps loading until the latest request settles and clears it on failure', async () => {
    const a = deferred<typeof onePage>();
    const b = deferred<typeof onePage>();
    mockApi.list.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    render(<HomePage />);
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'Grace' },
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    await act(async () => {
      a.resolve(onePage);
    });
    expect(screen.getByText('Loading participants…')).toBeTruthy();
    await act(async () => {
      b.reject(new Error('latest failure'));
    });
    expect(screen.queryByText('Loading participants…')).toBeNull();
    expect(screen.getByText('Could not load participants.')).toBeTruthy();
  });
});
