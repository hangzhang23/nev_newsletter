import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { applyFilters, buildTrendByWeek } from '../../lib/filter';
import { formatMonth } from '../../lib/format';
import TrendChart from '../../components/TrendChart/TrendChart';
import FilterBar from '../../components/FilterBar/FilterBar';
import VehicleCard from '../../components/VehicleCard/VehicleCard';
import type { Vehicle } from '../../types/models';
import styles from './TimelineView.module.css';

export default function TimelineView() {
  const vehicles = useStore((s) => s.vehicles);
  const trends = useStore((s) => s.trends);
  const filters = useStore((s) => s.filters);
  const keyword = useStore((s) => s.keyword);
  const loaded = useStore((s) => s.loaded);

  const filtered = useMemo(
    () => applyFilters(vehicles, filters, keyword),
    [vehicles, filters, keyword],
  );

  // 走势图随筛选同步：用筛选后的车辆重新聚合周度数据（周范围保持完整）
  const trendData = useMemo(() => {
    const metas = trends.map((t) => ({ week: t.week, start: t.start, end: t.end }));
    return buildTrendByWeek(filtered, metas);
  }, [filtered, trends]);

  const grouped = useMemo(() => {
    const m = new Map<string, Vehicle[]>();
    for (const v of filtered) {
      const key = v.releaseDate.slice(0, 7) || '未知';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(v);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // null = 初始状态（仅展开最新月）
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  if (!loaded) return <div className={styles.loading}>加载中…</div>;

  const latestMonth = grouped[0]?.[0];
  const isOpen = (key: string) =>
    expanded === null ? key === latestMonth : expanded.has(key);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const base = prev === null ? new Set(latestMonth ? [latestMonth] : []) : new Set(prev);
      if (base.has(key)) base.delete(key);
      else base.add(key);
      return base;
    });
  };

  return (
    <div>
      <section className={styles.trendCard}>
        <h2 className={styles.title}>发布走势（近一年 · 周粒度 · 品牌堆积）</h2>
        <TrendChart data={trendData} />
      </section>

      <FilterBar />

      {grouped.map(([month, list]) => {
        const open = isOpen(month);
        return (
          <section key={month} className={styles.month}>
            <button className={styles.monthHeader} onClick={() => toggle(month)}>
              <span className={styles.monthName}>{formatMonth(month)}</span>
              <span className={styles.monthCount}>{list.length} 款</span>
              <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
            </button>
            {open && (
              <div className={styles.grid}>
                {list.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {grouped.length === 0 && <div className={styles.empty}>无匹配车型</div>}
    </div>
  );
}
