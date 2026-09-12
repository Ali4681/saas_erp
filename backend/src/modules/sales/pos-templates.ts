export type PosTemplateCategory = {
  code: string;
  nameAr: string;
  nameEn: string;
  children?: PosTemplateCategory[];
};

export type PosIndustryTemplate = {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  accentColor: string;
  categories: PosTemplateCategory[];
};

export const POS_INDUSTRY_TEMPLATES: PosIndustryTemplate[] = [
  {
    code: 'restaurant',
    nameAr: 'مطاعم',
    nameEn: 'Restaurant',
    descriptionAr: 'وجبات رئيسية، سندويتشات، مقبلات ومشروبات',
    descriptionEn: 'Mains, sandwiches, appetizers and drinks',
    accentColor: '#C45C2A',
    categories: [
      {
        code: 'meals',
        nameAr: 'الوجبات',
        nameEn: 'Meals',
        children: [
          { code: 'mains', nameAr: 'أطباق رئيسية', nameEn: 'Mains' },
          { code: 'sandwiches', nameAr: 'سندويتشات', nameEn: 'Sandwiches' },
        ],
      },
      { code: 'appetizers', nameAr: 'مقبلات', nameEn: 'Appetizers' },
      { code: 'drinks', nameAr: 'مشروبات', nameEn: 'Drinks' },
      { code: 'desserts', nameAr: 'حلويات', nameEn: 'Desserts' },
    ],
  },
  {
    code: 'cafe',
    nameAr: 'كافيهات',
    nameEn: 'Cafe',
    descriptionAr: 'قهوة، مشروبات باردة، حلويات ووجبات خفيفة',
    descriptionEn: 'Coffee, cold drinks, sweets and snacks',
    accentColor: '#6B4F3A',
    categories: [
      { code: 'hot-drinks', nameAr: 'مشروبات ساخنة', nameEn: 'Hot drinks' },
      { code: 'cold-drinks', nameAr: 'مشروبات باردة', nameEn: 'Cold drinks' },
      { code: 'pastries', nameAr: 'معجنات', nameEn: 'Pastries' },
      { code: 'snacks', nameAr: 'وجبات خفيفة', nameEn: 'Snacks' },
    ],
  },
  {
    code: 'flowers',
    nameAr: 'ورد وهدايا',
    nameEn: 'Flowers & gifts',
    descriptionAr: 'ورود، هدايا، تغريسات وإكسسوارات',
    descriptionEn: 'Flowers, gifts, arrangements and accessories',
    accentColor: '#B83280',
    categories: [
      { code: 'roses', nameAr: 'ورود', nameEn: 'Roses' },
      { code: 'gifts', nameAr: 'هدايا', nameEn: 'Gifts' },
      { code: 'arrangements', nameAr: 'تغريسات', nameEn: 'Arrangements' },
      { code: 'accessories', nameAr: 'إكسسوارات', nameEn: 'Accessories' },
    ],
  },
  {
    code: 'buffet',
    nameAr: 'بوفيهات',
    nameEn: 'Buffet',
    descriptionAr: 'أطباق ساخنة، سلطات، حلويات ومشروبات',
    descriptionEn: 'Hot dishes, salads, desserts and drinks',
    accentColor: '#0F766E',
    categories: [
      { code: 'hot', nameAr: 'أطباق ساخنة', nameEn: 'Hot dishes' },
      { code: 'salads', nameAr: 'سلطات', nameEn: 'Salads' },
      { code: 'desserts', nameAr: 'حلويات', nameEn: 'Desserts' },
      { code: 'drinks', nameAr: 'مشروبات', nameEn: 'Drinks' },
    ],
  },
  {
    code: 'building',
    nameAr: 'مواد بناء',
    nameEn: 'Building materials',
    descriptionAr: 'إسمنت، حديد، دهانات وأدوات',
    descriptionEn: 'Cement, steel, paints and tools',
    accentColor: '#475569',
    categories: [
      { code: 'cement', nameAr: 'إسمنت وخرسانة', nameEn: 'Cement' },
      { code: 'steel', nameAr: 'حديد', nameEn: 'Steel' },
      { code: 'paints', nameAr: 'دهانات', nameEn: 'Paints' },
      { code: 'tools', nameAr: 'أدوات', nameEn: 'Tools' },
    ],
  },
];

export function findPosTemplate(code: string) {
  return POS_INDUSTRY_TEMPLATES.find((t) => t.code === code) ?? null;
}
