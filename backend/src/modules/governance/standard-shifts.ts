/**
 * Standard operational shifts — company modes:
 * 1) HOURS_24 — sequential operational shifts
 * 2) HOURS_12 — FIXED single period OR TWO_PERIODS
 */

export type StandardShiftDef = {
  code: string;
  modePack: 'HOURS_24' | 'HOURS_12_FIXED' | 'HOURS_12_TWO';
  nameAr: string;
  nameEn: string;
  startTime: string;
  endTime: string;
  sequenceIndex: number;
  crossesMidnight?: boolean;
};

/** 1) دوام 24 ساعة — ورديات تشغيلية متعاقبة (3 × 8 ساعات من 06:00). */
export const SHIFTS_24H_8H: StandardShiftDef[] = [
  {
    code: 'H24_MORNING',
    modePack: 'HOURS_24',
    nameAr: 'دوام 24 — وردية صباحية',
    nameEn: '24h — Morning shift',
    startTime: '06:00',
    endTime: '14:00',
    sequenceIndex: 0,
  },
  {
    code: 'H24_EVENING',
    modePack: 'HOURS_24',
    nameAr: 'دوام 24 — وردية مسائية',
    nameEn: '24h — Evening shift',
    startTime: '14:00',
    endTime: '22:00',
    sequenceIndex: 1,
  },
  {
    code: 'H24_NIGHT',
    modePack: 'HOURS_24',
    nameAr: 'دوام 24 — وردية ليلية',
    nameEn: '24h — Night shift',
    startTime: '22:00',
    endTime: '06:00',
    sequenceIndex: 2,
    crossesMidnight: true,
  },
];

/** 2a) دوام 12 ساعة — ثابت (فترة واحدة). */
export const SHIFTS_12H_FIXED: StandardShiftDef[] = [
  {
    code: 'H12_FIXED',
    modePack: 'HOURS_12_FIXED',
    nameAr: 'دوام 12 (ثابت) — وردية نهارية',
    nameEn: '12h fixed — Day shift',
    startTime: '09:00',
    endTime: '21:00',
    sequenceIndex: 10,
  },
];

/** 2b) دوام 12 ساعة — بفترتين. */
export const SHIFTS_12H_TWO_PERIODS: StandardShiftDef[] = [
  {
    code: 'H12_P1',
    modePack: 'HOURS_12_TWO',
    nameAr: 'دوام 12 (فترتين) — فترة أولى نهارية',
    nameEn: '12h two periods — Period 1 day',
    startTime: '08:00',
    endTime: '20:00',
    sequenceIndex: 20,
  },
  {
    code: 'H12_P2',
    modePack: 'HOURS_12_TWO',
    nameAr: 'دوام 12 (فترتين) — فترة ثانية ليلية',
    nameEn: '12h two periods — Period 2 night',
    startTime: '20:00',
    endTime: '08:00',
    sequenceIndex: 21,
    crossesMidnight: true,
  },
];

/** Full roster for company work type (24h + 12h only). */
export const ALL_STANDARD_SHIFTS: StandardShiftDef[] = [
  ...SHIFTS_24H_8H,
  ...SHIFTS_12H_FIXED,
  ...SHIFTS_12H_TWO_PERIODS,
];

export function displayShiftName(def: StandardShiftDef, locale: 'ar' | 'en' = 'ar') {
  return locale === 'en' ? def.nameEn : def.nameAr;
}

export function autoShiftLabel(index: number, locale: 'ar' | 'en' = 'ar'): string {
  const ar = ['وردية أولى', 'وردية ثانية', 'وردية ثالثة', 'وردية رابعة'];
  const en = ['Shift 1', 'Shift 2', 'Shift 3', 'Shift 4'];
  if (locale === 'en') return en[index] ?? `Shift ${index + 1}`;
  return ar[index] ?? `وردية ${index + 1}`;
}
