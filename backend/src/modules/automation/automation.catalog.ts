import {
  ACTION_EN,
  AUTOMATION_IDEA_EN,
  FIELD_EN,
  MODULE_LABELS_EN,
  TEMPLATE_EN,
  TRIGGER_EN,
  VERIFICATION_EN,
} from './automation.catalog.en';

export type AutomationModuleCode =
  'crm' | 'sales' | 'inventory' | 'hr' | 'work' | 'general';

export type CatalogTrigger = {
  event: string;
  module: AutomationModuleCode;
  labelAr: string;
  descriptionAr: string;
  /** Phase that fully wires this event (1 = available now as manual/catalog). */
  phase: 1 | 2 | 3 | 4;
};

export type CatalogAction = {
  type: string;
  labelAr: string;
  descriptionAr: string;
  /** Fields expected on the action JSON. */
  fields: Array<{
    key: string;
    labelAr: string;
    required?: boolean;
  }>;
  phase: 1 | 2 | 3 | 4;
};

export type CatalogTemplate = {
  code: string;
  module: AutomationModuleCode;
  nameAr: string;
  descriptionAr: string;
  triggerEvent: string;
  conditions: Array<{ field: string; op: string; value: unknown }>;
  actions: Array<Record<string, unknown>>;
  phase: 1 | 2 | 3 | 4;
};

export const AUTOMATION_TRIGGERS: CatalogTrigger[] = [
  {
    event: 'manual',
    module: 'general',
    labelAr: 'تشغيل يدوي',
    descriptionAr: 'يُنفَّذ عند الضغط على زر التنفيذ أو عبر الـ API',
    phase: 1,
  },
  {
    event: 'crm.lead.created',
    module: 'crm',
    labelAr: 'إضافة Lead جديد',
    descriptionAr: 'عند إضافة عميل محتمل جديد',
    phase: 2,
  },
  {
    event: 'crm.contact.created',
    module: 'crm',
    labelAr: 'جهة اتصال جديدة',
    descriptionAr: 'عند إنشاء جهة اتصال',
    phase: 2,
  },
  {
    event: 'crm.opportunity.status_changed',
    module: 'crm',
    labelAr: 'تغيير حالة الفرصة',
    descriptionAr: 'مثلاً عند التحويل إلى مهتم',
    phase: 2,
  },
  {
    event: 'crm.contact.stale',
    module: 'crm',
    labelAr: 'عدم متابعة العميل',
    descriptionAr: 'عند عدم متابعة العميل لمدة معيّنة',
    phase: 4,
  },
  {
    event: 'sales.quote.accepted',
    module: 'sales',
    labelAr: 'قبول عرض السعر',
    descriptionAr: 'عند قبول عرض السعر',
    phase: 3,
  },
  {
    event: 'sales.invoice.paid',
    module: 'sales',
    labelAr: 'دفع الفاتورة',
    descriptionAr: 'عند سداد الفاتورة',
    phase: 3,
  },
  {
    event: 'sales.invoice.overdue',
    module: 'sales',
    labelAr: 'فاتورة متأخرة',
    descriptionAr: 'عند تجاوز تاريخ استحقاق فاتورة مفتوحة (مجدوَل)',
    phase: 4,
  },
  {
    event: 'inventory.stock.low',
    module: 'inventory',
    labelAr: 'انخفاض المخزون',
    descriptionAr: 'عند انخفاض الكمية أو الوصول للحد الأدنى',
    phase: 3,
  },
  {
    event: 'hr.leave.approved',
    module: 'hr',
    labelAr: 'قبول إجازة',
    descriptionAr: 'عند الموافقة على طلب إجازة',
    phase: 4,
  },
  {
    event: 'hr.attendance.absence',
    module: 'hr',
    labelAr: 'تسجيل غياب',
    descriptionAr: 'عند تسجيل غياب لموظف',
    phase: 4,
  },
  {
    event: 'hr.payroll.month_end',
    module: 'hr',
    labelAr: 'نهاية الشهر — الرواتب',
    descriptionAr: 'مجدوَل في نهاية كل شهر لتجهيز الرواتب',
    phase: 4,
  },
  {
    event: 'work.task.overdue',
    module: 'work',
    labelAr: 'تأخر مهمة',
    descriptionAr: 'عند تجاوز تاريخ استحقاق المهمة',
    phase: 4,
  },
  {
    event: 'work.phase.completed',
    module: 'work',
    labelAr: 'إكمال مرحلة',
    descriptionAr: 'عند إكمال مرحلة في المشروع',
    phase: 4,
  },
  {
    event: 'attachments.uploaded',
    module: 'work',
    labelAr: 'رفع ملف',
    descriptionAr: 'عند رفع مرفق مرتبط بمشروع أو مهمة',
    phase: 4,
  },
  {
    event: 'schedule.cron',
    module: 'general',
    labelAr: 'جدولة زمنية (cron)',
    descriptionAr: 'تشغيل دوري حسب تعبير cron',
    phase: 4,
  },
];

