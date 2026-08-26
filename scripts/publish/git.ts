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

export interface PublishHooks {
  beforePush?: (context: { cloneDir: string; attempt: number }) => void;
  afterPush?: (context: { cloneDir: string; attempt: number }) => void;
}

export interface PublishResult {
  status: 'pushed' | 'unchanged';
  period: string;
}

interface GitResult {
  status: number;
  output: string;
}

function gitResult(args: string[], cwd?: string): GitResult {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

function git(args: string[], cwd?: string): string {
  const result = gitResult(args, cwd);
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} 失败: ${result.output.trim()}`);
  }
  return result.output;
}

function publishOnce(
  options: Required<PublishOptions>,
  hooks: PublishHooks,
  attempt: number,
): PublishResult {
  const selection = selectDataFiles(options.sourceDir);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nev-publish-'));
  const cloneDir = path.join(tempRoot, 'repo');
  try {
    git(['clone', '--single-branch', '--branch', options.branch, options.remote, cloneDir]);
    const baseHead = git(['rev-parse', 'HEAD'], cloneDir).trim();
    syncSelectedData(selection, path.join(cloneDir, 'data'));
    git(['add', '--', 'data'], cloneDir);
    const status = git(['status', '--porcelain', '--', 'data'], cloneDir);
    if (!status.trim()) return { status: 'unchanged', period: selection.latestPeriod };
    git(['config', 'user.name', 'workbuddy-automation[bot]'], cloneDir);
    git(['config', 'user.email', 'workbuddy-automation@users.noreply.github.com'], cloneDir);
    git(['commit', '-m', `chore: add weekly data (${selection.latestPeriod})`], cloneDir);
    hooks.beforePush?.({ cloneDir, attempt });

    const push = gitResult(['push', 'origin', options.branch], cloneDir);
    if (push.status !== 0) {
      git(['fetch', 'origin', options.branch], cloneDir);
      const remoteHead = git(['rev-parse', 'FETCH_HEAD'], cloneDir).trim();
      const ancestry = gitResult(['merge-base', '--is-ancestor', baseHead, remoteHead], cloneDir);
      if (remoteHead !== baseHead && ancestry.status === 0) throw new Error('REMOTE_ADVANCED');
      throw new Error(`git push 失败: ${push.output.trim()}`);
    }

    hooks.afterPush?.({ cloneDir, attempt });
    const head = git(['rev-parse', 'HEAD'], cloneDir).trim();
    git(['fetch', 'origin', options.branch], cloneDir);
    const remoteHead = git(['rev-parse', 'FETCH_HEAD'], cloneDir).trim();
    const published = gitResult(['merge-base', '--is-ancestor', head, remoteHead], cloneDir);
    if (published.status !== 0) {
      throw new Error('post-push verification failed: published commit is not in remote history');
    }
    return { status: 'pushed', period: selection.latestPeriod };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function publishData(options: PublishOptions, hooks: PublishHooks = {}): PublishResult {
  const normalized: Required<PublishOptions> = {
    ...options,
    branch: options.branch ?? 'main',
    attempts: options.attempts ?? 2,
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= normalized.attempts; attempt += 1) {
    try {
      return publishOnce(normalized, hooks, attempt);
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== 'REMOTE_ADVANCED') throw error;
    }
  }
  throw lastError;
}
