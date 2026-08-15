// 入库脚本：读周报 CSV + brand_colors.json → 清洗归一 → upsert Supabase（vehicles / weeks / brands 三表）
// 每周自动化执行：npm run ingest
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { csvToRecords } from '../shared/csv';
import { buildBrandColorMap, rowToVehicle } from './normalize';
import { weekOfFilename } from '../shared/weeks';
import type { BrandColorsDoc, Vehicle, WeekMeta } from '../shared/types';

const DATA_DIR = process.env.NEV_DATA_DIR || 'e:/workbuddy/space';

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 环境变量（见 .env.example）');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);

  const all = fs.readdirSync(DATA_DIR);
  const fixedSet = new Set(
    all
      .filter((f) => /^NEV_weekly_report_\d{8}_\d{8}_fixed\.csv$/.test(f))
      .map((f) => f.replace('_fixed.csv', '.csv')),
  );
  const files = all
    .filter((f) => /^NEV_weekly_report_\d{8}_\d{8}\.csv$/.test(f))
    .filter((f) => !fixedSet.has(f))
    .concat([...fixedSet].map((f) => f.replace('.csv', '_fixed.csv')))
    .sort();

  const brandDoc: BrandColorsDoc = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'brand_colors.json'), 'utf-8'),
  );
  const brandColorMap = buildBrandColorMap(brandDoc);

  const vehicles = new Map<string, Vehicle>();
  const weekMetas: WeekMeta[] = [];

  for (const f of files) {
    const meta = weekOfFilename(f);
    if (!weekMetas.some((w) => w.week === meta.week)) weekMetas.push(meta);
    const records = csvToRecords(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
    for (const rec of records) {
      const v = rowToVehicle(rec, meta.week, brandColorMap);
      if (v) vehicles.set(v.name, v); // 后写覆盖
    }
  }

  // 品牌频次统计（从归一后车型聚合）
  const brandCount = new Map<string, number>();
  for (const v of vehicles.values()) {
    brandCount.set(v.brand, (brandCount.get(v.brand) ?? 0) + 1);
  }
  const brands = [...brandCount.entries()].map(([name, frequency]) => {
    const bc = brandColorMap.get(name) ?? { color: '#525252', isPrimary: false };
    return { name, color: bc.color, is_primary: bc.isPrimary, frequency };
  });

  // upsert 三表（幂等）
  await supabase.from('vehicles').upsert([...vehicles.values()], { onConflict: 'name' });
  await supabase
    .from('weeks')
    .upsert(
      weekMetas.map((w) => ({ week: w.week, start_date: w.start, end_date: w.end })),
      { onConflict: 'week' },
    );
  await supabase.from('brands').upsert(brands, { onConflict: 'name' });

  console.log(
    `已 upsert：vehicles ${vehicles.size} 款 / weeks ${weekMetas.length} 周 / brands ${brands.length} 个`,
  );
}

main().catch((e) => {
  console.error('入库失败:', e?.message ?? e);
  process.exit(1);
});
