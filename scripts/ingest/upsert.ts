export interface Dataset {
  vehicles: unknown[];
  weeks: unknown[];
  brands: unknown[];
}

interface ReplaceResult {
  error: unknown;
}

export interface ReplaceClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<ReplaceResult>;
}

export async function replaceDataset(client: ReplaceClient, dataset: Dataset): Promise<void> {
  const { error } = await client.rpc('replace_nev_dataset', {
    p_vehicles: dataset.vehicles,
    p_weeks: dataset.weeks,
    p_brands: dataset.brands,
  });
  if (error) throw error;
}
