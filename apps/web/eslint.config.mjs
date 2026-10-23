import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import { join } from 'node:path';
import baseConfig from '../../eslint.config.mjs';

// Enforce the Feature-Sliced layering: a layer may only import from the layers
// below it (widgets -> features -> entities -> shared). This turns the
// architecture from a convention into a lint-enforced rule.
const src = join(import.meta.dirname, 'src');
const featureSlicedBoundaries = {
  plugins: { import: importPlugin },
  settings: {
    'import/resolver': {
      typescript: { project: join(import.meta.dirname, 'tsconfig.json') },
    },
  },
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: `${src}/shared`,
            from: [
              `${src}/entities`,
              `${src}/features`,
              `${src}/widgets`,
              `${src}/app`,
            ],
            message:
              'shared/ is the lowest layer and must not import from entities, features, widgets or app.',
          },
          {
            target: `${src}/entities`,
            from: [`${src}/features`, `${src}/widgets`, `${src}/app`],
            message: 'entities/ may only import from shared.',
          },
          {
            target: `${src}/features`,
            from: [`${src}/widgets`, `${src}/app`],
            message: 'features/ may only import from entities and shared.',
          },
          {
            target: `${src}/widgets`,
            from: [`${src}/app`],
            message: 'widgets/ must not import from app.',
          },
        ],
      },
    ],
  },
};

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  featureSlicedBoundaries,
  {
    ignores: ['.next/**/*', '**/out-tsc'],
  },
];
