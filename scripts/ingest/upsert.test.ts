import { describe, expect, it } from 'vitest';
import { replaceDataset, type Dataset, type ReplaceClient } from './upsert';

const dataset: Dataset = {
  vehicles: [{ name: '测试车' }],
  weeks: [{ week: 'W34', start_date: '2026-08-16', end_date: '2026-08-22' }],
  brands: [{ name: '测试品牌' }],
};

function fakeClient(error: Error | null = null): {
  client: ReplaceClient;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
} {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ name, args });
        return { error };
      },
    },
  };
}

describe('replaceDataset', () => {
  it('replaces all tables through one transactional RPC call', async () => {
    const { client, calls } = fakeClient();
    await replaceDataset(client, dataset);
    expect(calls).toEqual([
      {
        name: 'replace_nev_dataset',
        args: {
          p_vehicles: dataset.vehicles,
          p_weeks: dataset.weeks,
          p_brands: dataset.brands,
        },
      },
    ]);
  });

  it('propagates an RPC failure', async () => {
    const { client } = fakeClient(new Error('replace failed'));
    await expect(replaceDataset(client, dataset)).rejects.toThrow('replace failed');
  });
});
