import type { Brand } from '../types/models';

/** 兜底色 = brand_colors.json 中「其他」品牌的灰色 */
export const OTHER_COLOR = '#525252';

/** 从 brands 数据构建 brand → color 映射（颜色唯一来自数据，禁止硬编码） */
export function buildBrandColorMap(brands: Brand[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of brands) m.set(b.name, b.color);
  return m;
}

export function brandColorOf(map: Map<string, string>, brand: string): string {
  return map.get(brand) ?? OTHER_COLOR;
}
