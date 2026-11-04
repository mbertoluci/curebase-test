/**
 * Where the e2e target API listens. Single source for the three support files
 * (global-setup waits on it, test-setup builds the axios baseURL from it, and
 * global-teardown frees it), so the port is not re-spelled in three slightly
 * different forms.
 *
 * It mirrors the API's own resolution in `configuration.ts`
 * (`API_PORT ?? PORT ?? 3333`), including API_PORT - the support files used to
 * read only PORT, so an `API_PORT=4444 nx e2e` would wait on the wrong port.
 * Like the API boot, a present-but-invalid value fails fast instead of silently
 * becoming NaN (which would make waitForPortOpen/killPort target nothing).
 */
export function e2eApiTarget(): { host: string; port: number } {
  const host = process.env.API_HOST ?? 'localhost';
  const raw = process.env.API_PORT ?? process.env.PORT;
  const port = raw === undefined || raw === '' ? 3333 : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid e2e API port: ${JSON.stringify(raw)}`);
  }
  return { host, port };
}
