import { useStore } from '../../store/useStore';
import { applyFilters } from '../../lib/filter';
import styles from './FilterBar.module.css';

const PRICE_STOPS = [
  { value: '', label: '最低价' },
  { value: '10', label: '10万' },
  { value: '15', label: '15万' },
  { value: '20', label: '20万' },
  { value: '30', label: '30万' },
];

const PT_OPTIONS = ['纯电', '插混', '增程', '燃油', '氢能'];

const POSITION_KEYWORDS = ['轿车', 'SUV', 'MPV', '轿跑', '越野', '皮卡', '旅行车', '轻客', '跑车'];

const MONTH_LABEL: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月', '05': '5月', '06': '6月',
  '07': '7月', '08': '8月', '09': '9月', '10': '10月', '11': '11月', '12': '12月',
};

function monthLabel(m: string): string {
  const [y, mm] = m.split('-');
  return `${y}年${MONTH_LABEL[mm] ?? mm}月`;
}

export default function FilterBar() {
  const vehicles = useStore((s) => s.vehicles);
  const brands = useStore((s) => s.brands);
  const filters = useStore((s) => s.filters);
  const keyword = useStore((s) => s.keyword);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);

  const months = [...new Set(vehicles.map((v) => v.releaseDate.slice(0, 7)).filter(Boolean))].sort();
  const positionOptions = POSITION_KEYWORDS.filter((k) => vehicles.some((v) => v.positioning.includes(k)));

  const filtered = applyFilters(vehicles, filters, keyword);
  const hasFilter = Object.values(filters).some((v) => v !== undefined) || keyword !== '';

  const num = (v: string): number | undefined => (v === '' ? undefined : Number(v));

  return (
    <div className={styles.bar}>
      <div className={styles.filters}>
        <select value={filters.brand ?? ''} onChange={(e) => setFilter('brand', e.target.value || undefined)}>
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}（{b.frequency}）
            </option>
          ))}
        </select>

        <select value={filters.priceMin ?? ''} onChange={(e) => setFilter('priceMin', num(e.target.value))}>
          {PRICE_STOPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select value={filters.priceMax ?? ''} onChange={(e) => setFilter('priceMax', num(e.target.value))}>
          <option value="">最高价</option>
          <option value="10">10万</option>
          <option value="15">15万</option>
          <option value="20">20万</option>
          <option value="30">30万</option>
        </select>

        <select
          value={filters.powertrain ?? ''}
          onChange={(e) => setFilter('powertrain', e.target.value || undefined)}
        >
          <option value="">全部动力</option>
          {PT_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={filters.positioning ?? ''}
          onChange={(e) => setFilter('positioning', e.target.value || undefined)}
        >
          <option value="">全部定位</option>
          {positionOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select value={filters.date ?? ''} onChange={(e) => setFilter('date', e.target.value || undefined)}>
          <option value="">全部月份</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.stats}>
        <span className={styles.count}>
          共 <b>{filtered.length}</b> / {vehicles.length} 款
        </span>
        {hasFilter && (
          <button className={styles.clear} onClick={clearFilters}>
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}
