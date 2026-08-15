// 品牌清洗归一 + 字段转换（移植 analyze_brands.py）
import type { BrandColorsDoc, Vehicle } from '../shared/types';

export interface BrandColor {
  color: string;
  isPrimary: boolean;
}

/** 去括号、逗号后备注，返回干净字符串 */
export function cleanBrand(s: string): string {
  let v = (s || '').trim();
  v = v.replace(/（[^）]*）/g, ''); // 全角括号
  v = v.replace(/\([^)]*\)/g, ''); // 半角括号
  v = v.split(/[，,]/)[0]; // 逗号后备注
  return v.trim();
}

/** 品牌归一：鸿蒙四界归并 + 别名 + startswith */
export function normalizeBrand(raw: string): string | null {
  const b = cleanBrand(raw);
  if (!b || b.includes('双联屏')) return null; // 字段错位的脏数据

  // 鸿蒙智行四界统一归并（华为系）
  if (/^(鸿蒙智行|问界|智界|享界|尊界|尚界|华为)/.test(b)) return '鸿蒙智行';

  const alias: Record<string, string> = {
    零跑汽车: '零跑',
    小鹏汽车: '小鹏',
    理想汽车: '理想',
    智己汽车: '智己',
    上汽通用五菱: '五菱',
    广汽埃安: '埃安',
    吉利汽车: '吉利',
    长城魏牌: '魏牌',
    上汽AUDI: '奥迪',
    AUDI: '奥迪',
    东风奕派: '奕派',
    奕派科技: '奕派',
    华晨宝马: '宝马',
    '梅赛德斯-奔驰': '奔驰',
    firefly萤火虫: '萤火虫',
    奇瑞纵横: '纵横',
  };
  if (alias[b] !== undefined) return alias[b];

  const starts: [string, string][] = [
    ['星途', '星途'],
    ['坦克', '坦克'],
    ['魏牌', '魏牌'],
    ['零跑', '零跑'],
    ['小鹏', '小鹏'],
    ['理想', '理想'],
    ['智己', '智己'],
    ['乐道', '乐道'],
    ['smart', 'smart'],
    ['埃安', '埃安'],
    ['奥迪', '奥迪'],
    ['纵横', '纵横'],
    ['蔚来', '蔚来'],
    ['启境', '启境'],
  ];
  for (const [key, val] of starts) {
    if (b.startsWith(key)) return val;
  }

  if (b.startsWith('吉利')) return b.includes('银河') ? '吉利银河' : '吉利';

  return b;
}

/** 价格区间数值化："6.39-9.09"→6.39/9.09，"25.98起(预)"→25.98/null */
export function parsePrice(priceRange: string): { min: number | null; max: number | null } {
  const s = (priceRange || '').trim();
  if (!s || /^(待公布|待查|待定|无)$/.test(s)) return { min: null, max: null };
  const cleaned = s.replace(/[（(][^）)]*[）)]/g, '');
  const nums = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  const values = nums.map(Number);
  const isFrom = /起|起步|预售起/.test(cleaned);
  if (values.length >= 2) return { min: values[0], max: values[1] };
  if (isFrom) return { min: values[0], max: null };
  return { min: values[0], max: values[0] };
}

/** 轴距抽数值 */
export function parseWheelbase(raw: string): number | null {
  const s = (raw || '').trim();
  if (!s || s === '待查' || s === '无') return null;
  const m = s.match(/\d+/);
  if (!m) return null;
  const v = Number(m[0]);
  return v > 0 ? v : null;
}

/** 上市/发布时间 → ISO 日期 "2026-08-05" */
export function parseReleaseDate(raw: string): string {
  const s = (raw || '').trim();
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

/** 核心亮点 1~5 合并 */
export function mergeHighlights(row: Record<string, string>): string {
  const parts: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = (row[`核心亮点${i}`] || '').trim();
    if (v && v !== '待查' && v !== '无' && v !== '待公布') parts.push(v);
  }
  return parts.join('；');
}

