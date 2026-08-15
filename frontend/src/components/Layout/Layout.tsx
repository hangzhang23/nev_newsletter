import type { ReactNode } from 'react';
import Navbar from '../Navbar/Navbar';
import VehicleDetailDrawer from '../VehicleDetailDrawer/VehicleDetailDrawer';
import styles from './Layout.module.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <Navbar />
      <main className={styles.main}>{children}</main>
      <VehicleDetailDrawer />
    </div>
  );
}