export const AUTOMATION_ACTIONS: CatalogAction[] = [
  {
    type: 'notify',
    labelAr: 'إرسال إشعار لمستخدم',
    descriptionAr: 'إشعار داخل النظام (ودفع إن وُجد)',
    fields: [
      { key: 'userId', labelAr: 'المستخدم', required: true },
      { key: 'title', labelAr: 'العنوان' },
      { key: 'body', labelAr: 'النص' },
    ],
    phase: 1,
  },
  {
    type: 'notify_role',
    labelAr: 'إشعار حسب الدور',
    descriptionAr: 'إشعار لكل أعضاء الشركة ذوي الدور المحدد',
    fields: [
      { key: 'roleCode', labelAr: 'رمز الدور', required: true },
      { key: 'title', labelAr: 'العنوان' },
      { key: 'body', labelAr: 'النص' },
    ],
    phase: 1,
  },
  {
    type: 'assign_user',
    labelAr: 'تعيين مستخدم',
    descriptionAr: 'تعيين موظف على جهة اتصال أو فرصة أو مهمة',
    fields: [{ key: 'userId', labelAr: 'المستخدم', required: true }],
    phase: 2,
  },
  {
    type: 'create_task',
    labelAr: 'إنشاء مهمة',
    descriptionAr: 'مهمة متابعة في وحدة المشاريع',
    fields: [
      { key: 'title', labelAr: 'عنوان المهمة', required: true },
      { key: 'assigneeUserId', labelAr: 'المكلّف' },
    ],
    phase: 2,
  },
  {
    type: 'create_crm_activity',
    labelAr: 'تذكير متابعة CRM',
    descriptionAr: 'إنشاء نشاط متابعة على العميل/الفرصة',
    fields: [
      { key: 'title', labelAr: 'العنوان' },
      { key: 'daysFromNow', labelAr: 'بعد كم يوم' },
    ],
    phase: 2,
  },
  {
    type: 'convert_quote_to_invoice',
    labelAr: 'تحويل عرض إلى فاتورة',
    descriptionAr: 'عند قبول عرض السعر',
    fields: [],
    phase: 3,
  },
  {
    type: 'update_contact_status',
    labelAr: 'تحديث حالة العميل',
    descriptionAr: 'مثلاً بعد سداد الفاتورة',
    fields: [{ key: 'status', labelAr: 'الحالة', required: true }],
    phase: 3,
  },
  {
    type: 'create_purchase_order',
    labelAr: 'إنشاء طلب شراء',
    descriptionAr: 'مسودة طلب شراء للصنف منخفض المخزون',
    fields: [],
    phase: 3,
  },
  {
    type: 'ensure_stock_deduction',
    labelAr: 'خصم كمية المخزون',
    descriptionAr: 'خصم تلقائي عند البيع إن لم يُخصم',
    fields: [],
    phase: 3,
  },
  {
    type: 'update_leave_balance',
    labelAr: 'تحديث رصيد الإجازات',
    descriptionAr: 'بعد قبول طلب الإجازة',
    fields: [],
    phase: 4,
  },
  {
    type: 'prepare_payroll_run',
    labelAr: 'تجهيز مسودة الرواتب',
    descriptionAr: 'إنشاء تشغيل رواتب للشهر الحالي',
    fields: [],
    phase: 4,
  },
  {
    type: 'open_next_phase',
    labelAr: 'فتح المرحلة التالية',
    descriptionAr: 'بعد إكمال مرحلة في المشروع',
    fields: [],
    phase: 4,
  },
];

