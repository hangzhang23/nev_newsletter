import { describe, expect, it } from 'vitest';
import { aggregateBrands, aggregateMonthly, aggregateTrend, type WeekMeta } from './aggregate';
import type { Vehicle } from '../shared/types';

function mkVehicle(partial: Partial<Vehicle> & { name: string }): Vehicle {
  return {
    id: partial.name,
    name: partial.name,
    brand: '比亚迪',
    brandColor: '#EF4444',
    isPrimaryBrand: true,
    releaseDate: '2026-08-11',
    priceRange: '10-15',
    priceMin: 10,
    priceMax: 15,
    positioning: '轿车',
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
    week: 'W32',
    ...partial,
  };
}

const METAS: WeekMeta[] = [
  { week: 'W31', start: '2026-07-25', end: '2026-07-31' },
  { week: 'W32', start: '2026-08-02', end: '2026-08-08' },
  { week: 'W33', start: '2026-08-09', end: '2026-08-15' },
];

describe('aggregateTrend 周度走势', () => {
  it('total === byBrand 计数之和', () => {
    const vehicles = [
      mkVehicle({ name: 'A', brand: '比亚迪', week: 'W32' }),
      mkVehicle({ name: 'B', brand: '比亚迪', week: 'W32' }),
      mkVehicle({ name: 'C', brand: '零跑', week: 'W32' }),
      mkVehicle({ name: 'D', brand: '小鹏', week: 'W33' }),
    ];
    const trend = aggregateTrend(vehicles, METAS);
    const w32 = trend.find((t) => t.week === 'W32')!;
    expect(w32.total).toBe(3);
    expect(w32.total).toBe(w32.byBrand.reduce((s, b) => s + b.count, 0));
  });

  it('无数据的周不产出', () => {
    const vehicles = [mkVehicle({ name: 'A', week: 'W32' })];
    const trend = aggregateTrend(vehicles, METAS);
    expect(trend.map((t) => t.week)).toEqual(['W32']);
  });
});

describe('aggregateBrands 品牌分布', () => {
  it('频次统计 + 颜色关联 + 降序', () => {
    const vehicles = [
      mkVehicle({ name: 'A', brand: '比亚迪' }),
      mkVehicle({ name: 'B', brand: '比亚迪' }),
      mkVehicle({ name: 'C', brand: '零跑' }),
    ];
    const colorMap = new Map([
      ['比亚迪', { color: '#EF4444', isPrimary: true }],
      ['零跑', { color: '#F97316', isPrimary: true }],
    ]);
    const brands = aggregateBrands(vehicles, colorMap);
    expect(brands[0]).toEqual({ name: '比亚迪', color: '#EF4444', isPrimary: true, frequency: 2 });
    expect(brands[1].name).toBe('零跑');
  });
});

describe('aggregateMonthly 月度综述', () => {
  it('按月份分组 + 价格带/动力聚合', () => {
    const vehicles = [
      mkVehicle({ name: 'A', releaseDate: '2026-08-11', priceMin: 6, powertrain: '纯电' }),
      mkVehicle({ name: 'B', releaseDate: '2026-08-13', priceMin: 20, powertrain: '插混' }),
      mkVehicle({ name: 'C', releaseDate: '2026-07-10', priceMin: 10, powertrain: '纯电' }),
    ];
    const monthly = aggregateMonthly(vehicles);
    expect(monthly.length).toBe(2);
    const aug = monthly.find((m) => m.month === '2026-08')!;
    expect(aug.total).toBe(2);
    expect(aug.topBrands[0].brand).toBe('比亚迪');
    const pure = aug.powertrains.find((p) => p.type === '纯电')!;
    expect(pure.count).toBe(1);
  });
});
