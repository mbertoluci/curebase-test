// Public API of the participant entity: the API client, the band chip and the
// display helpers shared across features. Named exports keep the surface explicit.
export { api } from './api';
export { BandChip } from './BandChip';
export {
  BAND_CLASS,
  bandLabel,
  formatBmi,
  formatDate,
  heightLabel,
  unitLabel,
  weightUnit,
} from './display';
