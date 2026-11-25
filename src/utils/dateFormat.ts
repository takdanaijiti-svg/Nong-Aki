export function getLocalDateString(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalTimeString(): string {
  const date = new Date();
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const THAI_DAYS = [
  'อาทิตย์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
];

export function getThaiDayOfWeek(): string {
  return THAI_DAYS[new Date().getDay()] ?? '';
}

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function formatThaiDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const today = getLocalDateString(0);
  const tomorrow = getLocalDateString(1);
  const yesterday = getLocalDateString(-1);

  if (dateStr === today) return 'วันนี้';
  if (dateStr === tomorrow) return 'พรุ่งนี้';
  if (dateStr === yesterday) return 'เมื่อวาน';

  const [y, m, d] = dateStr.split('-').map(Number);
  const thaiYearShort = String((y + 543) % 100).padStart(2, '0');
  return `${d} ${THAI_MONTHS_SHORT[m - 1] ?? ''} ${thaiYearShort}`;
}

export function formatThaiDateFull(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const thaiYearShort = String((y + 543) % 100).padStart(2, '0');
  const label = `${d} ${THAI_MONTHS_SHORT[m - 1] ?? ''} ${thaiYearShort}`;
  const today = getLocalDateString(0);
  const tomorrow = getLocalDateString(1);
  if (dateStr === today) return `วันนี้ · ${label}`;
  if (dateStr === tomorrow) return `พรุ่งนี้ · ${label}`;
  return label;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