/** Spec examples (13.2) — installed in later phases; listed for UI catalog. */
export const AUTOMATION_TEMPLATES: CatalogTemplate[] = [
  {
    code: 'crm.lead.assign_sales',
    module: 'crm',
    nameAr: 'تعيين Lead لموظف مبيعات',
    descriptionAr: 'عند إضافة Lead جديد، يتم تعيينه لموظف مبيعات',
    triggerEvent: 'crm.lead.created',
    conditions: [],
    actions: [
      { type: 'assign_user' },
      { type: 'create_task', title: 'متابعة Lead جديد', daysFromNow: 1 },
    ],
    phase: 2,
  },
  {
    code: 'crm.interested.followup',
    module: 'crm',
    nameAr: 'تذكير متابعة عند الاهتمام',
    descriptionAr: 'عند تغيير حالة العميل إلى مهتم، يتم إنشاء تذكير متابعة',
    triggerEvent: 'crm.opportunity.status_changed',
    conditions: [{ field: 'interested', op: 'eq', value: true }],
    actions: [
      {
        type: 'create_crm_activity',
        title: 'متابعة عميل مهتم',
        daysFromNow: 1,
      },
    ],
    phase: 2,
  },
  {
    code: 'crm.stale.manager_alert',
    module: 'crm',
    nameAr: 'تنبيه المدير عند عدم المتابعة',
    descriptionAr:
      'عند عدم متابعة العميل لمدة معينة، يتم إرسال تنبيه للمدير وإنشاء تذكير متابعة',
    triggerEvent: 'crm.contact.stale',
    conditions: [],
    actions: [
      {
        type: 'notify_role',
        roleCode: 'COMPANY_OWNER',
        title: 'عميل بلا متابعة',
        body: 'يوجد عميل لم تتم متابعته منذ فترة',
      },
      {
        type: 'create_crm_activity',
        title: 'متابعة عميل بدون نشاط',
        daysFromNow: 1,
      },
    ],
    phase: 4,
  },
  {
    code: 'sales.quote.to_invoice',
    module: 'sales',
    nameAr: 'تحويل العرض المقبول إلى فاتورة',
    descriptionAr: 'عند قبول عرض السعر، يتم تحويله إلى فاتورة',
    triggerEvent: 'sales.quote.accepted',
    conditions: [],
    actions: [{ type: 'convert_quote_to_invoice' }],
    phase: 3,
  },
  {
    code: 'sales.invoice.overdue_alert',
    module: 'sales',
    nameAr: 'تنبيه فاتورة متأخرة',
    descriptionAr: 'عند تأخر دفع الفاتورة، يتم إرسال تنبيه للمالك والإدارة',
    triggerEvent: 'sales.invoice.overdue',
    conditions: [],
    actions: [
      {
        type: 'notify_role',
        roleCode: 'COMPANY_OWNER',
        title: 'فاتورة متأخرة',
        body: 'توجد فاتورة تجاوزت تاريخ الاستحقاق',
      },
      {
        type: 'notify_role',
        roleCode: 'COMPANY_ADMIN',
        title: 'فاتورة متأخرة',
        body: 'توجد فاتورة تجاوزت تاريخ الاستحقاق',
      },
    ],
    phase: 4,
  },
  {
    code: 'sales.invoice.paid_update_customer',
    module: 'sales',
    nameAr: 'تحديث العميل بعد الدفع',
    descriptionAr: 'عند دفع الفاتورة، يتم تحديث حالة العميل',
    triggerEvent: 'sales.invoice.paid',
    conditions: [],
    actions: [{ type: 'update_contact_status', status: 'ACTIVE' }],
    phase: 3,
  },
  {
    code: 'inventory.low.notify',
    module: 'inventory',
    nameAr: 'تنبيه انخفاض المخزون',
    descriptionAr: 'عند انخفاض الكمية، يتم إرسال تنبيه',
    triggerEvent: 'inventory.stock.low',
    conditions: [],
    actions: [
      {
        type: 'notify_role',
        roleCode: 'OPERATIONS_MANAGER',
        title: 'مخزون منخفض',
        body: 'صنف وصل أو اقترب من الحد الأدنى',
      },
    ],
    phase: 3,
  },
  {
    code: 'inventory.min.create_po',
    module: 'inventory',
    nameAr: 'طلب شراء عند الحد الأدنى',
    descriptionAr: 'عند وصول المنتج للحد الأدنى، يتم إنشاء طلب شراء',
    triggerEvent: 'inventory.stock.low',
    conditions: [{ field: 'atOrBelowMin', op: 'eq', value: true }],
    actions: [{ type: 'create_purchase_order' }],
    phase: 3,
  },
  {
    code: 'sales.deduct_stock',
    module: 'sales',
    nameAr: 'خصم الكمية عند البيع',
    descriptionAr: 'عند بيع منتج، يتم خصم الكمية تلقائياً',
    triggerEvent: 'sales.invoice.paid',
    conditions: [],
    actions: [{ type: 'ensure_stock_deduction' }],
    phase: 3,
  },
  {
    code: 'hr.leave.update_balance',
    module: 'hr',
    nameAr: 'تحديث رصيد الإجازة',
    descriptionAr: 'عند قبول إجازة، يتم تحديث رصيد الإجازات',
    triggerEvent: 'hr.leave.approved',
    conditions: [],
    actions: [{ type: 'update_leave_balance' }],
    phase: 4,
  },
  {
    code: 'hr.absence.notify',
    module: 'hr',
    nameAr: 'إشعار عند الغياب',
    descriptionAr: 'عند تسجيل غياب، يتم إرسال إشعار',
    triggerEvent: 'hr.attendance.absence',
    conditions: [],
    actions: [
      {
        type: 'notify_role',
        roleCode: 'COMPANY_ADMIN',
        title: 'تسجيل غياب',
        body: 'تم تسجيل غياب لموظف',
      },
    ],
    phase: 4,
  },
  {
    code: 'hr.payroll.month_end',
    module: 'hr',
    nameAr: 'تجهيز الرواتب نهاية الشهر',
    descriptionAr: 'عند نهاية الشهر، يتم تجهيز بيانات الرواتب',
    triggerEvent: 'hr.payroll.month_end',
    conditions: [],
    actions: [{ type: 'prepare_payroll_run' }],
    phase: 4,
  },
  {
    code: 'work.task.overdue_notify',
    module: 'work',
    nameAr: 'إشعار مهمة متأخرة',
    descriptionAr: 'عند تأخر مهمة، يتم إرسال إشعار',
    triggerEvent: 'work.task.overdue',
    conditions: [],
    actions: [
      {
        type: 'notify_role',
        roleCode: 'COMPANY_OWNER',
        title: 'مهمة متأخرة',
        body: 'توجد مهمة تجاوزت موعدها',
      },
    ],
    phase: 4,
  },
  {
    code: 'work.phase.open_next',
    module: 'work',
    nameAr: 'فتح المرحلة التالية',
    descriptionAr: 'عند إكمال مرحلة، يتم فتح المرحلة التالية',
    triggerEvent: 'work.phase.completed',
    conditions: [],
    actions: [{ type: 'open_next_phase' }],
    phase: 4,
  },
  {
    code: 'work.file.notify_pm',
    module: 'work',
    nameAr: 'إشعار مدير المشروع عند رفع ملف',
    descriptionAr: 'عند رفع ملف، يتم إشعار مدير المشروع',
    triggerEvent: 'attachments.uploaded',
    conditions: [],
    actions: [
      {
        type: 'notify',
        title: 'ملف جديد على المشروع',
        body: 'تم رفع مرفق جديد مرتبط بالمشروع',
      },
      {
        type: 'notify_role',
        roleCode: 'COMPANY_OWNER',
        title: 'ملف جديد على المشروع',
        body: 'تم رفع مرفق جديد',
      },
    ],
    phase: 4,
  },
];

