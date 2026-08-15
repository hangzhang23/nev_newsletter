import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Brand, MonthlySummary, TrendWeek, Vehicle } from '../types/models';

const BASE = import.meta.env.BASE_URL;

/** 加载 4 个预渲染静态 JSON（一期唯一数据来源，不调用 /api） */
export function useStaticData(): void {
  const setData = useStore((s) => s.setData);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vehicles, trends, brands, monthly] = (await Promise.all([
          fetch(`${BASE}data/vehicles.json`).then((r) => r.json()),
          fetch(`${BASE}data/trend_weekly.json`).then((r) => r.json()),
          fetch(`${BASE}data/brands_dist.json`).then((r) => r.json()),
          fetch(`${BASE}data/monthly.json`).then((r) => r.json()),
        ])) as [Vehicle[], TrendWeek[], Brand[], MonthlySummary[]];
        if (!cancelled) {
          setData({ vehicles, trends, brands, monthly, loaded: true });
        }
      } catch (e) {
        console.error('加载静态数据失败', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setData]);
}
