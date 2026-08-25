import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { selectDataFiles, syncSelectedData } from './data-files';

export interface PublishOptions {
  sourceDir: string;
  remote: string;
  branch?: string;
  attempts?: number;
}

export interface PublishResult {
  status: 'pushed' | 'unchanged';
  period: string;
}

function git(args: string[], cwd?: string, allowFailure = false): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args[0]} 失败: ${(result.stderr || result.stdout).trim()}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function publishOnce(options: Required<PublishOptions>): PublishResult {
  const selection = selectDataFiles(options.sourceDir);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nev-publish-'));
  const cloneDir = path.join(tempRoot, 'repo');
  try {
    git(['clone', '--single-branch', '--branch', options.branch, options.remote, cloneDir]);
    syncSelectedData(selection, path.join(cloneDir, 'data'));
    git(['add', '--', 'data'], cloneDir);
    const status = git(['status', '--porcelain', '--', 'data'], cloneDir);
    if (!status.trim()) return { status: 'unchanged', period: selection.latestPeriod };
    git(['config', 'user.name', 'workbuddy-automation[bot]'], cloneDir);
    git(['config', 'user.email', 'workbuddy-automation@users.noreply.github.com'], cloneDir);
    git(['commit', '-m', `chore: add weekly data (${selection.latestPeriod})`], cloneDir);
    const pushOutput = git(['push', 'origin', options.branch], cloneDir, true);
    if (/rejected|non-fast-forward|fetch first/i.test(pushOutput)) throw new Error('NON_FAST_FORWARD');
    const head = git(['rev-parse', 'HEAD'], cloneDir).trim();
    const remoteHead = git(['ls-remote', 'origin', `refs/heads/${options.branch}`], cloneDir).split(/\s/)[0];
    if (!remoteHead || head !== remoteHead) throw new Error(`git push 失败: ${pushOutput.trim()}`);
    return { status: 'pushed', period: selection.latestPeriod };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function publishData(options: PublishOptions): PublishResult {
  const normalized: Required<PublishOptions> = {
    ...options,
    branch: options.branch ?? 'main',
    attempts: options.attempts ?? 2,
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= normalized.attempts; attempt += 1) {
    try {
      return publishOnce(normalized);
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== 'NON_FAST_FORWARD') throw error;
    }
  }
  throw lastError;
}