/** 竞品 1~3 合并 */
export function mergeCompetitors(row: Record<string, string>): string {
  const parts: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const v = (row[`竞品${i}`] || '').trim();
    if (v && v !== '待查' && v !== '无') parts.push(v);
  }
  return parts.join('、');
}

/** 从 brand_colors.json 构建 brand → {color, isPrimary} 映射 */
export function buildBrandColorMap(doc: BrandColorsDoc): Map<string, BrandColor> {
  const map = new Map<string, BrandColor>();
  for (const b of doc.brands) {
    map.set(b.name, { color: b.color, isPrimary: true });
  }
  const otherColor = doc.other.color;
  for (const name of [...doc.other.frequency_2_brands, ...doc.other.frequency_1_brands]) {
    if (!map.has(name)) map.set(name, { color: otherColor, isPrimary: false });
  }
  return map;
}

export function colorOf(map: Map<string, BrandColor>, brand: string): BrandColor {
  return map.get(brand) ?? { color: '#525252', isPrimary: false };
}

/** CSV 行 → Vehicle（脏数据/缺品牌返回 null） */
export function rowToVehicle(
  row: Record<string, string>,
  week: string,
  brandColorMap: Map<string, BrandColor>,
): Vehicle | null {
  const name = (row['车型名称'] || '').trim();
  if (!name) return null;
  const brand = normalizeBrand(row['品牌'] || '');
  if (!brand) return null;
  const bc = colorOf(brandColorMap, brand);
  const { min, max } = parsePrice(row['价格区间'] || '');
  return {
    id: name,
    name,
    brand,
    brandColor: bc.color,
    isPrimaryBrand: bc.isPrimary,
    releaseDate: parseReleaseDate(row['上市/发布时间'] || ''),
    priceRange: (row['价格区间'] || '').trim(),
    priceMin: min,
    priceMax: max,
    positioning: (row['车型定位'] || '').trim(),
    dimensions: (row['车身尺寸'] || '').trim(),
    wheelbase: parseWheelbase(row['轴距'] || ''),
    powertrain: (row['动力类型'] || '').trim(),
    power: (row['系统功率'] || '').trim(),
    acceleration: (row['0-100km/h'] || '').trim(),
    batteryCapacity: (row['电池容量'] || '').trim(),
    rangeCltc: (row['CLTC续航'] || '').trim(),
    adasChip: (row['智驾芯片'] || '').trim(),
    lidar: (row['激光雷达'] || '').trim(),
    computingPower: (row['计算力TOPS'] || '').trim(),
    cabinChip: (row['座舱芯片'] || '').trim(),
    screen: (row['屏幕配置'] || '').trim(),
    highlights: mergeHighlights(row),
    competitors: mergeCompetitors(row),
    source: (row['信息来源'] || '').trim(),
    week,
  };
}

/** 动力类型归并为大类（覆盖双动力/变体/字段错位脏数据） */
export function classifyPowertrain(p: string): string {
  const s = (p || '').trim();
  if (!s) return '未知';
  if (/^\d+$/.test(s)) return '未知'; // 字段错位（如轴距数值）
  if (/^[—\-－]+$/.test(s)) return '未知';
  const lower = s.toLowerCase();
  if (/增程|erev|reev/.test(lower)) return '增程';
  if (/插混|插电|phev|dm[- ]?i|dm[- ]?5|hi4|混动|hybrid/.test(lower)) return '插混';
  if (/燃油|汽油|柴油/.test(lower)) return '燃油';
  if (/纯电|bev|ev\b|electric/.test(lower)) return '纯电';
  if (/氢/.test(lower)) return '氢能';
  return s;
}

/** 价格带分段（按起售价 priceMin） */
export function classifyPriceBand(min: number | null): string {
  if (min === null) return '待公布';
  if (min < 10) return '10万内';
  if (min < 15) return '10-15万';
  if (min < 20) return '15-20万';
  if (min < 30) return '20-30万';
  return '30万以上';
}
