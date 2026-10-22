import axios from 'axios';

/**
 * HTTP smoke e2e against a running API (real database). It exercises the full
 * request path - routing, validation, service, repository, Prisma - for the
 * core flow. Uses a unique email per run and cleans up after itself.
 *
 * Prereq: `docker compose up -d && npx nx serve @org/api` (see global-setup).
 */
describe('participants API (e2e)', () => {
  const email = `e2e-${Date.now()}@example.com`;
  let id: string;

  it('GET /health is ok', async () => {
    const res = await axios.get('/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
  });

  it('POST /participants creates and derives BMI', async () => {
    const res = await axios.post('/participants', {
      firstName: 'E2E',
      lastName: 'Tester',
      email,
      weight: 195,
      height: 70,
      unit: 'US',
      age: 42,
    });
    expect(res.status).toBe(201);
    expect(res.data.bmiValue).toBeCloseTo(28, 1); // 703*195/70^2
    expect(res.data.bmiBand).toBe('OVERWEIGHT');
    id = res.data.id;
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await axios.post('/participants', {
      firstName: 'Dupe',
      lastName: 'Tester',
      email,
      weight: 80,
      height: 60,
      unit: 'US',
      age: 30,
    });
    expect(res.status).toBe(409);
    expect(res.data.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects implausible input with 400', async () => {
    const res = await axios.post('/participants', {
      firstName: 'Bad',
      lastName: 'Input',
      email: `bad-${Date.now()}@example.com`,
      weight: 80,
      height: 9999,
      unit: 'US',
      age: 30,
    });
    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_FAILED');
  });

  it('PUT recomputes BMI on a measurement change', async () => {
    const res = await axios.put(`/participants/${id}`, { weight: 130 });
    expect(res.status).toBe(200);
    expect(res.data.weight).toBe(130);
    expect(res.data.bmiValue).toBeCloseTo(18.66, 1); // 703*130/70^2
  });

  it('GET /participants finds the record by search', async () => {
    const res = await axios.get('/participants', { params: { search: email } });
    expect(res.status).toBe(200);
    expect(res.data.pageInfo.total).toBe(1);
    expect(res.data.data[0].id).toBe(id);
  });

  it('DELETE soft-deletes, after which GET returns 404', async () => {
    const del = await axios.delete(`/participants/${id}`);
    expect(del.status).toBe(204);
    const get = await axios.get(`/participants/${id}`);
    expect(get.status).toBe(404);
    expect(get.data.code).toBe('PARTICIPANT_NOT_FOUND');
  });
});
