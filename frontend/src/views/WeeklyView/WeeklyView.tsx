import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { applyFilters } from '../../lib/filter';
import type { Vehicle } from '../../types/models';
import styles from './WeeklyView.module.css';

export default function WeeklyView() {
  const vehicles = useStore((s) => s.vehicles);
  const filters = useStore((s) => s.filters);
  const keyword = useStore((s) => s.keyword);
  const loaded = useStore((s) => s.loaded);
  const openDetail = useStore((s) => s.openDetail);

  const filtered = useMemo(
    () => applyFilters(vehicles, filters, keyword),
    [vehicles, filters, keyword],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Vehicle[]>();
    for (const v of filtered) {
      if (!m.has(v.week)) m.set(v.week, []);
      m.get(v.week)!.push(v);
    }
    return [...m.entries()].sort((a, b) => Number(b[0].slice(1)) - Number(a[0].slice(1)));
  }, [filtered]);

  if (!loaded) return <div className={styles.loading}>加载中…</div>;

  return (
    <div>
      <h2 className={styles.title}>周报库</h2>
      {grouped.map(([week, list]) => (
        <section key={week} className={styles.week}>
          <h3 className={styles.weekHeader}>
            {week}
            <span className={styles.weekCount}>{list.length} 款</span>
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>车型</th>
                  <th>品牌</th>
                  <th>价格</th>
                  <th>定位</th>
                  <th>动力</th>
                  <th>续航</th>
                  <th>发布日期</th>
                </tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id} onClick={() => openDetail(v)}>
                    <td data-label="车型" className={styles.name}>
                      {v.name}
                    </td>
                    <td data-label="品牌" style={{ color: v.brandColor }}>
                      {v.brand}
                    </td>
                    <td data-label="价格" className={styles.price}>
                      {v.priceRange}
                    </td>
                    <td data-label="定位">{v.positioning}</td>
                    <td data-label="动力">{v.powertrain}</td>
                    <td data-label="续航">{v.rangeCltc}</td>
                    <td data-label="发布日期">{v.releaseDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {grouped.length === 0 && <div className={styles.empty}>无匹配车型</div>}
    </div>
  );
}
