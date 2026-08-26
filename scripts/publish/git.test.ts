import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { publishData } from './git';

const dirs: string[] = [];
function run(args: string[], cwd?: string): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'git failed');
  return (result.stdout || '').trim();
}
function fixture(): { source: string; remote: string; seed: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nev-publish-test-'));
  dirs.push(root);
  const source = path.join(root, 'source');
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'brand_colors.json'), '{}');
  fs.writeFileSync(path.join(source, 'NEV_weekly_report_20260816_20260822.csv'), 'data');
  run(['init', '--bare', remote]);
  run(['init', '-b', 'main', seed]);
  run(['config', 'user.name', 'test'], seed);
  run(['config', 'user.email', 'test@example.com'], seed);
  fs.writeFileSync(path.join(seed, 'README.md'), '# fixture');
  run(['add', '.'], seed);
  run(['commit', '-m', 'seed'], seed);
  run(['remote', 'add', 'origin', remote], seed);
  run(['push', '-u', 'origin', 'main'], seed);
  return { source, remote, seed };
}
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe('publishData', () => {
  it('pushes whitelisted data without modifying the source directory', () => {
    const { source, remote } = fixture();
    fs.writeFileSync(path.join(source, 'private.log'), 'secret');
    const before = fs.readdirSync(source).sort();
    expect(publishData({ sourceDir: source, remote })).toEqual({ status: 'pushed', period: '20260816_20260822' });
    expect(fs.readdirSync(source).sort()).toEqual(before);
    const check = path.join(path.dirname(remote), 'check');
    run(['clone', '--branch', 'main', remote, check]);
    expect(fs.existsSync(path.join(check, 'data', 'NEV_weekly_report_20260816_20260822.csv'))).toBe(true);
    expect(fs.existsSync(path.join(check, 'data', 'private.log'))).toBe(false);
    expect(run(['log', '-1', '--pretty=%s'], check)).toContain('20260816_20260822');
  });

  it('is unchanged on a repeated publication', () => {
    const { source, remote } = fixture();
    expect(publishData({ sourceDir: source, remote }).status).toBe('pushed');
    expect(publishData({ sourceDir: source, remote })).toEqual({ status: 'unchanged', period: '20260816_20260822' });
  });
  it('retries after the remote branch advances during publication', () => {
    const { source, remote } = fixture();
    let raced = false;
    const result = publishData(
      { sourceDir: source, remote },
      {
        beforePush() {
          if (raced) return;
          raced = true;
          const competitor = path.join(path.dirname(remote), 'competitor');
          run(['clone', '--branch', 'main', remote, competitor]);
          run(['config', 'user.name', 'competitor'], competitor);
          run(['config', 'user.email', 'competitor@example.com'], competitor);
          fs.writeFileSync(path.join(competitor, 'RACE.md'), 'remote advanced');
          run(['add', 'RACE.md'], competitor);
          run(['commit', '-m', 'competing update'], competitor);
          run(['push', 'origin', 'main'], competitor);
        },
      },
    );

    expect(raced).toBe(true);
    expect(result.status).toBe('pushed');
    const check = path.join(path.dirname(remote), 'race-check');
    run(['clone', '--branch', 'main', remote, check]);
    expect(fs.readFileSync(path.join(check, 'RACE.md'), 'utf8')).toBe('remote advanced');
    expect(fs.existsSync(path.join(check, 'data', 'NEV_weekly_report_20260816_20260822.csv'))).toBe(true);
  });

});
