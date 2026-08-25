import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { selectDataFiles, syncSelectedData } from './data-files';

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nev-data-files-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, 'brand_colors.json'), '{}');
  return dir;
}
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe('selectDataFiles', () => {
  it('selects only valid reports and prefers fixed files', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'NEV_weekly_report_20260809_20260815.csv'), 'base');
    fs.writeFileSync(path.join(dir, 'NEV_weekly_report_20260809_20260815_fixed.csv'), 'fixed');
    fs.writeFileSync(path.join(dir, 'private.log'), 'secret');
    const selected = selectDataFiles(dir);
    expect(selected.files).toEqual(['NEV_weekly_report_20260809_20260815_fixed.csv', 'brand_colors.json']);
    expect(selected.latestPeriod).toBe('20260809_20260815');
  });

  it('rejects missing brand colors', () => {
    const dir = tempDir();
    fs.rmSync(path.join(dir, 'brand_colors.json'));
    fs.writeFileSync(path.join(dir, 'NEV_weekly_report_20260809_20260815.csv'), 'data');
    expect(() => selectDataFiles(dir)).toThrow('缺少 brand_colors.json');
  });

  it('rejects empty and reversed-date reports', () => {
    const emptyDir = tempDir();
    fs.writeFileSync(path.join(emptyDir, 'NEV_weekly_report_20260809_20260815.csv'), '');
    expect(() => selectDataFiles(emptyDir)).toThrow('数据文件为空');
    const reversedDir = tempDir();
    fs.writeFileSync(path.join(reversedDir, 'NEV_weekly_report_20260815_20260809.csv'), 'data');
    expect(() => selectDataFiles(reversedDir)).toThrow('日期范围无效');
  });

  it('copies only changed whitelist files idempotently', () => {
    const source = tempDir();
    const destination = tempDir();
    fs.writeFileSync(path.join(source, 'NEV_weekly_report_20260809_20260815.csv'), 'data');
    const selected = selectDataFiles(source);
    expect(syncSelectedData(selected, destination).sort()).toEqual([
      'NEV_weekly_report_20260809_20260815.csv',
    ]);
    expect(syncSelectedData(selected, destination)).toEqual([]);
    expect(fs.existsSync(path.join(destination, 'private.log'))).toBe(false);
  });
});
