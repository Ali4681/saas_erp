import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import { ReportsService } from '../reports/reports.service';
import { OpenAiClient } from './openai.client';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly plans: PlanLimitsService,
    private readonly reports: ReportsService,
    private readonly openai: OpenAiClient,
  ) {}

  status(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return {
      companyId,
      provider: this.openai.defaultProvider,
      model: this.openai.defaultModel,
      liveProviderConfigured: this.openai.isConfigured,
      mode: this.openai.isConfigured ? 'OPENAI' : 'LOCAL_STUB',
      planFeature: 'AI_ASSISTANT',
      requiresPlan: 'ENTERPRISE',
    };
  }

  /** 16.1 — generate product fields from a short prompt */
  async generateProduct(
    companyId: string,
    userId: string | undefined,
    input: {
      prompt: string;
      language?: string;
      targetCurrency?: string;
      categoryHints?: string[];
    },
  ) {
    await this.ensureAi(companyId);
    const prompt = input.prompt?.trim();
    if (!prompt) throw new BadRequestException('prompt is required');

    const categories = await this.prisma.itemCategory.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      take: 50,
    });

    const system = `You are an ERP product copywriter for Arabic/English commerce.
Return JSON only with keys:
name, shortDescription, longDescription, marketingDescription, marketingBullets (string[]),
keywords (string[]), tags (string[]), suggestedCategoryName, suggestedCategoryId (string|null),
suggestedPrice (string|null), currency, publishReady (object with skuSuggestion, statusSuggestion).
Language: ${input.language ?? 'ar'}. Currency: ${input.targetCurrency ?? 'SAR'}.
Pick suggestedCategoryId from the provided catalog when possible.`;

    const user = JSON.stringify({
      prompt,
      categoryCatalog: categories,
      categoryHints: input.categoryHints ?? [],
    });

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: 'inventory.product_generate',
      system,
      user,
      stub: () => this.stubProduct(prompt, categories, input.targetCurrency),
    });

    return { ...data, meta };
  }

  /** 16.1 — improve / rewrite text */
  async improveText(
    companyId: string,
    userId: string | undefined,
    input: {
      text: string;
      goal?: 'improve' | 'shorten' | 'marketing' | 'formal';
      language?: string;
    },
  ) {
    await this.ensureAi(companyId);
    const text = input.text?.trim();
    if (!text) throw new BadRequestException('text is required');
    const goal = input.goal ?? 'improve';

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: 'ai.improve_text',
      system: `Rewrite product/business text. Return JSON: { improved, shortVersion, notes (string[]) }. Goal=${goal}. Language=${input.language ?? 'ar'}.`,
      user: text,
      stub: () => ({
        improved: `${text} — نسخة محسّنة واحترافية.`,
        shortVersion:
          text.length > 120 ? `${text.slice(0, 117)}...` : text,
        notes: [`goal=${goal}`, 'local stub rewrite'],
      }),
    });
    return { ...data, meta };
  }

  /** 16.2 — business assistant over live company data */
  async askAssistant(
    companyId: string,
    userId: string | undefined,
    input: { question: string; from?: string; to?: string },
  ) {
    await this.ensureAi(companyId);
    const question = input.question?.trim();
    if (!question) throw new BadRequestException('question is required');

    const dashboard = await this.reports.executiveDashboard(companyId, {
      from: input.from,
      to: input.to,
      limit: 10,
    });

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: 'ai.business_assistant',
      system: `You are an ERP business assistant. Answer using ONLY the provided dashboard JSON.
Return JSON: { answer (string), highlights (string[]), dataRefs (string[]), confidence ('high'|'medium'|'low') }.
Prefer Arabic if the question is Arabic.`,
      user: JSON.stringify({ question, dashboard }),
      stub: () => this.stubAssistant(question, dashboard),
    });
    return { ...data, meta, context: { filters: dashboard.filters } };
  }

  /** 16.3 — analyze operational / executive reports */
  async analyzeReport(
    companyId: string,
    userId: string | undefined,
    input: {
      scope: 'sales' | 'inventory' | 'hr' | 'executive';
      from?: string;
      to?: string;
    },
  ) {
    await this.ensureAi(companyId);
    const scope = input.scope ?? 'executive';
    let payload: unknown;
    if (scope === 'executive') {
      payload = await this.reports.executiveDashboard(companyId, {
        from: input.from,
        to: input.to,
      });
    } else {
      const moduleMap = {
        sales: 'sales' as const,
        inventory: 'inventory' as const,
        hr: 'hr' as const,
      };
      payload = await this.reports.operationalReport(
        companyId,
        moduleMap[scope],
        { from: input.from, to: input.to },
      );
    }

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: `ai.report_analyze.${scope}`,
      system: `Analyze ERP report data for management.
Return JSON: {
  summary (string),
  weaknesses (string[]),
  improvements (string[]),
  recommendations (string[]),
  kpis (object)
}. Scope=${scope}. Language=ar.`,
      user: JSON.stringify(payload),
      stub: () => this.stubReportAnalysis(scope, payload),
    });
    return { scope, ...data, meta };
  }

  /** 16.4 — note analysis */
  async analyzeNote(
    companyId: string,
    userId: string | undefined,
    input: { noteId?: string; text?: string },
  ) {
    await this.ensureAi(companyId);
    let text = input.text?.trim() ?? '';
    let noteMeta: { id: string; title: string } | null = null;
    if (input.noteId) {
      this.tenant.setCompanyId(companyId);
      const note = await this.prisma.businessNote.findFirst({
        where: { id: input.noteId, companyId },
      });
      if (!note) throw new NotFoundException('Note not found');
      text = note.body;
      noteMeta = { id: note.id, title: note.title };
    }
    if (!text) throw new BadRequestException('text or noteId is required');

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: 'ai.notes_analyze',
      system: `Analyze a business note. Return JSON: {
  summary, decisions (string[]), tasks (string[]),
  developmentSteps (string[]), actionPlan ( { title, steps: string[] } )
}. Language=ar.`,
      user: text,
      stub: () => this.stubNoteAnalysis(text),
    });
    return { note: noteMeta, ...data, meta };
  }

  /** 16.4 — smart search across notes */
  async searchNotes(
    companyId: string,
    userId: string | undefined,
    input: { query: string; limit?: number },
  ) {
    await this.ensureAi(companyId);
    const query = input.query?.trim();
    if (!query) throw new BadRequestException('query is required');
    this.tenant.setCompanyId(companyId);
    const limit = Math.min(input.limit ?? 20, 50);

    const notes = await this.prisma.businessNote.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { body: { contains: query } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        body: true,
        createdAt: true,
      },
      take: 80,
      orderBy: { updatedAt: 'desc' },
    });

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: 'ai.notes_search',
      system: `Rank and explain note matches. Return JSON: {
  matches: [{ noteId, title, relevance, excerpt, reason }],
  answer (string)
}. Language=ar.`,
      user: JSON.stringify({
        query,
        notes: notes.map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status,
          priority: n.priority,
          body: n.body.slice(0, 800),
        })),
      }),
      stub: () => ({
        answer: `عُثر على ${Math.min(notes.length, limit)} مذكرة مطابقة لـ «${query}».`,
        matches: notes.slice(0, limit).map((n) => ({
          noteId: n.id,
          title: n.title,
          relevance: 'medium',
          excerpt: n.body.slice(0, 160),
          reason: 'مطابقة نصية مباشرة',
        })),
      }),
    });
    return { ...data, meta };
  }

  /** 16.5 — marketing post generation */
  async generateMarketing(
    companyId: string,
    userId: string | undefined,
    input: {
      topic: string;
      channel?: string;
      tone?: string;
      language?: string;
      variants?: number;
    },
  ) {
    await this.ensureAi(companyId);
    const topic = input.topic?.trim();
    if (!topic) throw new BadRequestException('topic is required');
    const variants = Math.min(Math.max(input.variants ?? 3, 1), 5);

    const { data, meta } = await this.runJson({
      companyId,
      userId,
      module: 'ai.marketing_generate',
      system: `Create social marketing content. Return JSON: {
  ideas (string[]),
  titles (string[]),
  callToActions (string[]),
  variants: [{ title, body, cta, improvedTips (string[]) }]
}. Channel=${input.channel ?? 'INSTAGRAM'}. Tone=${input.tone ?? 'professional'}.
Language=${input.language ?? 'ar'}. Exactly ${variants} variants.`,
      user: topic,
      stub: () => this.stubMarketing(topic, variants, input.channel),
    });
    return { ...data, meta };
  }

  // --- internals ---

  private async ensureAi(companyId: string) {
    this.tenant.setCompanyId(companyId);
    await this.plans.assertAiEnabled(companyId);
  }

  private async runJson(input: {
    companyId: string;
    userId?: string;
    module: string;
    system: string;
    user: string;
    stub: () => JsonRecord;
  }): Promise<{ data: JsonRecord; meta: JsonRecord }> {
    const requestReference = `ai-${randomUUID()}`;
    let provider = this.openai.defaultProvider;
    let model = this.openai.defaultModel;
    let mode: 'OPENAI' | 'LOCAL_STUB' = 'LOCAL_STUB';
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCost = 0;
    let data: JsonRecord;

    if (this.openai.isConfigured) {
      try {
        const result = await this.openai.completeJson({
          system: input.system,
          user: input.user,
        });
        data = this.parseJson(result.content);
        provider = result.provider;
        model = result.model;
        mode = result.mode;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        estimatedCost = result.estimatedCost;
      } catch {
        data = input.stub();
        mode = 'LOCAL_STUB';
        model = `${model}+fallback-stub`;
      }
    } else {
      data = input.stub();
      estimatedCost = 0;
    }

    await this.prisma.aiUsageLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        module: input.module,
        provider,
        model,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedCost.toFixed(6),
        requestReference,
      },
    });

    return {
      data,
      meta: {
        mode,
        provider,
        model,
        requestReference,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedCost.toFixed(6),
      },
    };
  }

  private parseJson(raw: string): JsonRecord {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
      return { result: parsed };
    } catch {
      return { raw };
    }
  }

  private stubProduct(
    prompt: string,
    categories: Array<{ id: string; name: string }>,
    currency?: string,
  ): JsonRecord {
    const title = prompt
      .split(/\s+/)
      .slice(0, 8)
      .join(' ')
      .replace(/^\w/, (c) => c.toUpperCase());
    const cat =
      categories.find((c) =>
        prompt.toLowerCase().includes(c.name.toLowerCase().slice(0, 4)),
      ) ?? categories[0];
    return {
      name: `${title} — إصدار احترافي`,
      shortDescription: `منتج عالي الجودة: ${prompt}. مناسب للاستخدام اليومي.`,
      longDescription: `وصف تفصيلي لـ «${prompt}». يتميز بجودة تصنيع موثوقة، تصميم عملي، وملاءمة لاحتياجات السوق المحلي. مناسب للبيع عبر المتجر والقنوات الرقمية.`,
      marketingDescription: `اكتشف ${title} — خيار ذكي يجمع بين الجودة والسعر المناسب.`,
      marketingBullets: [
        'جودة موثوقة',
        'تصميم عملي',
        'جاهز للشحن السريع',
        'قيمة مقابل السعر',
      ],
      keywords: prompt.split(/\s+/).filter(Boolean).slice(0, 8),
      tags: ['جديد', 'موصى به', 'أفضل قيمة'],
      suggestedCategoryName: cat?.name ?? 'عام',
      suggestedCategoryId: cat?.id ?? null,
      suggestedPrice: '149.00',
      currency: currency ?? 'SAR',
      publishReady: {
        skuSuggestion: `SKU-${Date.now().toString().slice(-6)}`,
        statusSuggestion: 'ACTIVE',
      },
    };
  }

  private stubAssistant(question: string, dashboard: {
    kpis: Record<string, unknown>;
    bestProducts: Array<{ name: string; revenue: string }>;
    bestEmployees: Array<{ name: string; revenue: string }>;
    bestBranches: Array<{ name: string; revenue: string }>;
    inventoryStatus: { lowStockItems: Array<{ name: string; sku: string | null }> };
  }): JsonRecord {
    const q = question.toLowerCase();
    const highlights: string[] = [];
    let answer = '';

    if (q.includes('منتج') || q.includes('product')) {
      const top = dashboard.bestProducts[0];
      answer = top
        ? `أكثر المنتجات مبيعًا حسب الإيراد: ${top.name} (${top.revenue} SAR).`
        : 'لا توجد بيانات منتجات كافية في الفترة المحددة.';
      highlights.push(...dashboard.bestProducts.slice(0, 3).map((p) => `${p.name}: ${p.revenue}`));
    } else if (q.includes('موظف') || q.includes('employee') || q.includes('مبيعات')) {
      const top = dashboard.bestEmployees[0];
      answer = top
        ? `أفضل موظف مبيعات حسب الإيراد المنسوب: ${top.name} (${top.revenue} SAR).`
        : 'لا توجد بيانات موظفين كافية.';
      highlights.push(...dashboard.bestEmployees.slice(0, 3).map((e) => `${e.name}: ${e.revenue}`));
    } else if (q.includes('فرع') || q.includes('branch')) {
      const top = dashboard.bestBranches[0];
      answer = top
        ? `أكثر فرع يحقق إيرادات: ${top.name} (${top.revenue} SAR).`
        : 'لا توجد بيانات فروع كافية.';
    } else if (q.includes('متأخر') || q.includes('unpaid') || q.includes('دفع')) {
      answer = `عدد الفواتير غير المدفوعة: ${dashboard.kpis.unpaidInvoiceCount} بإجمالي مستحق ${dashboard.kpis.balanceDue} SAR.`;
    } else if (q.includes('إعادة') || q.includes('مخزون') || q.includes('reorder') || q.includes('طلب')) {
      const low = dashboard.inventoryStatus.lowStockItems;
      answer =
        low.length > 0
          ? `منتجات يُفضّل إعادة طلبها: ${low.map((i) => i.name).join('، ')}.`
          : 'لا يوجد مخزون منخفض حاليًا حسب الحد الأدنى.';
      highlights.push(...low.map((i) => i.name));
    } else if (q.includes('انخفاض') || q.includes('سبب')) {
      answer = `إجمالي المبيعات ${dashboard.kpis.totalSales} والأرباح ${dashboard.kpis.totalProfit} والمصروفات ${dashboard.kpis.totalExpenses}. راجع الفواتير غير المدفوعة (${dashboard.kpis.unpaidInvoiceCount}) والمخزون المنخفض كعوامل محتملة.`;
    } else {
      answer = `ملخص سريع — مبيعات: ${dashboard.kpis.totalSales}، أرباح: ${dashboard.kpis.totalProfit}، مصروفات: ${dashboard.kpis.totalExpenses}، عملاء: ${dashboard.kpis.customerCount}، فواتير: ${dashboard.kpis.invoiceCount}.`;
    }

    return {
      answer,
      highlights,
      dataRefs: ['reports.executive'],
      confidence: 'medium',
    };
  }

  private stubReportAnalysis(scope: string, payload: unknown): JsonRecord {
    const p = (payload ?? {}) as Record<string, unknown>;
    const kpisRaw =
      (p.kpis as Record<string, string | number> | undefined) ??
      (p.summary as Record<string, string | number> | undefined) ??
      {};
    const inventoryStatus = p.inventoryStatus as
      | { low?: number; outOfStock?: number; ok?: number; stockValue?: string }
      | undefined;
    const bestProducts = (p.bestProducts as Array<{ name?: string; revenue?: string }> | undefined) ?? [];
    const projectStatus = p.projectStatus as
      | { total?: number; byStatus?: Record<string, number> }
      | undefined;

    const kpis: Record<string, string | number> = { ...kpisRaw };
    if (inventoryStatus) {
      if (inventoryStatus.stockValue != null) kpis.stockValue = inventoryStatus.stockValue;
      if (inventoryStatus.low != null) kpis.lowStock = inventoryStatus.low;
      if (inventoryStatus.outOfStock != null) {
        kpis.outOfStock = inventoryStatus.outOfStock;
      }
    }
    if (projectStatus?.total != null) kpis.projectTotal = projectStatus.total;
    if (Array.isArray(p.rows)) kpis.rowCount = (p.rows as unknown[]).length;
    if (typeof p.totalSales === 'string' || typeof p.totalSales === 'number') {
      kpis.totalSales = p.totalSales;
    }
    if (typeof p.totalExpenses === 'string' || typeof p.totalExpenses === 'number') {
      kpis.totalExpenses = p.totalExpenses;
    }

    const weaknesses: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];
    const highlights: string[] = [];

    const unpaid = Number(kpis.unpaidInvoiceCount ?? 0);
    const sales = Number(kpis.totalSales ?? 0);
    const profit = Number(kpis.totalProfit ?? 0);
    const expenses = Number(kpis.totalExpenses ?? 0);
    const balanceDue = Number(kpis.balanceDue ?? 0);

    if (unpaid > 0) {
      weaknesses.push(
        `يوجد ${unpaid} فاتورة غير مسددة تؤثر على التدفق النقدي`,
      );
      improvements.push('جدولة تذكيرات تحصيل ومتابعة المتأخرين أسبوعيًا');
      recommendations.push('تصنيف العملاء حسب أقدمية المستحقات وبدء التحصيل من الأعلى');
    }
    if (inventoryStatus?.outOfStock && inventoryStatus.outOfStock > 0) {
      weaknesses.push(
        `${inventoryStatus.outOfStock} أصناف نفد مخزونها وقد توقف المبيعات`,
      );
      improvements.push('إصدار أوامر شراء عاجلة للأصناف النافدة');
    }
    if (inventoryStatus?.low && inventoryStatus.low > 0) {
      weaknesses.push(`${inventoryStatus.low} أصناف تحت الحد الأدنى للمخزون`);
      improvements.push('مراجعة نقاط إعادة الطلب وحدود الأمان');
    }
    if (expenses > 0 && sales > 0 && expenses / sales > 0.45) {
      weaknesses.push('نسبة المصروفات مرتفعة مقارنة بالمبيعات');
      improvements.push('مراجعة بنود المصروف الأعلى وتجميد الإنفاق غير الضروري');
    }
    if (profit > 0) {
      highlights.push(`الربح التقريبي إيجابي (${profit}) — حافظ على هامش الربح`);
    }
    if (bestProducts[0]?.name) {
      highlights.push(
        `أفضل منتج حاليًا: ${bestProducts[0].name}${
          bestProducts[0].revenue ? ` بإيراد ${bestProducts[0].revenue}` : ''
        }`,
      );
    }
    if (balanceDue > 0) {
      highlights.push(`المستحقات القائمة: ${balanceDue}`);
    }

    if (weaknesses.length === 0) {
      weaknesses.push('لا توجد إشارات حرجة ظاهرة في الملخص الحالي');
    }
    if (improvements.length === 0) {
      improvements.push('تعميق التحليل بمقارنة نفس الفترة من العام السابق');
      improvements.push('إضافة أهداف شهرية لكل فرع وموظف مبيعات');
    }

    recommendations.push(
      'مراجعة لوحة المدير أسبوعيًا مع مقارنة نفس الفترة السابقة',
    );
    recommendations.push('ربط قرارات التسعير والمخزون بتقرير المبيعات');
    if (scope === 'hr') {
      recommendations.push('مراقبة الحضور والإجازات لتقليل الفاقد التشغيلي');
    }
    if (scope === 'inventory') {
      recommendations.push('تفعيل تنبيهات المخزون المنخفض تلقائيًا');
    }

    const scopeLabel: Record<string, string> = {
      sales: 'المبيعات',
      inventory: 'المخزون',
      hr: 'الموارد البشرية',
      executive: 'التنفيذي',
    };

    return {
      summary: `تحليل نطاق ${scopeLabel[scope] ?? scope}: استُخرجت المؤشرات الرئيسية ونقاط الضعف وفرص التحسين من بيانات الفترة المحددة.`,
      highlights,
      weaknesses,
      improvements,
      recommendations,
      kpis,
      score: {
        health: Math.max(
          35,
          Math.min(
            95,
            78 -
              unpaid * 3 -
              (inventoryStatus?.outOfStock ?? 0) * 4 -
              (inventoryStatus?.low ?? 0),
          ),
        ),
        label:
          unpaid > 5 || (inventoryStatus?.outOfStock ?? 0) > 3
            ? 'يحتاج متابعة'
            : 'مستقر نسبيًا',
      },
    };
  }

  private stubNoteAnalysis(text: string): JsonRecord {
    const lines = text
      .split(/[\n.。؟!]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const tasks = lines
      .filter((l) => /يجب|مطلوب|task|todo|فعل|متابعة/i.test(l))
      .slice(0, 5);
    const decisions = lines
      .filter((l) => /قرر|قرار|اعتماد|موافق/i.test(l))
      .slice(0, 5);
    return {
      summary: lines.slice(0, 2).join('. ') || text.slice(0, 200),
      decisions: decisions.length ? decisions : ['لم تُستخرج قرارات صريحة'],
      tasks: tasks.length ? tasks : lines.slice(0, 3),
      developmentSteps: [
        'تحديد الأولويات',
        'تعيين مسؤول لكل مهمة',
        'متابعة أسبوعية',
      ],
      actionPlan: {
        title: 'خطة تنفيذ من المذكرة',
        steps: (tasks.length ? tasks : lines.slice(0, 4)).map(
          (t, i) => `${i + 1}. ${t}`,
        ),
      },
    };
  }

  private stubMarketing(
    topic: string,
    variants: number,
    channel?: string,
  ): JsonRecord {
    const titles = [
      `${topic} — عرض لا يُفوّت`,
      `لماذا يختار العملاء ${topic}؟`,
      `جديد: ${topic}`,
    ];
    const ctas = ['اطلب الآن', 'اكتشف المزيد', 'تواصل معنا اليوم'];
    return {
      ideas: [
        `قصة منتج حول ${topic}`,
        `مقارنة قبل/بعد`,
        `شهادة عميل قصيرة`,
      ],
      titles,
      callToActions: ctas,
      variants: Array.from({ length: variants }, (_, i) => ({
        title: titles[i % titles.length],
        body: `منشور ${channel ?? 'INSTAGRAM'} عن «${topic}». جودة، ثقة، وقيمة حقيقية لعملائك. #${topic.replace(/\s+/g, '_')}`,
        cta: ctas[i % ctas.length],
        improvedTips: ['أضف صورة عالية الجودة', 'اختصر السطر الأول'],
      })),
    };
  }
}
