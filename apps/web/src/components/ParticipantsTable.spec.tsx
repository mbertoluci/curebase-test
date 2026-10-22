import { BmiBand, Paginated, ParticipantView, Unit } from '@org/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { ParticipantsTable } from './ParticipantsTable';

const view: ParticipantView = {
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

const pageOf = (
  over: Partial<Paginated<ParticipantView>['pageInfo']> = {},
): Paginated<ParticipantView> => ({
  data: [view],
  pageInfo: { page: 1, pageSize: 25, total: 1, totalPages: 1, ...over },
});

const baseProps = {
  sortBy: 'createdAt' as const,
  sortDir: 'desc' as const,
  onSort: jest.fn(),
  onPage: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('ParticipantsTable', () => {
  it('shows an error state', () => {
    render(
      <ParticipantsTable
        {...baseProps}
        page={null}
        loading={false}
        error="boom"
      />,
    );
    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('renders nothing when there is no page, loading or error', () => {
    const { container } = render(
      <ParticipantsTable
        {...baseProps}
        page={null}
        loading={false}
        error={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows a loading state before the first page arrives', () => {
    render(
      <ParticipantsTable
        {...baseProps}
        page={null}
        loading={true}
        error={null}
      />,
    );
    expect(screen.getByText(/Loading participants/)).toBeTruthy();
  });

  it('shows an empty state when there are no matches', () => {
    render(
      <ParticipantsTable
        {...baseProps}
        page={pageOf({ total: 0 })}
        loading={false}
        error={null}
      />,
    );
    expect(screen.getByText(/No participants match/)).toBeTruthy();
  });

  it('renders a row with name, email and the BMI band', () => {
    render(
      <ParticipantsTable
        {...baseProps}
        page={pageOf()}
        loading={false}
        error={null}
      />,
    );
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('ada@x.com')).toBeTruthy();
    expect(screen.getByText('Normal')).toBeTruthy();
  });

  it('fires onSort, onEdit and onDelete', () => {
    render(
      <ParticipantsTable
        {...baseProps}
        page={pageOf()}
        loading={false}
        error={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'BMI' }));
    expect(baseProps.onSort).toHaveBeenCalledWith('bmiValue');
    fireEvent.click(screen.getByText('Edit'));
    expect(baseProps.onEdit).toHaveBeenCalledWith(view);
    fireEvent.click(screen.getByText('Delete'));
    expect(baseProps.onDelete).toHaveBeenCalledWith(view);
  });

  it('enables Next when more pages exist and calls onPage', () => {
    render(
      <ParticipantsTable
        {...baseProps}
        page={pageOf({ total: 3, pageSize: 2, totalPages: 2 })}
        loading={false}
        error={null}
      />,
    );
    const next = screen.getByRole('button', {
      name: 'Next',
    }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(baseProps.onPage).toHaveBeenCalledWith(2);
    expect(
      (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
