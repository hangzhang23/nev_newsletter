import { describe, expect, it } from 'vitest';
import { applyFilters, buildTrendByWeek, classifyPowertrain, classifyPriceBand, type WeekMeta } from './filter';
import type { Vehicle } from '../types/models';

const WEEK_METAS: WeekMeta[] = [
  { week: 'W32', start: '2026-08-02', end: '2026-08-08' },
  { week: 'W33', start: '2026-08-09', end: '2026-08-15' },
];

function mkVehicle(partial: Partial<Vehicle> & { name: string }): Vehicle {
  const { name, ...rest } = partial;
  return {
    id: name,
    name,
    brand: '比亚迪',
    brandColor: '#EF4444',
    isPrimaryBrand: true,
    releaseDate: '2026-08-11',
    priceRange: '10-15',
    priceMin: 10,
    priceMax: 15,
    positioning: 'B级纯电家轿',
    dimensions: '',
    wheelbase: 2800,
    powertrain: '纯电',
    power: '',
    acceleration: '',
    batteryCapacity: '',
    rangeCltc: '',
    adasChip: '',
    lidar: '',
    computingPower: '',
    cabinChip: '',
    screen: '',
    highlights: '',
    competitors: '',
    source: '',
    week: 'W33',
    ...rest,
  };
}

const VEHICLES: Vehicle[] = [
  mkVehicle({ name: '海豹06', brand: '比亚迪', priceMin: 9.99, priceMax: 14.19, powertrain: '插混', highlights: '800V高压平台' }),
  mkVehicle({ name: '零跑A05', brand: '零跑', priceMin: 6.39, priceMax: 9.09, powertrain: '纯电' }),
  mkVehicle({ name: '魏牌V8X', brand: '魏牌', priceMin: 22.68, priceMax: 30.28, powertrain: '插混' }),
];

describe('applyFilters 筛选', () => {
  it('按品牌过滤', () => {
    const r = applyFilters(VEHICLES, { brand: '比亚迪' }, '');
    expect(r.map((v) => v.name)).toEqual(['海豹06']);
  });

  it('按价格区间过滤（最低价）', () => {
    const r = applyFilters(VEHICLES, { priceMin: 20 }, '');
    expect(r.map((v) => v.name)).toEqual(['魏牌V8X']);
  });

  it('按价格区间过滤（最高价）', () => {
    const r = applyFilters(VEHICLES, { priceMax: 10 }, '');
    expect(r.map((v) => v.name)).toEqual(['零跑A05']);
  });

  it('按动力类型过滤（归并后）', () => {
    const r = applyFilters(VEHICLES, { powertrain: '插混' }, '');
    expect(r.map((v) => v.name).sort()).toEqual(['海豹06', '魏牌V8X']);
  });

  it('关键字搜索', () => {
    const r = applyFilters(VEHICLES, {}, '800V');
    expect(r.map((v) => v.name)).toEqual(['海豹06']);
  });

  it('组合筛选', () => {
    const r = applyFilters(VEHICLES, { powertrain: '插混', priceMin: 20 }, '');
    expect(r.map((v) => v.name)).toEqual(['魏牌V8X']);
  });

  it('无匹配返回空', () => {
    const r = applyFilters(VEHICLES, { brand: '不存在' }, '');
    expect(r).toEqual([]);
  });
});

describe('filter 辅助函数', () => {
  it('classifyPowertrain 与脚本一致', () => {
    expect(classifyPowertrain('纯电+增程')).toBe('增程');
    expect(classifyPowertrain('EV+DM-i')).toBe('插混');
  });
  it('classifyPriceBand 与脚本一致', () => {
    expect(classifyPriceBand(9.9)).toBe('10万内');
    expect(classifyPriceBand(null)).toBe('待公布');
  });
});

describe('buildTrendByWeek 筛选联动（走势图数据）', () => {
  it('保留全部周范围，空数据周 total 为 0', () => {
    const trend = buildTrendByWeek(VEHICLES, WEEK_METAS);
    expect(trend.map((t) => t.week)).toEqual(['W32', 'W33']);
    const w32 = trend.find((t) => t.week === 'W32')!;
    expect(w32.total).toBe(0);
    expect(w32.byBrand).toEqual([]);
  });

  it('total === byBrand 计数之和', () => {
    const trend = buildTrendByWeek(VEHICLES, WEEK_METAS);
    for (const t of trend) {
      expect(t.total).toBe(t.byBrand.reduce((s, b) => s + b.count, 0));
    }
  });

  it('按品牌筛选后，走势只统计该品牌', () => {
    const filtered = applyFilters(VEHICLES, { brand: '比亚迪' }, '');
    const trend = buildTrendByWeek(filtered, WEEK_METAS);
    const w33 = trend.find((t) => t.week === 'W33')!;
    expect(w33.total).toBe(1);
    expect(w33.byBrand).toEqual([{ brand: '比亚迪', count: 1 }]);
  });

  it('按动力类型筛选后，走势只统计该动力', () => {
    const filtered = applyFilters(VEHICLES, { powertrain: '插混' }, '');
    const trend = buildTrendByWeek(filtered, WEEK_METAS);
    const w33 = trend.find((t) => t.week === 'W33')!;
    expect(w33.total).toBe(2);
    const byBrand = w33.byBrand.map((b) => b.count).sort();
    expect(byBrand).toEqual([1, 1]);
  });

  it('空结果时所有周为 0', () => {
    const trend = buildTrendByWeek([], WEEK_METAS);
    expect(trend.every((t) => t.total === 0 && t.byBrand.length === 0)).toBe(true);
  });
});
