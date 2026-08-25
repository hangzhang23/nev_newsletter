import { describe, expect, it } from 'vitest';
import { upsertDataset, type Dataset, type UpsertClient } from './upsert';

const dataset: Dataset = {
  vehicles: [{ name: '测试车' }],
  weeks: [{ week: 'W34', start_date: '2026-08-16', end_date: '2026-08-22' }],
  brands: [{ name: '测试品牌' }],
};

function fakeClient(failureTable?: string): { client: UpsertClient; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        return {
          async upsert() {
            calls.push(table);
            return { error: table === failureTable ? new Error(`${table} failed`) : null };
          },
        };
      },
    },
  };
}

describe('upsertDataset', () => {
  it('writes all datasets in dependency order', async () => {
    const { client, calls } = fakeClient();
    await upsertDataset(client, dataset);
    expect(calls).toEqual(['vehicles', 'weeks', 'brands']);
  });

  it.each([
    ['vehicles', ['vehicles']],
    ['weeks', ['vehicles', 'weeks']],
    ['brands', ['vehicles', 'weeks', 'brands']],
  ] as const)('stops when %s returns an error', async (table, expectedCalls) => {
    const { client, calls } = fakeClient(table);
    await expect(upsertDataset(client, dataset)).rejects.toThrow(`${table} failed`);
    expect(calls).toEqual(expectedCalls);
  });
});
