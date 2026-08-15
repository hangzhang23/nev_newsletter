import { useEffect, useMemo, useRef } from 'react';
import echarts from '../../lib/echarts';
import { useStore } from '../../store/useStore';
import { classifyPriceBand } from '../../lib/filter';
import { getChartTheme } from '../../lib/chartTheme';
import styles from './BrandsView.module.css';

export default function BrandsView() {
  const brands = useStore((s) => s.brands);
  const vehicles = useStore((s) => s.vehicles);
  const loaded = useStore((s) => s.loaded);
  const donutRef = useRef<HTMLDivElement>(null);

  const priceBands = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vehicles) {
      const b = classifyPriceBand(v.priceMin);
      m.set(b, (m.get(b) ?? 0) + 1);
    }
    const order = ['10万内', '10-15万', '15-20万', '20-30万', '30万以上', '待公布'];
    return order.filter((o) => m.has(o)).map((o) => ({ band: o, count: m.get(o)! }));
  }, [vehicles]);

  useEffect(() => {
    const el = donutRef.current;
    if (!el || priceBands.length === 0) return;
    const t = getChartTheme();

    let chart: ReturnType<typeof echarts.init> | null = null;
    try {
      chart = echarts.init(el);
    } catch (e) {
      console.error('品牌分布图初始化失败', e);
      return;
    }
    chart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: t.surface,
        borderColor: t.border,
        textStyle: { color: t.text },
        formatter: '{b}: {c} 款 ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: t.bg, borderWidth: 2 },
          label: { color: t.text2, fontSize: 12 },
          data: priceBands.map((p) => ({ name: p.band, value: p.count })),
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [priceBands]);

  if (!loaded) return <div className={styles.loading}>加载中…</div>;

  const maxFreq = brands[0]?.frequency ?? 1;

  return (
    <div>
      <h2 className={styles.title}>品牌分布</h2>
      <div className={styles.layout}>
        <section className={styles.panel}>
          <h3>品牌发布频次</h3>
          <div className={styles.brandList}>
            {brands.map((b) => (
              <div key={b.name} className={styles.brandRow}>
                <span className={styles.brandDot} style={{ background: b.color }} />
                <span className={styles.brandName}>{b.name}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(b.frequency / maxFreq) * 100}%`, background: b.color }}
                  />
                </div>
                <span className={styles.brandFreq}>{b.frequency}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h3>价格带分布</h3>
          <div ref={donutRef} className={styles.donut} />
          <div className={styles.legend}>
            {priceBands.map((p) => (
              <span key={p.band} className={styles.legendItem}>
                {p.band} <b>{p.count}</b>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
