// 周元数据推导：从 CSV 文件名 → WeekMeta（ingest / prerender 共用）
import type { WeekMeta } from './types';

/** 结束日期 ISO 周数（周一起始） */
export function getISOWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7; // 1=Mon..7=Sun
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum); // 移到本周四
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** 从文件名（YYYYMMDD_YYYYMMDD）推导 week 标签 + 起止日期 */
export function weekOfFilename(filename: string): WeekMeta {
  const m = filename.match(/(\d{8})_(\d{8})/);
  if (!m) throw new Error('无法解析文件名日期: ' + filename);
  const startRaw = m[1];
  const endRaw = m[2];
  const start = `${startRaw.slice(0, 4)}-${startRaw.slice(4, 6)}-${startRaw.slice(6, 8)}`;
  const end = `${endRaw.slice(0, 4)}-${endRaw.slice(4, 6)}-${endRaw.slice(6, 8)}`;
  // 默认：week = 结束日期 ISO 周数；早期两周按"起始日"计周需 -1 修正
  const fix: Record<string, number> = {
    '20260412_20260418': 15,
    '20260419_20260425': 16,
  };
  const weekNum = fix[`${startRaw}_${endRaw}`] ?? getISOWeek(end);
  return { week: `W${weekNum}`, start, end };
}
