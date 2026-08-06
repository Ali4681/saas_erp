export type LookupOption = {
  value: string;
  label: string;
  labelAr: string;
};

export const COUNTRIES: LookupOption[] = [
  { value: 'SA', label: 'Saudi Arabia', labelAr: 'السعودية' },
  { value: 'AE', label: 'United Arab Emirates', labelAr: 'الإمارات' },
  { value: 'KW', label: 'Kuwait', labelAr: 'الكويت' },
  { value: 'QA', label: 'Qatar', labelAr: 'قطر' },
  { value: 'BH', label: 'Bahrain', labelAr: 'البحرين' },
  { value: 'OM', label: 'Oman', labelAr: 'عُمان' },
  { value: 'IQ', label: 'Iraq', labelAr: 'العراق' },
  { value: 'JO', label: 'Jordan', labelAr: 'الأردن' },
  { value: 'EG', label: 'Egypt', labelAr: 'مصر' },
  { value: 'PS', label: 'Palestine', labelAr: 'فلسطين' },
  { value: 'LB', label: 'Lebanon', labelAr: 'لبنان' },
  { value: 'SY', label: 'Syria', labelAr: 'سوريا' },
  { value: 'YE', label: 'Yemen', labelAr: 'اليمن' },
  { value: 'SD', label: 'Sudan', labelAr: 'السودان' },
  { value: 'MA', label: 'Morocco', labelAr: 'المغرب' },
  { value: 'TN', label: 'Tunisia', labelAr: 'تونس' },
  { value: 'DZ', label: 'Algeria', labelAr: 'الجزائر' },
  { value: 'LY', label: 'Libya', labelAr: 'ليبيا' },
  { value: 'TR', label: 'Turkey', labelAr: 'تركيا' },
  { value: 'US', label: 'United States', labelAr: 'الولايات المتحدة' },
  { value: 'GB', label: 'United Kingdom', labelAr: 'المملكة المتحدة' },
  { value: 'DE', label: 'Germany', labelAr: 'ألمانيا' },
  { value: 'FR', label: 'France', labelAr: 'فرنسا' },
  { value: 'IN', label: 'India', labelAr: 'الهند' },
  { value: 'CN', label: 'China', labelAr: 'الصين' },
  { value: 'PK', label: 'Pakistan', labelAr: 'باكستان' },
];

export const CURRENCIES: LookupOption[] = [
  { value: 'SAR', label: 'Saudi Riyal', labelAr: 'ريال سعودي' },
  { value: 'AED', label: 'UAE Dirham', labelAr: 'درهم إماراتي' },
  { value: 'KWD', label: 'Kuwaiti Dinar', labelAr: 'دينار كويتي' },
  { value: 'QAR', label: 'Qatari Riyal', labelAr: 'ريال قطري' },
  { value: 'BHD', label: 'Bahraini Dinar', labelAr: 'دينار بحريني' },
  { value: 'OMR', label: 'Omani Rial', labelAr: 'ريال عُماني' },
  { value: 'IQD', label: 'Iraqi Dinar', labelAr: 'دينار عراقي' },
  { value: 'JOD', label: 'Jordanian Dinar', labelAr: 'دينار أردني' },
  { value: 'EGP', label: 'Egyptian Pound', labelAr: 'جنيه مصري' },
  { value: 'USD', label: 'US Dollar', labelAr: 'دولار أمريكي' },
  { value: 'EUR', label: 'Euro', labelAr: 'يورو' },
  { value: 'GBP', label: 'British Pound', labelAr: 'جنيه إسترليني' },
  { value: 'TRY', label: 'Turkish Lira', labelAr: 'ليرة تركية' },
  { value: 'INR', label: 'Indian Rupee', labelAr: 'روبية هندية' },
  { value: 'CNY', label: 'Chinese Yuan', labelAr: 'يوان صيني' },
];

export const LANGUAGES: LookupOption[] = [
  { value: 'ar', label: 'Arabic', labelAr: 'العربية' },
  { value: 'en', label: 'English', labelAr: 'الإنجليزية' },
  { value: 'fr', label: 'French', labelAr: 'الفرنسية' },
  { value: 'tr', label: 'Turkish', labelAr: 'التركية' },
  { value: 'ur', label: 'Urdu', labelAr: 'الأردية' },
  { value: 'hi', label: 'Hindi', labelAr: 'الهندية' },
  { value: 'de', label: 'German', labelAr: 'الألمانية' },
  { value: 'es', label: 'Spanish', labelAr: 'الإسبانية' },
];

export const TIMEZONES: LookupOption[] = [
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (UTC+3)', labelAr: 'الرياض (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)', labelAr: 'دبي (UTC+4)' },
  { value: 'Asia/Kuwait', label: 'Asia/Kuwait (UTC+3)', labelAr: 'الكويت (UTC+3)' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar (UTC+3)', labelAr: 'قطر (UTC+3)' },
  { value: 'Asia/Bahrain', label: 'Asia/Bahrain (UTC+3)', labelAr: 'البحرين (UTC+3)' },
  { value: 'Asia/Muscat', label: 'Asia/Muscat (UTC+4)', labelAr: 'مسقط (UTC+4)' },
  { value: 'Asia/Baghdad', label: 'Asia/Baghdad (UTC+3)', labelAr: 'بغداد (UTC+3)' },
  { value: 'Asia/Amman', label: 'Asia/Amman (UTC+3)', labelAr: 'عمّان (UTC+3)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (UTC+2)', labelAr: 'القاهرة (UTC+2)' },
  { value: 'Asia/Beirut', label: 'Asia/Beirut (UTC+2/+3)', labelAr: 'بيروت' },
  { value: 'Asia/Damascus', label: 'Asia/Damascus (UTC+3)', labelAr: 'دمشق (UTC+3)' },
  { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem', labelAr: 'القدس' },
  { value: 'Africa/Khartoum', label: 'Africa/Khartoum (UTC+2)', labelAr: 'الخرطوم (UTC+2)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca', labelAr: 'الدار البيضاء' },
  { value: 'Africa/Tunis', label: 'Africa/Tunis', labelAr: 'تونس' },
  { value: 'Africa/Algiers', label: 'Africa/Algiers', labelAr: 'الجزائر' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)', labelAr: 'إسطنبول (UTC+3)' },
  { value: 'Europe/London', label: 'Europe/London', labelAr: 'لندن' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin', labelAr: 'برلين' },
  { value: 'Europe/Paris', label: 'Europe/Paris', labelAr: 'باريس' },
  { value: 'America/New_York', label: 'America/New_York', labelAr: 'نيويورك' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles', labelAr: 'لوس أنجلوس' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata', labelAr: 'كولكاتا' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai', labelAr: 'شنغهاي' },
  { value: 'UTC', label: 'UTC', labelAr: 'UTC' },
];

export const LOOKUP_DEFAULTS = {
  countryCode: 'SA',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  city: 'Riyadh',
  language: 'ar',
} as const;
