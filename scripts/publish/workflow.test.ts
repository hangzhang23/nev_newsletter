import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const productionPath = path.resolve(process.cwd(), '../.github/workflows/weekly-update.yml');
const validationPath = path.resolve(process.cwd(), '../.github/workflows/pr-validation.yml');
const production = fs.readFileSync(productionPath, 'utf8');
const validation = fs.readFileSync(validationPath, 'utf8');

describe('weekly data workflow', () => {
  it('runs for main data pushes with serialized execution', () => {
    expect(production).toContain('push:');
    expect(production).toContain('branches: [main]');
    expect(production).toContain('- "data/**"');
    expect(production).toContain('cancel-in-progress: false');
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
});
