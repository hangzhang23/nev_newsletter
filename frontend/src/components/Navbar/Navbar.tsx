import { NavLink } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import styles from './Navbar.module.css';

const TABS = [
  { to: '/', label: '时间轴' },
  { to: '/monthly', label: '月度综述' },
  { to: '/brands', label: '品牌分布' },
  { to: '/weekly', label: '周报库' },
];

export default function Navbar() {
  const keyword = useStore((s) => s.keyword);
  const setKeyword = useStore((s) => s.setKeyword);

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          电车<span className={styles.accent}>周志</span>
        </div>
        <nav className={styles.tabs}>
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.active}` : styles.tab
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <input
          className={styles.search}
          type="search"
          placeholder="搜索车型 / 品牌 / 亮点"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>
    </header>
  );
}
