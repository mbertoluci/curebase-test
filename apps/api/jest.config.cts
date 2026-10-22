const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts', // bootstrap (wiring, no logic)
    '!src/**/*.module.ts', // DI wiring
  ],
  // Branches sit lower than lines because Swagger/Nest method decorators generate
  // branch points we can't meaningfully exercise; the logic layers are ~100%.
  coverageThreshold: {
    global: { statements: 92, branches: 70, functions: 92, lines: 94 },
    './src/features/participants/participants.service.ts': {
      statements: 100,
      functions: 100,
      lines: 100,
      branches: 80,
    },
  },
};
