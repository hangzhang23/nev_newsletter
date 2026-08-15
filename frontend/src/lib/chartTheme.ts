// ECharts 图表主题色 —— 从 CSS tokens 动态读取，禁止硬编码 hex 字面量

export interface ChartTheme {
  text: string;
  text2: string;
  text3: string;
  surface: string;
  surface2: string;
  border: string;
  border2: string;
  bg: string;
  accent: string;
  accent2: string;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartTheme(): ChartTheme {
  return {
    text: cssVar('--text'),
    text2: cssVar('--text-2'),
    text3: cssVar('--text-3'),
    surface: cssVar('--surface'),
    surface2: cssVar('--surface-2'),
    border: cssVar('--border'),
    border2: cssVar('--border-2'),
    bg: cssVar('--bg'),
    accent: cssVar('--accent'),
    accent2: cssVar('--accent-2'),
  };
}
