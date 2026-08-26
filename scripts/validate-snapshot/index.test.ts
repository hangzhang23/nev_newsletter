import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { latestInputWeek, validateSnapshot } from './index';

const dirs: string[] = [];
function fixture(): { data: string; publicData: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nev-snapshot-'));
  dirs.push(root);
  const data = path.join(root, 'data');
  const publicData = path.join(root, 'public');
  fs.mkdirSync(data);
  fs.mkdirSync(publicData);
  fs.writeFileSync(path.join(data, 'brand_colors.json'), '{}');
  fs.writeFileSync(path.join(data, 'NEV_weekly_report_20260809_20260815.csv'), 'old');
  fs.writeFileSync(path.join(data, 'NEV_weekly_report_20260816_20260822.csv'), 'new');
  return { data, publicData };
}
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function writeSnapshots(publicData: string, trendWeek: string, vehicleWeek: string): void {
  fs.writeFileSync(path.join(publicData, 'trend_weekly.json'), JSON.stringify([{ week: trendWeek }]));
  fs.writeFileSync(path.join(publicData, 'vehicles.json'), JSON.stringify([{ week: vehicleWeek }]));
}

describe('snapshot freshness', () => {
  it('finds the latest input week', () => {
    const { data } = fixture();
    expect(latestInputWeek(data)).toEqual({
      week: 'W34',
      filename: 'NEV_weekly_report_20260816_20260822.csv',
    });
  });

  it('accepts snapshots containing the latest week', () => {
    const { data, publicData } = fixture();
    writeSnapshots(publicData, 'W34', 'W34');
    expect(() => validateSnapshot(data, publicData)).not.toThrow();
  });

  it('rejects stale trend and vehicle snapshots', () => {
    const first = fixture();
    writeSnapshots(first.publicData, 'W33', 'W34');
    expect(() => validateSnapshot(first.data, first.publicData)).toThrow('走势图快照缺少最新周次 W34');
    const second = fixture();
    writeSnapshots(second.publicData, 'W34', 'W33');
    expect(() => validateSnapshot(second.data, second.publicData)).toThrow('车型快照缺少最新周次 W34');
  });

  it('rejects corrupt or missing snapshot JSON', () => {
    const { data, publicData } = fixture();
    fs.writeFileSync(path.join(publicData, 'trend_weekly.json'), '{');
    fs.writeFileSync(path.join(publicData, 'vehicles.json'), '[]');
    expect(() => validateSnapshot(data, publicData)).toThrow('无法读取快照 trend_weekly.json');
  });
});
