import fs from 'node:fs';
import path from 'node:path';
import { weekOfFilename } from '../shared/weeks';

const BASE_RE = /^NEV_weekly_report_(\d{8})_(\d{8})\.csv$/;
const FIXED_RE = /^NEV_weekly_report_(\d{8})_(\d{8})_fixed\.csv$/;

export interface SelectedData {
  sourceDir: string;
  files: string[];
  latestFile: string;
  latestPeriod: string;
}

function periodOf(filename: string): string {
  const match = filename.match(/(\d{8}_\d{8})/);
  if (!match) throw new Error(`无法解析数据周期: ${filename}`);
  return match[1];
}

function validateNonEmptyFile(sourceDir: string, filename: string): void {
  const fullPath = path.join(sourceDir, filename);
  const stat = fs.statSync(fullPath);
  if (!stat.isFile() || stat.size === 0) throw new Error(`数据文件为空: ${filename}`);
}

function validateReport(sourceDir: string, filename: string): void {
  validateNonEmptyFile(sourceDir, filename);
  const meta = weekOfFilename(filename);
  const start = new Date(`${meta.start}T00:00:00Z`);
  const end = new Date(`${meta.end}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    throw new Error(`数据文件日期范围无效: ${filename}`);
  }
}

export function selectDataFiles(sourceDir: string): SelectedData {
  if (!fs.existsSync(sourceDir)) throw new Error(`数据源目录不存在: ${sourceDir}`);
  const all = fs.readdirSync(sourceDir);
  if (!all.includes('brand_colors.json')) throw new Error('缺少 brand_colors.json');
  validateNonEmptyFile(sourceDir, 'brand_colors.json');

  const byPeriod = new Map<string, string>();
  for (const filename of all.sort()) {
    if (BASE_RE.test(filename)) byPeriod.set(periodOf(filename), filename);
  }
  for (const filename of all.sort()) {
    if (FIXED_RE.test(filename)) byPeriod.set(periodOf(filename), filename);
  }
  const reports = [...byPeriod.values()].sort((a, b) => periodOf(a).localeCompare(periodOf(b)));
  if (reports.length === 0) throw new Error('未找到有效的周报 CSV');
  for (const filename of reports) validateReport(sourceDir, filename);

  const latestFile = reports.at(-1)!;
  return {
    sourceDir: path.resolve(sourceDir),
    files: [...reports, 'brand_colors.json'],
    latestFile,
    latestPeriod: periodOf(latestFile),
  };
}

export function syncSelectedData(selection: SelectedData, destinationDir: string): string[] {
  fs.mkdirSync(destinationDir, { recursive: true });
  const changed: string[] = [];
  for (const filename of selection.files) {
    const source = path.join(selection.sourceDir, filename);
    const destination = path.join(destinationDir, filename);
    const same = fs.existsSync(destination) && fs.readFileSync(source).equals(fs.readFileSync(destination));
    if (!same) {
      fs.copyFileSync(source, destination);
      changed.push(filename);
    }
  }
  return changed;
}
