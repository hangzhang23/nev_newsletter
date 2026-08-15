import { create } from 'zustand';
import type { Brand, MonthlySummary, TrendWeek, Vehicle } from '../types/models';

export interface Filters {
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  powertrain?: string;
  positioning?: string;
  date?: string;
}

interface StoreState {
  vehicles: Vehicle[];
  trends: TrendWeek[];
  brands: Brand[];
  monthly: MonthlySummary[];
  loaded: boolean;
  filters: Filters;
  keyword: string;
  selectedVehicle: Vehicle | null;
  setData: (d: Partial<Pick<StoreState, 'vehicles' | 'trends' | 'brands' | 'monthly' | 'loaded'>>) => void;
  setFilter: (k: keyof Filters, v: string | number | undefined) => void;
  setKeyword: (k: string) => void;
  clearFilters: () => void;
  openDetail: (v: Vehicle) => void;
  closeDetail: () => void;
}

export const useStore = create<StoreState>((set) => ({
  vehicles: [],
  trends: [],
  brands: [],
  monthly: [],
  loaded: false,
  filters: {},
  keyword: '',
  selectedVehicle: null,
  setData: (d) => set(d),
  setFilter: (k, v) =>
    set((s) => ({
      filters: { ...s.filters, [k]: v === '' || v === undefined ? undefined : v },
    })),
  setKeyword: (k) => set({ keyword: k }),
  clearFilters: () => set({ filters: {}, keyword: '' }),
  openDetail: (v) => set({ selectedVehicle: v }),
  closeDetail: () => set({ selectedVehicle: null }),
}));
