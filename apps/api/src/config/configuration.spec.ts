import { loadConfig } from './configuration';

/**
 * loadConfig is the single place env is read, so its defaults and parsing are
 * contract: a silent change here (e.g. the CORS split or the port fallback)
 * changes runtime behaviour of every context that boots the app.
 */
describe('loadConfig', () => {
  const KEYS = [
    'NODE_ENV',
    'API_PORT',
    'PORT',
    'API_GLOBAL_PREFIX',
    'WEB_ORIGIN',
    'LOG_LEVEL',
    'API_TITLE',
    'API_DESCRIPTION',
    'API_VERSION',
  ] as const;
  const original = Object.fromEntries(
    KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof KEYS)[number], string | undefined>;

  beforeEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('applies every default when the environment is empty', () => {
    expect(loadConfig()).toEqual({
      nodeEnv: 'development',
      isProduction: false,
      port: 3333,
      globalPrefix: 'api',
      corsOrigins: ['http://localhost:3000'],
      logLevel: 'info',
      swagger: {
        title: 'Curebase BMI API',
        description: 'Participant demographic + health capture with derived BMI',
        version: '1.0',
        path: 'docs',
      },
    });
  });

  it('splits, trims and filters WEB_ORIGIN into the CORS allow-list', () => {
    process.env.WEB_ORIGIN =
      ' http://a.com , ,http://b.com ,http://localhost:3000 ';
    expect(loadConfig().corsOrigins).toEqual([
      'http://a.com',
      'http://b.com',
      'http://localhost:3000',
    ]);
  });

  it('prefers API_PORT over PORT and both over the default', () => {
    process.env.PORT = '4000';
    expect(loadConfig().port).toBe(4000);
    process.env.API_PORT = '5000';
    expect(loadConfig().port).toBe(5000);
  });

  it('derives isProduction from NODE_ENV and passes overrides through', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_GLOBAL_PREFIX = 'v1';
    process.env.LOG_LEVEL = 'debug';
    const config = loadConfig();
    expect(config.isProduction).toBe(true);
    expect(config.globalPrefix).toBe('v1');
    expect(config.logLevel).toBe('debug');
  });
});
