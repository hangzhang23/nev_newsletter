import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { Vehicle } from '../../types/models';
import styles from './VehicleDetailDrawer.module.css';

function Field({ label, value }: { label: string; value: string | number | null }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{display}</span>
    </div>
  );
}

export default function VehicleDetailDrawer() {
  const vehicle = useStore((s) => s.selectedVehicle);
  const close = useStore((s) => s.closeDetail);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (vehicle) {
      window.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [vehicle, close]);

  if (!vehicle) return null;

  const v: Vehicle = vehicle;
  const fields: [string, string | number | null][] = [
    ['上市/发布时间', v.releaseDate],
    ['价格区间', v.priceRange],
    ['车型定位', v.positioning],
    ['车身尺寸', v.dimensions],
    ['轴距', v.wheelbase ? `${v.wheelbase}mm` : null],
    ['动力类型', v.powertrain],
    ['系统功率', v.power],
    ['0-100km/h', v.acceleration],
    ['电池容量', v.batteryCapacity],
    ['CLTC续航', v.rangeCltc],
    ['智驾芯片', v.adasChip],
    ['激光雷达', v.lidar],
    ['计算力 TOPS', v.computingPower],
    ['座舱芯片', v.cabinChip],
    ['屏幕配置', v.screen],
    ['核心亮点', v.highlights],
    ['竞品', v.competitors],
    ['信息来源', v.source],
    ['周次', v.week],
  ];

  return (
    <div className={styles.overlay} onClick={close}>
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <div className={styles.brand} style={{ color: v.brandColor }}>
              {v.brand}
            </div>
            <h2 className={styles.name}>{v.name}</h2>
          </div>
          <button className={styles.close} onClick={close} aria-label="关闭">
            ×
          </button>
        </header>
        <div className={styles.price}>{v.priceRange || '价格待公布'}</div>
        <div className={styles.body}>
          {fields.map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
        </div>
      </aside>
    </div>
  );
}
