// 聚合纯函数：走势 / 品牌分布 / 月度综述
import type { Brand, MonthlySummary, TrendWeek, Vehicle, WeekMeta } from '../shared/types';
import { classifyPowertrain, classifyPriceBand } from '../ingest/normalize';

export type { WeekMeta };

/** 周度走势：按 week 分组，total + 品牌堆叠 */
export function aggregateTrend(vehicles: Vehicle[], weekMetas: WeekMeta[]): TrendWeek[] {
  const metaMap = new Map(weekMetas.map((m) => [m.week, m]));
  const byWeek = new Map<string, Map<string, number>>();

  for (const v of vehicles) {
    if (!byWeek.has(v.week)) byWeek.set(v.week, new Map());
    const brandMap = byWeek.get(v.week)!;
    brandMap.set(v.brand, (brandMap.get(v.brand) ?? 0) + 1);
  }

  // 按 week 元数据顺序（时间升序）
  const result: TrendWeek[] = [];
  for (const meta of weekMetas) {
    const brandMap = byWeek.get(meta.week);
    if (!brandMap) continue;
    const byBrand = [...brandMap.entries()]
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count);
    const total = byBrand.reduce((s, x) => s + x.count, 0);
    result.push({ week: meta.week, start: meta.start, end: meta.end, total, byBrand });
  }
  return result;
}

/** 品牌分布：频次 + 颜色 + isPrimary（频次降序） */
export function aggregateBrands(
  vehicles: Vehicle[],
  brandColors: Map<string, { color: string; isPrimary: boolean }>,
): Brand[] {
  const count = new Map<string, number>();
  for (const v of vehicles) {
    count.set(v.brand, (count.get(v.brand) ?? 0) + 1);
  }
  return [...count.entries()]
    .map(([name, frequency]) => {
      const c = brandColors.get(name) ?? { color: '#525252', isPrimary: false };
      return { name, color: c.color, isPrimary: c.isPrimary, frequency };
    })
    .sort((a, b) => b.frequency - a.frequency || a.name.localeCompare(b.name));
}

/** 月度综述：按月分组，总车型数 / 价格带 / 动力类型 / 品牌 Top */
export function aggregateMonthly(vehicles: Vehicle[]): MonthlySummary[] {
  const byMonth = new Map<string, Vehicle[]>();
  for (const v of vehicles) {
    const month = v.releaseDate ? v.releaseDate.slice(0, 7) : '未知';
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(v);
  }

  const result: MonthlySummary[] = [];
  for (const [month, list] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const priceBands = new Map<string, number>();
    const powertrains = new Map<string, number>();
    const brandCount = new Map<string, number>();
    for (const v of list) {
      const band = classifyPriceBand(v.priceMin);
      priceBands.set(band, (priceBands.get(band) ?? 0) + 1);
      const pt = classifyPowertrain(v.powertrain);
      powertrains.set(pt, (powertrains.get(pt) ?? 0) + 1);
      brandCount.set(v.brand, (brandCount.get(v.brand) ?? 0) + 1);
    }
    result.push({
      month,
      total: list.length,
      priceBands: [...priceBands.entries()].map(([band, count]) => ({ band, count })),
      powertrains: [...powertrains.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      topBrands: [...brandCount.entries()]
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    });
  }
  return result;
}
