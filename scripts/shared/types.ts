// 数据契约 —— 脚本侧类型定义
// 与 frontend/src/types/models.ts 保持一致

export interface Vehicle {
  id: string;
  name: string;            // 车型名称（唯一键）
  brand: string;           // 归一品牌
  brandColor: string;      // 品牌色 hex
  isPrimaryBrand: boolean;
  releaseDate: string;     // "2026-08-05"
  priceRange: string;      // "20.98-23.18"
  priceMin: number | null;
  priceMax: number | null;
  positioning: string;
  dimensions: string;
  wheelbase: number | null;
  powertrain: string;
  power: string;
  acceleration: string;
  batteryCapacity: string;
  rangeCltc: string;
  adasChip: string;
  lidar: string;
  computingPower: string;
  cabinChip: string;
  screen: string;
  highlights: string;
  competitors: string;
  source: string;
  week: string;            // "W32"
}

export interface Brand {
  name: string;
  color: string;
  isPrimary: boolean;
  frequency: number;
}

export interface TrendWeek {
  week: string;
  start: string;
  end: string;
  total: number;
  byBrand: { brand: string; count: number }[];
}

export interface MonthlySummary {
  month: string;           // "2026-08"
  total: number;
  priceBands: { band: string; count: number }[];
  powertrains: { type: string; count: number }[];
  topBrands: { brand: string; count: number }[];
}

// 周元数据（ingest 写入 weeks 表，prerender 读取）
export interface WeekMeta {
  week: string;
  start: string;
  end: string;
}

// 品牌颜色映射表（brand_colors.json 结构）
export interface BrandColorsDoc {
  name: string;
  generated_at: string;
  data_window: string;
  rules: Record<string, string>;
  brands: { rank: number; name: string; color: string; frequency: number }[];
  other: { name: string; color: string; frequency_2_brands: string[]; frequency_1_brands: string[] };
  notes: string[];
}
