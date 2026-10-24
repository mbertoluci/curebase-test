const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // The Nx preset emits only an HTML coverage report. Add lcov so SonarCloud can
  // ingest coverage, plus a text summary for the CI logs.
  coverageReporters: ['html', 'lcov', 'text-summary'],
};
