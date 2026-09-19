import { describe, expect, test } from 'vitest';
import { ensureSupabaseActive } from '../ops/ensure-supabase-active.mjs';

const env = {
  SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ACCESS_TOKEN: 'management-token',
};

type RequestRecord = {
  url: string;
  method: string;
  headers: Headers;
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sequenceFetch(responses: Response[]): {
  fetchImpl: typeof fetch;
  requests: RequestRecord[];
} {
  const requests: RequestRecord[] = [];
  let index = 0;

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
    });
    const next = responses[index++];
    if (!next) throw new Error(`Unexpected request #${index}`);
    return next;
  }) as typeof fetch;

  return { fetchImpl, requests };
}

describe('ensureSupabaseActive', () => {
  test('verifies an active project with three real database requests', async () => {
    const { fetchImpl, requests } = sequenceFetch([
      response(200, { id: 'project-ref', status: 'ACTIVE_HEALTHY' }),
      response(200, [{ week: 'W38' }]),
      response(200, [{ week: 'W38' }]),
      response(200, [{ week: 'W38' }]),
    ]);

    const result = await ensureSupabaseActive({
      env,
      fetchImpl,
      sleep: async () => {},
      log: () => {},
    });

    expect(result).toEqual({ restored: false, status: 'ACTIVE_HEALTHY' });
    expect(requests.map(({ url, method }) => ({ url, method }))).toEqual([
      { url: 'https://api.supabase.com/v1/projects/project-ref', method: 'GET' },
      {
        url: 'https://project-ref.supabase.co/rest/v1/weeks?select=week&order=end_date.desc&limit=1',
        method: 'GET',
      },
      {
        url: 'https://project-ref.supabase.co/rest/v1/weeks?select=week&order=end_date.desc&limit=1',
        method: 'GET',
      },
      {
        url: 'https://project-ref.supabase.co/rest/v1/weeks?select=week&order=end_date.desc&limit=1',
        method: 'GET',
      },
    ]);
    expect(requests[1].headers.get('apikey')).toBe('service-role-key');
    expect(requests[1].headers.get('authorization')).toBe('Bearer service-role-key');
  });

  test('restores an inactive project and waits until it is healthy', async () => {
    const { fetchImpl, requests } = sequenceFetch([
      response(200, { id: 'project-ref', status: 'INACTIVE' }),
      new Response(null, { status: 200 }),
      response(200, { id: 'project-ref', status: 'COMING_UP' }),
      response(200, { id: 'project-ref', status: 'ACTIVE_HEALTHY' }),
      response(200, [{ week: 'W38' }]),
      response(200, [{ week: 'W38' }]),
      response(200, [{ week: 'W38' }]),
    ]);

    const result = await ensureSupabaseActive({
      env,
      fetchImpl,
      sleep: async () => {},
      log: () => {},
      maxStatusChecks: 3,
    });

    expect(result).toEqual({ restored: true, status: 'ACTIVE_HEALTHY' });
    expect(requests[1].url).toBe('https://api.supabase.com/v1/projects/project-ref/restore');
    expect(requests[1].method).toBe('POST');
    expect(requests[1].headers.get('authorization')).toBe('Bearer management-token');
  });

  test('reports a management API authentication failure', async () => {
    const { fetchImpl } = sequenceFetch([response(401, { message: 'Unauthorized' })]);

    await expect(
      ensureSupabaseActive({ env, fetchImpl, sleep: async () => {}, log: () => {} }),
    ).rejects.toThrow('Supabase project status request failed (401): Unauthorized');
  });

  test('times out when a restored project never becomes healthy', async () => {
    const { fetchImpl } = sequenceFetch([
      response(200, { id: 'project-ref', status: 'INACTIVE' }),
      response(200, {}),
      response(200, { id: 'project-ref', status: 'COMING_UP' }),
      response(200, { id: 'project-ref', status: 'COMING_UP' }),
    ]);

    await expect(
      ensureSupabaseActive({
        env,
        fetchImpl,
        sleep: async () => {},
        log: () => {},
        maxStatusChecks: 2,
      }),
    ).rejects.toThrow('did not become ACTIVE_HEALTHY after 2 checks');
  });

  test('fails when the database endpoint is unavailable after activation', async () => {
    const { fetchImpl } = sequenceFetch([
      response(200, { id: 'project-ref', status: 'ACTIVE_HEALTHY' }),
      response(503, { message: 'Service unavailable' }),
    ]);

    await expect(
      ensureSupabaseActive({ env, fetchImpl, sleep: async () => {}, log: () => {} }),
    ).rejects.toThrow('Supabase database health request failed (503)');
  });
});
