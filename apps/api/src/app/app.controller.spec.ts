import { AppController } from './app.controller';

describe('AppController', () => {
  it('health returns ok with a timestamp', () => {
    const result = new AppController().health();
    expect(result.status).toBe('ok');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
