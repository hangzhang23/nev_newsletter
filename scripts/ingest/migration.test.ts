import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(process.cwd(), '../supabase/migrations');
const replacementMigrations = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_allow_safe_snapshot_delete.sql'))
  .map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8'));

describe('replace_nev_dataset migration', () => {
  it('uses explicit predicates for full-snapshot deletes', () => {
    expect(replacementMigrations.length).toBeGreaterThan(0);
    for (const sql of replacementMigrations) {
      expect(sql).not.toMatch(/delete from public\.(vehicles|weeks|brands);/i);
      expect(sql).toContain('delete from public.vehicles where true;');
      expect(sql).toContain('delete from public.weeks where true;');
      expect(sql).toContain('delete from public.brands where true;');
    }
  });
});