export const MODULE_LABELS_AR: Record<AutomationModuleCode, string> = {
  crm: 'العملاء',
  sales: 'المبيعات',
  inventory: 'المخزون',
  hr: 'الموارد البشرية',
  work: 'المشاريع',
  general: 'عام',
};

/** Checklist aligned with spec 13.2 for Phase 5 verification UI. */
export const AUTOMATION_VERIFICATION: Array<{
  module: AutomationModuleCode;
  labelAr: string;
  event: string;
}> = [
  {
    module: 'crm',
    labelAr: 'Lead جديد → تعيين + مهمة',
    event: 'crm.lead.created',
  },
  {
    module: 'crm',
    labelAr: 'مهتم → تذكير متابعة',
    event: 'crm.opportunity.status_changed',
  },
  {
    module: 'crm',
    labelAr: 'عميل خامد → تنبيه/متابعة',
    event: 'crm.contact.stale',
  },
  {
    module: 'sales',
    labelAr: 'قبول عرض → فاتورة',
    event: 'sales.quote.accepted',
  },
  {
    module: 'sales',
    labelAr: 'فاتورة متأخرة → تنبيه',
    event: 'sales.invoice.overdue',
  },
  {
    module: 'sales',
    labelAr: 'دفع فاتورة → تحديث عميل / خصم مخزون',
    event: 'sales.invoice.paid',
  },
  {
    module: 'inventory',
    labelAr: 'مخزون منخفض → تنبيه / طلب شراء',
    event: 'inventory.stock.low',
  },
  { module: 'hr', labelAr: 'قبول إجازة → رصيد', event: 'hr.leave.approved' },
  { module: 'hr', labelAr: 'غياب → إشعار', event: 'hr.attendance.absence' },
  {
    module: 'hr',
    labelAr: 'نهاية الشهر → رواتب',
    event: 'hr.payroll.month_end',
  },
  {
    module: 'work',
    labelAr: 'مهمة متأخرة → إشعار',
    event: 'work.task.overdue',
  },
  {
    module: 'work',
    labelAr: 'إكمال مرحلة → فتح التالية',
    event: 'work.phase.completed',
  },
  {
    module: 'work',
    labelAr: 'رفع ملف → إشعار مدير المشروع',
    event: 'attachments.uploaded',
  },
];

