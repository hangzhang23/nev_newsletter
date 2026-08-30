import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');
const runnerPath = path.join(repoRoot, 'scripts', 'workbuddy-publisher.ps1');
const installerPath = path.join(repoRoot, 'scripts', 'install-workbuddy-publisher.ps1');
const wrapperPath = path.join(repoRoot, 'scripts', 'publish-workbuddy.cmd');
const docsPath = path.join(repoRoot, 'docs', 'automation', 'workbuddy-integration.md');

describe('Windows WorkBuddy publisher recovery', () => {
  it('keeps PowerShell 5.1 scripts ASCII-safe without relying on a BOM', () => {
    const runner = fs.readFileSync(runnerPath, 'utf8');
    const installer = fs.readFileSync(installerPath, 'utf8');
    expect(runner).toMatch(/^[\x00-\x7F]*$/);
    expect(installer).toMatch(/^[\x00-\x7F]*$/);
  });

  it('logs actionable PowerShell failure locations and handles empty Git output', () => {
    const runner = fs.readFileSync(runnerPath, 'utf8');
    expect(runner).toContain('$_.ScriptStackTrace');
    expect(runner).toContain('$_.InvocationInfo.PositionMessage');
    expect(runner).toContain('$outputText = if ($null -eq $output)');
  });

  it('does not treat native stderr progress as a terminating PowerShell error', () => {
    const runner = fs.readFileSync(runnerPath, 'utf8');
    expect(runner).toContain('$savedErrorActionPreference');
    expect(runner).toContain('$ErrorActionPreference = \"Continue\"');
    expect(runner).toContain('$ErrorActionPreference = $savedErrorActionPreference');
  });

  it('uses a pending marker and cross-session file lock without false success', () => {
    const runner = fs.readFileSync(runnerPath, 'utf8');
    expect(runner).toContain('requests');
    expect(runner).toContain('[Guid]::NewGuid()');
    expect(runner).toContain('$requestFiles');
    expect(runner).toContain('[IO.FileShare]::None');
    expect(runner).toContain('exit 2');
    expect(runner).not.toContain('Local\\NEVWorkBuddyPublisher');
    expect(runner).not.toContain('if ($env:NEV_');
    expect(runner).toContain('$DataDir = \"E:\\workbuddy\\space\"');
    expect(runner).toContain('$Branch = \"main\"');
  });

  it('rejects path indirection and credential-bearing remotes before safe fast-forward update', () => {
    const runner = fs.readFileSync(runnerPath, 'utf8');
    expect(runner).toContain('[IO.FileAttributes]::ReparsePoint');
    expect(runner).toContain('--show-toplevel');
    expect(runner).toContain('--absolute-git-dir');
    expect(runner).toContain('$remoteUri.UserInfo');
    expect(runner).toContain('$remoteUri.Query');
    expect(runner).toContain('$Branch -notmatch');
    expect(runner).toContain('check-ref-format');
    expect(runner).toContain('[redacted]');
    expect(runner).toContain('@($lockPath, $logPath)');
    expect(runner).toContain('merge');
    expect(runner).toContain('--ff-only');
    expect(runner).not.toContain('NEV_PUBLISHER_ALLOW_CUSTOM_STATE');
    expect(runner).not.toContain('reset --hard');
    expect(runner).not.toMatch(/push[^\r\n]*(?:--force|-f\b)/i);
  });

  it('reinstalls deterministic dependencies only while publication is pending', () => {
    const runner = fs.readFileSync(runnerPath, 'utf8');
    const pendingIndex = runner.indexOf('[Guid]::NewGuid()');
    const ciIndex = runner.indexOf('@("--prefix", "scripts", "ci")');
    expect(pendingIndex).toBeGreaterThan(0);
    expect(ciIndex).toBeGreaterThan(pendingIndex);
  });

  it('installs one idempotent 15-minute current-user scheduled retry', () => {
    const installer = fs.readFileSync(installerPath, 'utf8');
    expect(installer).toContain('NEV WorkBuddy Publisher');
    expect(installer).toContain('New-ScheduledTaskTrigger');
    expect(installer).toContain('AddMinutes(15)');
    expect(installer).toContain('New-TimeSpan -Minutes 15');
    expect(installer).toContain('Register-ScheduledTask');
    expect(installer).toContain('-Force');
    expect(installer).toContain('.workbuddy\\bin');
    expect(installer).toContain('publish-nev.cmd');
    expect(installer).toContain('-RequestPublication');
    expect(installer).toContain('[IO.FileAttributes]::ReparsePoint');
  });

  it('uses the stable launcher and documents observable recovery', () => {
    const wrapper = fs.readFileSync(wrapperPath, 'utf8');
    const docs = fs.readFileSync(docsPath, 'utf8');
    expect(wrapper).toContain('.workbuddy\\bin\\publish-nev.cmd');
    expect(docs).toContain('每 15 分钟');
    expect(docs).toContain('nev-publisher.log');
    expect(docs).toContain('install-workbuddy-publisher.ps1');
  });
});
