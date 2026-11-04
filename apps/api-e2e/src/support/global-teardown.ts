import { killPort } from '@nx/node/utils';
import { e2eApiTarget } from './e2e-env';

module.exports = async function () {
  // The `e2e` target depends on `@org/api:serve` (see package.json), so Nx
  // starts that API and this frees the port it bound - the same port global-setup
  // waited on (default 3333, the API; NOT 3000, the Next dev server). Caveat: if
  // you started the API yourself on this port and ran e2e separately, this stops
  // it too, since killPort frees the port rather than a process the suite owns.
  const { port } = e2eApiTarget();
  await killPort(port);
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
