import { waitForPortOpen } from '@nx/node/utils';
import { e2eApiTarget } from './e2e-env';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // These e2e tests run against a LIVE API (real DB). Start it first, e.g.:
  //   docker compose up -d && npx nx serve @org/api
  // then: npx nx e2e @org/api-e2e
  const { host, port } = e2eApiTarget();
  await waitForPortOpen(port, { host });
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down e2e...\n';
};
