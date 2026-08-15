import type { TrendWeek, Vehicle } from '../types/models';
import type { Filters } from '../store/useStore';

export interface WeekMeta {
  week: string;
  start: string;
  end: string;
}

/** 动力类型归并（与 scripts/ingest/normalize.ts 保持一致） */
const PT_RULES: [string, RegExp][] = [
  ['增程', /增程|erev|reev/i],
  ['插混', /插混|插电|phev|dm[- ]?i|dm[- ]?5|hi4|混动|hybrid/i],
  ['燃油', /燃油|汽油|柴油/i],
  ['纯电', /纯电|bev|electric|(^|[^a-z])ev([^a-z]|$)/i],
  ['氢能', /氢/i],
];

export function classifyPowertrain(p: string): string {
  const s = (p || '').trim();
  if (!s) return '未知';
  if (/^\d+$/.test(s) || /^[—\-－]+$/.test(s)) return '未知';
  for (const [label, re] of PT_RULES) {
    if (re.test(s)) return label;
  }
  return s;
}

/** 价格带分段（与脚本保持一致） */
export function classifyPriceBand(min: number | null): string {
  if (min === null) return '待公布';
  if (min < 10) return '10万内';
  if (min < 15) return '10-15万';
  if (min < 20) return '15-20万';
  if (min < 30) return '20-30万';
  return '30万以上';
}

/** 核心筛选纯函数 */
export function applyFilters(vehicles: Vehicle[], filters: Filters, keyword: string): Vehicle[] {
  const kw = keyword.trim().toLowerCase();
  return vehicles.filter((v) => {
    if (filters.brand && v.brand !== filters.brand) return false;
    if (filters.priceMin !== undefined && (v.priceMin === null || v.priceMin < filters.priceMin)) return false;
    if (filters.priceMax !== undefined && (v.priceMax === null || v.priceMax > filters.priceMax)) return false;
    if (filters.powertrain && classifyPowertrain(v.powertrain) !== filters.powertrain) return false;
    if (filters.positioning && !v.positioning.includes(filters.positioning)) return false;
    if (filters.date && !(v.releaseDate && v.releaseDate.startsWith(filters.date))) return false;
    if (kw) {
      const hay = `${v.name} ${v.brand} ${v.positioning} ${v.highlights} ${v.competitors}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/**
 * 按周聚合筛选后的车辆 → 周度趋势（走势图数据）。
 * 保留全部周范围（含 0 数据周），保证筛选后时间轴范围完整、与筛选条件一致。
 */
export function buildTrendByWeek(vehicles: Vehicle[], metas: WeekMeta[]): TrendWeek[] {
  const byWeek = new Map<string, Map<string, number>>();
  for (const v of vehicles) {
    if (!metas.some((m) => m.week === v.week)) continue;
    if (!byWeek.has(v.week)) byWeek.set(v.week, new Map());
    const brandMap = byWeek.get(v.week)!;
    brandMap.set(v.brand, (brandMap.get(v.brand) ?? 0) + 1);
  }
  return metas.map((m) => {
    const brandMap = byWeek.get(m.week);
    if (!brandMap) {
      return { week: m.week, start: m.start, end: m.end, total: 0, byBrand: [] };
    }
    const byBrand = [...brandMap.entries()].map(([brand, count]) => ({ brand, count }));
    return {
      week: m.week,
      start: m.start,
      end: m.end,
      total: byBrand.reduce((s, b) => s + b.count, 0),
      byBrand,
    };
  });
}
