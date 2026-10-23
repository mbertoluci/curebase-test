import { ApiError } from '../../shared/http';
import { api } from './participant.api';

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('api client', () => {
  afterEach(() => jest.restoreAllMocks());

  it('serialises only defined query params', async () => {
    mockFetch(200, {
      data: [],
      pageInfo: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
    });
    await api.list({ page: 2, search: 'ada', minBmi: undefined });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/participants?');
    expect(url).toContain('page=2');
    expect(url).toContain('search=ada');
    expect(url).not.toContain('minBmi');
  });

  it('skips null and empty-string query params', async () => {
    mockFetch(200, {
      data: [],
      pageInfo: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
    });
    await api.list({ search: '', unit: null as never, page: 3 });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('page=3');
    expect(url).not.toContain('search=');
    expect(url).not.toContain('unit=');
  });

  it('returns undefined on 204 without parsing a body', async () => {
    mockFetch(204, null);
    await expect(api.remove('x')).resolves.toBeUndefined();
  });

  it('throws an ApiError carrying the machine code on an error response', async () => {
    mockFetch(409, { code: 'EMAIL_ALREADY_EXISTS', message: 'dup' });
    await expect(api.create({} as never)).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_ALREADY_EXISTS',
    });
  });

  it('rejects a 2xx whose body is not a readable JSON object (INVALID_RESPONSE)', async () => {
    mockFetch(200, null); // e.g. an HTML proxy page or empty body
    await expect(api.list()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('wraps a network failure as a NETWORK_ERROR ApiError', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('down')) as unknown as typeof fetch;
    await expect(api.get('x')).rejects.toBeInstanceOf(ApiError);
    await expect(api.get('x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('uses the right HTTP verbs for get/create/update', async () => {
    mockFetch(200, { id: '1', email: 'a@b.com', bmiValue: 22 });
    await api.get('1');
    await api.create({ a: 1 } as never);
    await api.update('1', { a: 2 } as never);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[1][1].method).toBe('POST');
    expect(calls[2][1].method).toBe('PUT');
  });
});

it('rejects JSON arrays instead of passing an invalid list to the UI', async () => {
  mockFetch(200, []);
  await expect(api.list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('rejects an unreadable JSON body', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => {
      throw new SyntaxError('HTML');
    },
  });
  await expect(api.list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});

it('rejects a list whose pageInfo is incomplete (INVALID_RESPONSE)', async () => {
  mockFetch(200, { data: [], pageInfo: { page: 1 } }); // missing total/totalPages
  await expect(api.list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});

it('rejects a participant missing required fields (INVALID_RESPONSE)', async () => {
  mockFetch(200, { id: '1' }); // no email / bmiValue
  await expect(api.get('1')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
