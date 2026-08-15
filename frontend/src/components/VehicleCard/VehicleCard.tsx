import type { Vehicle } from '../../types/models';
import { useStore } from '../../store/useStore';
import styles from './VehicleCard.module.css';

export default function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const openDetail = useStore((s) => s.openDetail);

  const specs = [
    vehicle.powertrain,
    vehicle.rangeCltc ? `${vehicle.rangeCltc}` : null,
    vehicle.wheelbase ? `轴距 ${vehicle.wheelbase}mm` : null,
  ].filter(Boolean) as string[];

  return (
    <button className={styles.card} onClick={() => openDetail(vehicle)} style={{ borderLeftColor: vehicle.brandColor }}>
      <div className={styles.top}>
        <span className={styles.brand} style={{ color: vehicle.brandColor }}>
          {vehicle.brand}
        </span>
        <span className={styles.week}>{vehicle.week}</span>
      </div>
      <div className={styles.name}>{vehicle.name}</div>
      <div className={styles.price}>{vehicle.priceRange || '价格待公布'}</div>
      <div className={styles.positioning}>{vehicle.positioning}</div>
      <div className={styles.specs}>
        {specs.slice(0, 3).map((s) => (
          <span key={s} className={styles.spec}>
            {s}
          </span>
        ))}
      </div>
    </button>
  );
}
