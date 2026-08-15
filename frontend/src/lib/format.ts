const MONTH_LABEL: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月', '05': '5月', '06': '6月',
  '07': '7月', '08': '8月', '09': '9月', '10': '10月', '11': '11月', '12': '12月',
};

export function formatMonth(m: string): string {
  const [y, mm] = m.split('-');
  return `${y}年${MONTH_LABEL[mm] ?? mm}月`;
}
