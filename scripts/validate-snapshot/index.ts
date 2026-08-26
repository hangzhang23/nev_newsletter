import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectDataFiles } from '../publish/data-files';
import { weekOfFilename } from '../shared/weeks';

interface TrendRow { week?: unknown }
interface VehicleRow { week?: unknown }

function readArray(filePath: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取快照 ${path.basename(filePath)}: ${error instanceof Error ? error.message : error}`);
  }
  if (!Array.isArray(value)) throw new Error(`快照不是数组: ${path.basename(filePath)}`);
  return value;
}

export function latestInputWeek(dataDir: string): { week: string; filename: string } {
  const selected = selectDataFiles(dataDir);
  return { week: weekOfFilename(selected.latestFile).week, filename: selected.latestFile };
}

export function validateSnapshot(dataDir: string, publicDataDir: string): void {
  const latest = latestInputWeek(dataDir);
  const trends = readArray(path.join(publicDataDir, 'trend_weekly.json')) as TrendRow[];
  const vehicles = readArray(path.join(publicDataDir, 'vehicles.json')) as VehicleRow[];
  if (!trends.some((row) => row.week === latest.week)) {
    throw new Error(`走势图快照缺少最新周次 ${latest.week}（${latest.filename}）`);
  }
  if (!vehicles.some((row) => row.week === latest.week)) {
    throw new Error(`车型快照缺少最新周次 ${latest.week}（${latest.filename}）`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  validateSnapshot(
    process.env.NEV_DATA_DIR || path.join(repoRoot, 'data'),
    process.env.NEV_PUBLIC_DATA_DIR || path.join(repoRoot, 'frontend/public/data'),
  );
  const latest = latestInputWeek(process.env.NEV_DATA_DIR || path.join(repoRoot, 'data'));
  console.log(`静态快照已覆盖最新周次 ${latest.week}`);
}
