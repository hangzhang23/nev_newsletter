import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowPath = path.resolve(process.cwd(), '../.github/workflows/weekly-update.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

describe('weekly data workflow', () => {
  it('runs for main data pushes with serialized execution', () => {
    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('- "data/**"');
    expect(workflow).toContain('cancel-in-progress: false');
  });

  it('tests and validates freshness before snapshot commit', () => {
    const testIndex = workflow.indexOf('name: Test scripts');
    const freshnessIndex = workflow.indexOf('name: Verify snapshot freshness');
    const commitIndex = workflow.indexOf('name: Commit and push generated JSON');
    expect(testIndex).toBeGreaterThan(0);
    expect(freshnessIndex).toBeGreaterThan(testIndex);
    expect(commitIndex).toBeGreaterThan(freshnessIndex);
  });

  it('never force-pushes repository history', () => {
    const executableLines = workflow
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(executableLines).not.toMatch(/git\s+push[^\n]*(?:--force|-f\b)/);
    expect(executableLines).not.toContain('force-with-lease');
  });
  it('runs a safe validation-only path for pull requests', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain("if: github.event_name != 'pull_request'");
  });

  it('requires committed lockfiles for deterministic installs', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'package-lock.json'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), '../frontend/package-lock.json'))).toBe(true);
  });

});