const IDEA_AR =
  'يعتمد النظام على قاعدة: عند حدوث شيء معين، نفّذ إجراء معين. مثال: عند إضافة عميل جديد، يتم إنشاء مهمة تلقائية لموظف المبيعات لمتابعته.';

export function getAutomationCatalog(locale: string = 'ar') {
  const en = locale === 'en';
  const modules = Object.fromEntries(
    (Object.keys(MODULE_LABELS_AR) as AutomationModuleCode[]).map((key) => [
      key,
      en ? MODULE_LABELS_EN[key] : MODULE_LABELS_AR[key],
    ]),
  ) as Record<AutomationModuleCode, string>;

  return {
    locale: en ? 'en' : 'ar',
    idea: en ? AUTOMATION_IDEA_EN : IDEA_AR,
    /** @deprecated use `idea` */
    ideaAr: IDEA_AR,
    modules,
    triggers: AUTOMATION_TRIGGERS.map((tr) => {
      const overlay = TRIGGER_EN[tr.event];
      const label = en && overlay ? overlay.label : tr.labelAr;
      const description =
        en && overlay ? overlay.description : tr.descriptionAr;
      return {
        ...tr,
        label,
        description,
      };
    }),
    actions: AUTOMATION_ACTIONS.map((action) => {
      const overlay = ACTION_EN[action.type];
      const label = en && overlay ? overlay.label : action.labelAr;
      const description =
        en && overlay ? overlay.description : action.descriptionAr;
      return {
        ...action,
        label,
        description,
        fields: action.fields.map((field) => {
          const fieldKey = `${action.type}.${field.key}`;
          const fieldLabel = en
            ? (FIELD_EN[fieldKey] ?? FIELD_EN[field.key] ?? field.labelAr)
            : field.labelAr;
          return {
            ...field,
            label: fieldLabel,
          };
        }),
      };
    }),
    templates: AUTOMATION_TEMPLATES.map((tmpl) => {
      const overlay = TEMPLATE_EN[tmpl.code];
      return {
        ...tmpl,
        name: en && overlay ? overlay.name : tmpl.nameAr,
        description: en && overlay ? overlay.description : tmpl.descriptionAr,
      };
    }),
    verification: AUTOMATION_VERIFICATION.map((item) => ({
      ...item,
      label:
        en && VERIFICATION_EN[item.event]
          ? VERIFICATION_EN[item.event]
          : item.labelAr,
    })),
    implementedActionTypes: [
      'notify',
      'notify_role',
      'assign_user',
      'create_task',
      'create_crm_activity',
      'convert_quote_to_invoice',
      'update_contact_status',
      'create_purchase_order',
      'ensure_stock_deduction',
      'update_leave_balance',
      'prepare_payroll_run',
      'open_next_phase',
    ] as string[],
    currentPhase: 5,
  };
}
