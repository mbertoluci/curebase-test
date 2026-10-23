import { BmiBand } from '@org/contracts';
import { render, screen } from '@testing-library/react';
import { BandChip } from './BandChip';

describe('BandChip', () => {
  it('renders the band label tagged with its band key', () => {
    const { container } = render(<BandChip band={BmiBand.OVERWEIGHT} />);
    expect(screen.getByText('Overweight')).toBeTruthy();
    expect(container.querySelector('[data-band="overweight"]')).toBeTruthy();
  });

  it('renders N/A for a null band', () => {
    const { container } = render(<BandChip band={null} />);
    expect(screen.getByText('N/A')).toBeTruthy();
    expect(container.querySelector('[data-band="na"]')).toBeTruthy();
  });
});
