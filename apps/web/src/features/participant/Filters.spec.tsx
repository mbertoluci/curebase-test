import { Unit } from '@org/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { Filters } from './Filters';

describe('Filters', () => {
  it('emits a search patch as the user types', () => {
    const onChange = jest.fn();
    render(<Filters query={{}} onChange={onChange} onReset={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'ada' },
    });
    expect(onChange).toHaveBeenCalledWith({ search: 'ada' });
  });

  it('emits a unit patch and clears it to undefined for "All"', () => {
    const onChange = jest.fn();
    render(
      <Filters
        query={{ unit: Unit.US }}
        onChange={onChange}
        onReset={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ unit: undefined });
  });

  it('emits a numeric Min BMI bound', () => {
    const onChange = jest.fn();
    render(<Filters query={{}} onChange={onChange} onReset={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Min BMI'), {
      target: { value: '18.5' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ minBmi: 18.5 });
  });

  it('clears Max BMI to undefined when emptied', () => {
    const onChange = jest.fn();
    render(
      <Filters
        query={{ maxBmi: 30 }}
        onChange={onChange}
        onReset={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Max BMI'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ maxBmi: undefined });
  });

  it('calls onReset', () => {
    const onReset = jest.fn();
    render(<Filters query={{}} onChange={jest.fn()} onReset={onReset} />);
    fireEvent.click(screen.getByText('Reset'));
    expect(onReset).toHaveBeenCalled();
  });
});
