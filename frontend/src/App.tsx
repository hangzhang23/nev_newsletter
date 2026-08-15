import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import TimelineView from './views/TimelineView/TimelineView';
import MonthlyView from './views/MonthlyView/MonthlyView';
import BrandsView from './views/BrandsView/BrandsView';
import WeeklyView from './views/WeeklyView/WeeklyView';
import { useStaticData } from './hooks/useStaticData';

export default function App() {
  useStaticData();
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<TimelineView />} />
        <Route path="/monthly" element={<MonthlyView />} />
        <Route path="/brands" element={<BrandsView />} />
        <Route path="/weekly" element={<WeeklyView />} />
      </Routes>
    </Layout>
  );
}
