import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const productionPath = path.resolve(process.cwd(), '../.github/workflows/weekly-update.yml');
const validationPath = path.resolve(process.cwd(), '../.github/workflows/pr-validation.yml');
const guardPath = path.resolve(process.cwd(), '../.github/workflows/supabase-midweek-guard.yml');
const production = fs.readFileSync(productionPath, 'utf8');
const validation = fs.readFileSync(validationPath, 'utf8');
const guard = fs.readFileSync(guardPath, 'utf8');
const prerender = fs.readFileSync(path.resolve(process.cwd(), 'prerender/index.ts'), 'utf8');

describe('weekly data workflow', () => {
  it('runs for main data pushes with serialized execution', () => {
    expect(production).toContain('push:');
    expect(production).toContain('branches: [main]');
    expect(production).toContain('- "data/**"');
    expect(production).toContain('cancel-in-progress: false');
  });

  it('uses repository-absolute paths and retriggers for pipeline fixes', () => {
    const workspaceData = 'NEV_DATA_DIR: ${{ github.workspace }}/data';
    expect(production).toContain('- ".github/workflows/weekly-update.yml"');
    expect(production).toContain('- "scripts/**"');
    expect(production.split(workspaceData)).toHaveLength(3);
    const workspacePublicData = 'NEV_PUBLIC_DATA_DIR: ${{ github.workspace }}/frontend/public/data';
    expect(production.split(workspacePublicData)).toHaveLength(3);
    expect(prerender).toContain('process.env.NEV_PUBLIC_DATA_DIR');
  });

  it('tests and validates freshness before snapshot commit', () => {
    const testIndex = production.indexOf('name: Test scripts');
    const freshnessIndex = production.indexOf('name: Verify snapshot freshness');
    const commitIndex = production.indexOf('name: Commit and push generated JSON');
    expect(testIndex).toBeGreaterThan(0);
    expect(freshnessIndex).toBeGreaterThan(testIndex);
    expect(commitIndex).toBeGreaterThan(freshnessIndex);
  });

  it('never force-pushes repository history', () => {
    const executableLines = production
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(executableLines).not.toMatch(/git\s+push[^\n]*(?:--force|-f\b)/);
    expect(executableLines).not.toContain('force-with-lease');
  });

  it('isolates pull request validation from production credentials', () => {
    expect(production).not.toContain('pull_request:');
    expect(validation).toContain('pull_request:');
    expect(validation).toContain('contents: read');
    expect(validation).toContain('persist-credentials: false');
    expect(validation).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(validation).not.toContain('name: Ingest to Supabase');
    expect(validation).not.toContain('git push');
  });

  it('requires committed lockfiles for deterministic installs', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'package-lock.json'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), '../frontend/package-lock.json'))).toBe(true);
  });

  it('checks Supabase availability before installing weekly dependencies', () => {
    const availabilityIndex = production.indexOf('name: Ensure Supabase is active');
    const installIndex = production.indexOf('name: Install scripts dependencies');
    expect(availabilityIndex).toBeGreaterThan(0);
    expect(installIndex).toBeGreaterThan(availabilityIndex);
    expect(production).toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}');
    expect(production).toContain('node scripts/ops/ensure-supabase-active.mjs');
  });
});

describe('Supabase midweek guard workflow', () => {
  it('runs Wednesday morning in Beijing and supports manual recovery', () => {
    expect(guard).toContain('cron: "30 0 * * 3"');
    expect(guard).toContain('workflow_dispatch: {}');
  });

  it('has read-only repository permissions and a bounded recovery time', () => {
    expect(guard).toContain('contents: read');
    expect(guard).toContain('timeout-minutes: 20');
    expect(guard).toContain('node scripts/ops/ensure-supabase-active.mjs');
    expect(guard).toContain('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}');
    expect(guard).toContain(
      'SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
    );
    expect(guard).toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}');
  });
});
