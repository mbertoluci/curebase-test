/**
 * The single place the API reads process.env. Everything else takes typed
 * values from ConfigService (DI) or from this module in bootstrap, so there is
 * one source of truth for configuration and nothing reads env ad hoc.
 */
export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  globalPrefix: string;
  corsOrigins: string[];
  logLevel: string;
  swagger: {
    title: string;
    description: string;
    version: string;
    /** Path segment under the global prefix, e.g. `api/docs`. */
    path: string;
  };
}

/** Build the typed config from the environment, applying every default once. */
export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const rawPort = process.env.API_PORT ?? process.env.PORT ?? '3333';
  const port = Number(rawPort);
  const corsOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Fail fast where env is read, not later at listen() or on the first blocked
  // request. A non-numeric API_PORT would otherwise bind to NaN and crash deep
  // in bootstrap, and an explicitly empty WEB_ORIGIN would silently collapse to
  // an empty allow-list that rejects every browser origin.
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid API port "${rawPort}": expected an integer in [1, 65535].`,
    );
  }
  if (corsOrigins.length === 0) {
    throw new Error(
      'WEB_ORIGIN is set but empty: expected a comma-separated list of allowed origins.',
    );
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port,
    globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
    corsOrigins,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    swagger: {
      title: process.env.API_TITLE ?? 'Curebase BMI API',
      description:
        process.env.API_DESCRIPTION ??
        'Participant demographic + health capture with derived BMI',
      version: process.env.API_VERSION ?? '1.0',
      path: 'docs',
    },
  };
}

/** The ConfigModule namespace key under which the typed config is registered. */
export const APP_CONFIG = 'app';
