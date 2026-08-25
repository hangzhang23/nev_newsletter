export interface Dataset {
  vehicles: unknown[];
  weeks: unknown[];
  brands: unknown[];
}

interface UpsertResult {
  error: unknown;
}

export interface UpsertClient {
  from(table: string): {
    upsert(rows: unknown[], options: { onConflict: string }): PromiseLike<UpsertResult>;
  };
}

async function checkedUpsert(
  client: UpsertClient,
  table: string,
  rows: unknown[],
  onConflict: string,
): Promise<void> {
  const { error } = await client.from(table).upsert(rows, { onConflict });
  if (error) throw error;
}

export async function upsertDataset(client: UpsertClient, dataset: Dataset): Promise<void> {
  await checkedUpsert(client, 'vehicles', dataset.vehicles, 'name');
  await checkedUpsert(client, 'weeks', dataset.weeks, 'week');
  await checkedUpsert(client, 'brands', dataset.brands, 'name');
}
