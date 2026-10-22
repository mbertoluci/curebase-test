import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // These e2e tests run against a LIVE API (real DB). Start it first, e.g.:
  //   docker compose up -d && npx nx serve @org/api
  // then: npx nx e2e @org/api-e2e
  const host = process.env.API_HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await waitForPortOpen(port, { host });
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down e2e...\n';
};
