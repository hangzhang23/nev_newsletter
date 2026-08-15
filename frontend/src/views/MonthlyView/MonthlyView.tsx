import { useStore } from '../../store/useStore';
import { formatMonth } from '../../lib/format';
import { brandColorOf, buildBrandColorMap } from '../../lib/brandColors';
import styles from './MonthlyView.module.css';

export default function MonthlyView() {
  const monthly = useStore((s) => s.monthly);
  const brands = useStore((s) => s.brands);
  const loaded = useStore((s) => s.loaded);
  const colorMap = buildBrandColorMap(brands);
  const list = [...monthly].reverse();

  if (!loaded) return <div className={styles.loading}>加载中…</div>;

  return (
    <div>
      <h2 className={styles.title}>月度综述</h2>
      <div className={styles.cards}>
        {list.map((m) => (
          <section key={m.month} className={styles.card}>
            <header className={styles.header}>
              <h3 className={styles.month}>{formatMonth(m.month)}</h3>
              <span className={styles.total}>{m.total} 款</span>
            </header>

            <div className={styles.section}>
              <h4>价格带分布</h4>
              {m.priceBands.map((b) => (
                <div key={b.band} className={styles.barRow}>
                  <span className={styles.barLabel}>{b.band}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(b.count / m.total) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barCount}>{b.count}</span>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <h4>动力类型</h4>
              <div className={styles.tags}>
                {m.powertrains.map((p) => (
                  <span key={p.type} className={styles.tag}>
                    {p.type} {p.count}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h4>品牌 Top5</h4>
              <div className={styles.tags}>
                {m.topBrands.map((b) => (
                  <span
                    key={b.brand}
                    className={styles.brandTag}
                    style={{ color: brandColorOf(colorMap, b.brand) }}
                  >
                    {b.brand} {b.count}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
