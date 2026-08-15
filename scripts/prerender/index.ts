// 预渲染主流程：读 Supabase（vehicles / brands / weeks）→ 映射 camelCase → 聚合 → 4 个静态 JSON
// 每周自动化执行：npm run prerender（须先 npm run ingest）
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { aggregateBrands, aggregateMonthly, aggregateTrend } from './aggregate';
import type { Brand, Vehicle, WeekMeta } from '../shared/types';

const OUT_DIR = path.resolve(process.cwd(), 'frontend/public/data');

interface VehicleRow {
  name: string;
  brand: string;
  brand_color: string | null;
  is_primary_brand: boolean | null;
  release_date: string | null;
  price_range: string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  positioning: string | null;
  dimensions: string | null;
  wheelbase: number | null;
  powertrain: string | null;
  power: string | null;
  acceleration: string | null;
  battery_capacity: string | null;
  range_cltc: string | null;
  adas_chip: string | null;
  lidar: string | null;
  computing_power: string | null;
  cabin_chip: string | null;
  screen: string | null;
  highlights: string | null;
  competitors: string | null;
  source: string | null;
  week: string | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 数据库行（snake_case）→ 前端契约（camelCase） */
function dbToVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.name,
    name: row.name,
    brand: row.brand,
    brandColor: row.brand_color ?? '#525252',
    isPrimaryBrand: row.is_primary_brand ?? false,
    releaseDate: row.release_date ?? '',
    priceRange: row.price_range ?? '',
    priceMin: num(row.price_min),
    priceMax: num(row.price_max),
    positioning: row.positioning ?? '',
    dimensions: row.dimensions ?? '',
    wheelbase: row.wheelbase,
    powertrain: row.powertrain ?? '',
    power: row.power ?? '',
    acceleration: row.acceleration ?? '',
    batteryCapacity: row.battery_capacity ?? '',
    rangeCltc: row.range_cltc ?? '',
    adasChip: row.adas_chip ?? '',
    lidar: row.lidar ?? '',
    computingPower: row.computing_power ?? '',
    cabinChip: row.cabin_chip ?? '',
    screen: row.screen ?? '',
    highlights: row.highlights ?? '',
    competitors: row.competitors ?? '',
    source: row.source ?? '',
    week: row.week ?? '',
  };
}

function writeJSON(name: string, data: unknown): void {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  已生成 ${name}（${Array.isArray(data) ? data.length : 1} 条）`);
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 环境变量（见 .env.example）');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);

  const [vRes, bRes, wRes] = await Promise.all([
    supabase.from('vehicles').select('*'),
    supabase.from('brands').select('*'),
    supabase.from('weeks').select('*'),
  ]);
  if (vRes.error) throw vRes.error;
  if (bRes.error) throw bRes.error;
  if (wRes.error) throw wRes.error;

  const vehicles = (vRes.data as VehicleRow[]).map(dbToVehicle).sort(
    (a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.name.localeCompare(b.name),
  );
  const brands = (bRes.data as { name: string; color: string | null; is_primary: boolean | null; frequency: number }[]).map(
    (b): Brand => ({
      name: b.name,
      color: b.color ?? '#525252',
      isPrimary: b.is_primary ?? false,
      frequency: b.frequency,
    }),
  );
  const weekMetas: WeekMeta[] = (wRes.data as { week: string; start_date: string; end_date: string }[])
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((w) => ({ week: w.week, start: w.start_date, end: w.end_date }));

  const brandColorMap = new Map(brands.map((b) => [b.name, { color: b.color, isPrimary: b.isPrimary }]));

  const trend = aggregateTrend(vehicles, weekMetas);
  const brandsDist = aggregateBrands(vehicles, brandColorMap);
  const monthly = aggregateMonthly(vehicles);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`数据源: Supabase（vehicles ${vehicles.length} / brands ${brands.length} / weeks ${weekMetas.length}）\n`);
  writeJSON('vehicles.json', vehicles);
  writeJSON('trend_weekly.json', trend);
  writeJSON('brands_dist.json', brandsDist);
  writeJSON('monthly.json', monthly);
  console.log('\n预渲染完成。');
}

main().catch((e) => {
  console.error('预渲染失败:', e?.message ?? e);
  process.exit(1);
});
