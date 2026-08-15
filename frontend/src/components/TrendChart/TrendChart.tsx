import { useEffect, useMemo, useRef } from 'react';
import echarts from '../../lib/echarts';
import { useStore } from '../../store/useStore';
import { OTHER_COLOR } from '../../lib/brandColors';
import { getChartTheme } from '../../lib/chartTheme';
import type { TrendWeek } from '../../types/models';
import styles from './TrendChart.module.css';

/** 非独立配色（发布频次少、归入灰色）的品牌，在走势图中统一合并展示为「其他」 */
const OTHER_LABEL = '其他';

export default function TrendChart({ data }: { data: TrendWeek[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const brands = useStore((s) => s.brands);

  // 独立配色品牌集合（isPrimary）；其余一律归并为「其他」
  const primaryBrands = useMemo(
    () => new Set(brands.filter((b) => b.isPrimary).map((b) => b.name)),
    [brands],
  );

  // 合并后的趋势数据 + 品牌颜色映射（含「其他」）
  const { merged, colorMap } = useMemo(() => {
    const mergedData: TrendWeek[] = data.map((d) => {
      const byBrand = new Map<string, number>();
      for (const b of d.byBrand) {
        const key = primaryBrands.has(b.brand) ? b.brand : OTHER_LABEL;
        byBrand.set(key, (byBrand.get(key) ?? 0) + b.count);
      }
      return {
        ...d,
        byBrand: [...byBrand.entries()].map(([brand, count]) => ({ brand, count })),
      };
    });
    const cm = new Map<string, string>();
    for (const b of brands) cm.set(b.name, b.color);
    cm.set(OTHER_LABEL, OTHER_COLOR);
    return { merged: mergedData, colorMap: cm };
  }, [data, brands, primaryBrands]);

  useEffect(() => {
    const el = ref.current;
    if (!el || merged.length === 0) return;
    const t = getChartTheme();

    let chart: ReturnType<typeof echarts.init> | null = null;
    try {
      chart = echarts.init(el);
    } catch (e) {
      console.error('走势图初始化失败', e);
      return;
    }

    // 品牌按总频次降序，保证堆积顺序稳定
    const brandTotal = new Map<string, number>();
    for (const d of merged) {
      for (const b of d.byBrand) {
        brandTotal.set(b.brand, (brandTotal.get(b.brand) ?? 0) + b.count);
      }
    }
    const brandOrder = [...brandTotal.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand);

    const series = brandOrder.map((brand) => ({
      name: brand,
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 36,
      itemStyle: { color: colorMap.get(brand) ?? OTHER_COLOR },
      emphasis: { focus: 'series' as const },
      data: merged.map((d) => d.byBrand.find((b) => b.brand === brand)?.count ?? 0),
    }));

    // x 轴：周标签 + 月份（仅月份变化处额外显示年月，如 2026-04）
    const monthAtWeek = new Map<string, string>();
    merged.forEach((d, i) => {
      const m = d.end.slice(0, 7);
      const prevM = i > 0 ? merged[i - 1].end.slice(0, 7) : '';
      if (i === 0 || m !== prevM) monthAtWeek.set(d.week, m);
    });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: t.surface,
        borderColor: t.border,
        textStyle: { color: t.text },
      },
      legend: {
        type: 'scroll',
        top: 0,
        textStyle: { color: t.text2, fontSize: 12 },
        pageIconColor: t.accent,
        pageTextStyle: { color: t.text2 },
      },
      grid: { left: 8, right: 8, top: 44, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: merged.map((d) => d.week),
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: true },
        axisLabel: {
          color: t.text2,
          interval: 0,
          formatter: (value: string) => {
            const m = monthAtWeek.get(value);
            return m ? `{week|${value}}\n{month|${m}}` : value;
          },
          rich: {
            week: { fontSize: 12, lineHeight: 16 },
            month: { fontSize: 10, color: t.text3, lineHeight: 14 },
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.border2 } },
        axisLabel: { color: t.text2 },
      },
      series,
    });

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [merged, colorMap]);

  return <div ref={ref} className={styles.chart} />;
}
