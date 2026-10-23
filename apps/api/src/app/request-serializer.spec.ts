import { serializeRequest } from './request-serializer';

describe('serializeRequest (pino-http req serializer)', () => {
  it('strips the query string from the logged url', () => {
    const out = serializeRequest({
      id: 42,
      method: 'GET',
      url: '/api/participants?search=ada%40example.com',
    });
    expect(out).toEqual({ id: 42, method: 'GET', url: '/api/participants' });
    expect(JSON.stringify(out)).not.toContain('search');
    expect(JSON.stringify(out)).not.toContain('example.com');
  });

  it('never emits headers or any other request property', () => {
    const out = serializeRequest({
      id: 1,
      method: 'GET',
      url: '/api/participants',
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        'x-actor-id': 'ada',
      },
      body: { email: 'ada@example.com' },
      remoteAddress: '10.0.0.1',
    } as Parameters<typeof serializeRequest>[0]);
    expect(out).toEqual({ id: 1, method: 'GET', url: '/api/participants' });
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(JSON.stringify(out)).not.toContain('ada');
  });

  it('passes a non-string url through unchanged', () => {
    expect(serializeRequest({ id: 7, method: 'GET' })).toEqual({
      id: 7,
      method: 'GET',
      url: undefined,
    });
  });
});
