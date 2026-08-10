/** ID-like keys never shown in exports. */
const ID_KEYS = new Set([
  "id",
  "itemId",
  "userId",
  "employeeId",
  "branchId",
  "contactId",
  "warehouseId",
  "companyId",
  "ownerUserId",
  "createdById",
  "assigneeUserId",
  "workProjectId",
  "automationRuleId",
  "ruleId",
  "phaseId",
  "leaveId",
  "invoiceId",
  "quoteId",
  "attachmentId",
]);

function isIdKey(key: string): boolean {
  if (ID_KEYS.has(key)) return true;
  if (/Id$/i.test(key) && key !== "sku") return true;
  return false;
}

function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(value.trim());
}

function stripIds(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (isIdKey(k)) continue;
    if (isUuidLike(v)) continue;
    out[k] = v;
  }
  return out;
}

function latinSafe(s: string, max = 120): string {
  const cleaned = s
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  if (!cleaned && s.trim()) return "[text]";
  return cleaned.slice(0, max);
}

function money(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "—");
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qty(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "—");
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function pad(s: string, w: number, align: "left" | "right" = "left"): string {
  const t = s.slice(0, w);
  if (align === "right") return t.padStart(w, " ");
  return t.padEnd(w, " ");
}

type PdfBlock =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "line"; text: string }
  | { kind: "mono"; text: string }
  | { kind: "spacer"; size?: number }
  | { kind: "rule" };

/**
 * Multi-page PDF with Helvetica + Courier. Layout tuned for reports.
 * Letter size 612×792; margins ~48.
 */
export function buildReportPdf(blocks: PdfBlock[]): Buffer {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 48;
  const marginTop = 52;
  const marginBottom = 48;

  type PageOps = string[];
  const pages: PageOps[] = [];
  let ops: PageOps = [];
  let y = pageHeight - marginTop;
  let inText = false;

  const endText = () => {
    if (inText) {
      ops.push("ET");
      inText = false;
    }
  };

  const beginText = (font: string, size: number) => {
    endText();
    ops.push("BT", `/${font} ${size} Tf`, `${marginX} ${y} Td`);
    inText = true;
  };

  const newPage = () => {
    endText();
    pages.push(ops);
    ops = [];
    y = pageHeight - marginTop;
    inText = false;
  };

  const need = (h: number) => {
    if (y - h < marginBottom) newPage();
  };

  const drawLine = (
    text: string,
    opts: {
      font?: "F1" | "F2";
      size?: number;
      gap?: number;
      gray?: boolean;
    } = {},
  ) => {
    const font = opts.font ?? "F1";
    const size = opts.size ?? 10;
    const gap = opts.gap ?? size + 4;
    need(gap);
    beginText(font, size);
    if (opts.gray) ops.push("0.35 0.35 0.35 rg");
    ops.push(`(${escape(latinSafe(text, 95))}) Tj`);
    if (opts.gray) ops.push("0 0 0 rg");
    endText();
    y -= gap;
  };

  const drawRule = () => {
    need(14);
    endText();
    ops.push("0.75 0.75 0.75 RG", "0.6 w");
    ops.push(`${marginX} ${y} m ${pageWidth - marginX} ${y} l S`);
    ops.push("0 0 0 RG");
    y -= 12;
  };

  for (const block of blocks) {
    switch (block.kind) {
      case "title":
        drawLine(block.text, { size: 18, gap: 26 });
        break;
      case "subtitle":
        drawLine(block.text, { size: 10, gap: 14, gray: true });
        break;
      case "heading":
        y -= 6;
        drawRule();
        drawLine(block.text.toUpperCase(), { size: 11, gap: 16 });
        break;
      case "line":
        drawLine(block.text, { size: 10, gap: 14 });
        break;
      case "mono":
        drawLine(block.text, { font: "F2", size: 8.5, gap: 11 });
        break;
      case "spacer":
        y -= block.size ?? 10;
        break;
      case "rule":
        drawRule();
        break;
      default:
        break;
    }
  }
  endText();
  pages.push(ops);

  const pageStreams = pages.map((pageOps, i) => {
    const footerY = 28;
    const footer = [
      "BT",
      "/F1 8 Tf",
      "0.45 0.45 0.45 rg",
      `${pageWidth / 2 - 20} ${footerY} Td`,
      `(${escape(`Page ${i + 1} of ${pages.length}`)}) Tj`,
      "0 0 0 rg",
      "ET",
    ];
    return [...pageOps, ...footer].join("\n");
  });

  const objs: string[] = ["unused"];
  const addObj = (body: string) => {
    objs.push(body);
    return objs.length - 1;
  };

  const catalogId = addObj("");
  const pagesId = addObj("");
  const helvId = addObj(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const courId = addObj(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  );

  const pageObjIndexes: number[] = [];
  for (const stream of pageStreams) {
    const contentId = addObj(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${helvId} 0 R /F2 ${courId} 0 R >> >> >>`,
    );
    pageObjIndexes.push(pageId);
  }

  objs[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId] = `<< /Type /Pages /Kids [${pageObjIndexes
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjIndexes.length} >>`;

  return assemblePdfFromObjs(objs);
}

function assemblePdfFromObjs(objs: string[]): Buffer {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

/** @deprecated thin wrapper kept for any callers */
export function buildSimplePdf(title: string, lines: string[]): Buffer {
  return buildReportPdf([
    { kind: "title", text: title },
    ...lines.map((text) => ({ kind: "line" as const, text })),
  ]);
}

export function buildQuery(
  params: Record<string, string | undefined | null>,
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value).trim() !== "") {
      q.set(key, String(value).trim());
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns?: string[],
): string {
  const cleaned = rows.map(stripIds);
  if (!cleaned.length) return "\uFEFF";
  const cols = columns ?? Object.keys(cleaned[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const row of cleaned) {
    lines.push(cols.map((c) => escape(row[c])).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

/** Excel-compatible SpreadsheetML (.xls) — Unicode/Arabic friendly. */
export function toExcelXml(
  sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>,
): string {
  const escapeXml = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const sheetXml = sheets
    .map((sheet, idx) => {
      const safeName = humanizeReportLabel(sheet.name || `Sheet${idx + 1}`)
        .replace(/[\\/*?:\[\]]/g, " ")
        .slice(0, 31);
      const rows = (sheet.rows.length ? sheet.rows : [{ note: "empty" }]).map(
        stripIds,
      );
      const cols = Object.keys(rows[0]);
      const header = `<Row>${cols
        .map(
          (c) =>
            `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`,
        )
        .join("")}</Row>`;
      const body = rows
        .map((row) => {
          const cells = cols
            .map((c) => {
              const raw = row[c];
              const isNum =
                typeof raw === "number" ||
                (typeof raw === "string" &&
                  raw.trim() !== "" &&
                  !Number.isNaN(Number(raw)) &&
                  /^-?\d+(\.\d+)?$/.test(raw.trim()));
              if (isNum) {
                return `<Cell><Data ss:Type="Number">${escapeXml(raw)}</Data></Cell>`;
              }
              return `<Cell><Data ss:Type="String">${escapeXml(raw)}</Data></Cell>`;
            })
            .join("");
          return `<Row>${cells}</Row>`;
        })
        .join("");
      return `<Worksheet ss:Name="${escapeXml(safeName)}"><Table>${header}${body}</Table></Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 ${sheetXml}
</Workbook>`;
}

export function flattenReportRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (isIdKey(k) || isUuidLike(v)) continue;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      if ("name" in obj) out[k] = obj.name;
      else if ("fullName" in obj) out[k] = obj.fullName;
      else if ("code" in obj) out[k] = obj.code;
      else out[k] = JSON.stringify(v);
    } else if (Array.isArray(v)) {
      out[k] = v.length;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Turn camelCase / snake_case / SCREAMING_SNAKE into a readable label. */
export function humanizeReportLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  if (trimmed.includes(" ") && !/[a-z][A-Z]/.test(trimmed) && !/_/.test(trimmed)) {
    return trimmed;
  }
  const spaced = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Prisma groupBy `_count` may be a number, bigint, or `{ _all: n }`. */
export function readReportCount(row: Record<string, unknown>): number {
  const raw = row._count ?? row.count;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  if (raw && typeof raw === "object") {
    const nested = raw as Record<string, unknown>;
    if (typeof nested._all === "number") return nested._all;
    if (typeof nested._all === "bigint") return Number(nested._all);
    for (const v of Object.values(nested)) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "bigint") return Number(v);
    }
  }
  return 0;
}

const CLASSIFICATION_LABEL_KEYS = [
  "employmentStatus",
  "status",
  "movementType",
  "priority",
  "type",
  "contactType",
  "leaveType",
] as const;

export function classificationLabel(
  row: Record<string, unknown>,
  fallback = "—",
): string {
  for (const key of CLASSIFICATION_LABEL_KEYS) {
    if (row[key] != null && row[key] !== "") return String(row[key]);
  }
  const other = Object.keys(row).find(
    (k) => !["_count", "count", "_sum", "_avg", "_min", "_max"].includes(k),
  );
  return other && row[other] != null ? String(row[other]) : fallback;
}

function isClassificationKey(key: string): boolean {
  return (
    key.endsWith("ByStatus") ||
    key.endsWith("ByType") ||
    key.endsWith("ByPriority") ||
    key === "movementsByType"
  );
}

/** Normalize API groupBy arrays into { category, count } rows (+ TOTAL). */
export function extractClassificationSheets(
  data: Record<string, unknown>,
): Array<{ name: string; rows: Array<Record<string, unknown>>; total: number }> {
  const sheets: Array<{
    name: string;
    rows: Array<Record<string, unknown>>;
    total: number;
  }> = [];

  for (const [key, value] of Object.entries(data)) {
    if (!isClassificationKey(key)) continue;

    let rows: Array<Record<string, unknown>> = [];

    if (Array.isArray(value)) {
      rows = value.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const out: Record<string, unknown> = {
          category: classificationLabel(row),
          count: readReportCount(row),
        };
        const sum = row._sum;
        if (sum && typeof sum === "object" && !Array.isArray(sum)) {
          for (const [field, amount] of Object.entries(
            sum as Record<string, unknown>,
          )) {
            out[field] =
              amount != null && typeof (amount as { toString?: () => string }).toString === "function"
                ? String(amount)
                : amount;
          }
        }
        return out;
      });
    } else if (value && typeof value === "object") {
      rows = Object.entries(value as Record<string, unknown>).map(
        ([status, count]) => {
          if (count && typeof count === "object" && !Array.isArray(count)) {
            const o = count as Record<string, unknown>;
            return {
              category: status,
              count: readReportCount(o),
              ...o,
            };
          }
          return {
            category: status,
            count:
              typeof count === "number"
                ? count
                : typeof count === "bigint"
                  ? Number(count)
                  : Number(count) || 0,
          };
        },
      );
    }

    if (!rows.length) continue;
    const total = rows.reduce(
      (sum, row) => sum + (Number(row.count) || 0),
      0,
    );
    sheets.push({
      name: key,
      rows: [...rows, { category: "TOTAL", count: total }],
      total,
    });
  }

  return sheets;
}

export function extractModuleTables(
  data: Record<string, unknown>,
): Array<{ name: string; rows: Array<Record<string, unknown>> }> {
  const keys = [
    "rows",
    "balances",
    "purchaseOrders",
    "bills",
    "employees",
    "leaves",
    "projects",
    "notes",
    "rules",
    "runs",
    "invoices",
    "contacts",
    "opportunities",
  ];
  const sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }> =
    [];

  for (const key of keys) {
    const v = data[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      sheets.push({
        name: key,
        rows: (v as Array<Record<string, unknown>>).map(flattenReportRow),
      });
    }
  }

  // Classification counts after detail tables (status / type + TOTAL row)
  for (const sheet of extractClassificationSheets(data)) {
    sheets.push({
      name: sheet.name,
      rows: sheet.rows.map((row) => ({
        ...row,
        category:
          row.category === "TOTAL"
            ? "Total"
            : humanizeReportLabel(String(row.category ?? "")),
      })),
    });
  }

  if (!sheets.length) {
    sheets.push({
      name: "summary",
      rows: [{ module: String(data.module ?? ""), note: "no tabular rows" }],
    });
  }
  return sheets;
}

export function executiveToSheets(
  data: Record<string, unknown>,
): Array<{ name: string; rows: Array<Record<string, unknown>> }> {
  const kpis = (data.kpis ?? {}) as Record<string, unknown>;
  const kpiLabels: Record<string, string> = {
    totalSales: "Total Sales",
    totalProfit: "Total Profit",
    totalExpenses: "Total Expenses",
    customerCount: "Customers",
    invoiceCount: "Invoices",
    unpaidInvoiceCount: "Unpaid Invoices",
    balanceDue: "Balance Due",
  };
  const sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }> =
    [
      {
        name: "KPIs",
        rows: Object.entries(kpis).map(([metric, value]) => ({
          metric: kpiLabels[metric] ?? metric,
          value,
        })),
      },
    ];

  const products = data.bestProducts;
  if (Array.isArray(products) && products.length) {
    sheets.push({
      name: "Best Products",
      rows: (products as Array<Record<string, unknown>>).map((p) =>
        flattenReportRow({
          name: p.name,
          sku: p.sku,
          quantity: p.quantity,
          revenue: p.revenue,
          profit: p.profit,
        }),
      ),
    });
  }
  const employees = data.bestEmployees;
  if (Array.isArray(employees) && employees.length) {
    sheets.push({
      name: "Best Employees",
      rows: (employees as Array<Record<string, unknown>>).map((e) =>
        flattenReportRow({
          name: e.name,
          employeeNumber: e.employeeNumber,
          revenue: e.revenue,
        }),
      ),
    });
  }
  const branches = data.bestBranches;
  if (Array.isArray(branches) && branches.length) {
    sheets.push({
      name: "Best Branches",
      rows: (branches as Array<Record<string, unknown>>).map((b) =>
        flattenReportRow({
          code: b.code,
          name: b.name,
          revenue: b.revenue,
        }),
      ),
    });
  }
  const inv = data.inventoryStatus as Record<string, unknown> | undefined;
  if (inv) {
    sheets.push({
      name: "Inventory",
      rows: [
        {
          ok: inv.ok,
          low: inv.low,
          outOfStock: inv.outOfStock,
          stockValue: inv.stockValue,
        },
      ],
    });
    if (Array.isArray(inv.lowStockItems) && inv.lowStockItems.length) {
      sheets.push({
        name: "Low Stock",
        rows: (inv.lowStockItems as Array<Record<string, unknown>>).map((i) =>
          flattenReportRow({
            name: i.name,
            sku: i.sku,
            warehouse: i.warehouse,
            onHand: i.onHand,
            minStock: i.minStock,
          }),
        ),
      });
    }
  }
  const projects = data.projectStatus as
    | { byStatus?: Record<string, number>; total?: number }
    | undefined;
  if (projects?.byStatus) {
    sheets.push({
      name: "Projects",
      rows: Object.entries(projects.byStatus).map(([status, count]) => ({
        status,
        count,
        total: projects.total,
      })),
    });
  }
  return sheets;
}

const KPI_LABELS: Array<{ key: string; label: string; money?: boolean }> = [
  { key: "totalSales", label: "Total Sales", money: true },
  { key: "totalProfit", label: "Total Profit", money: true },
  { key: "totalExpenses", label: "Total Expenses", money: true },
  { key: "balanceDue", label: "Balance Due", money: true },
  { key: "customerCount", label: "Customers" },
  { key: "invoiceCount", label: "Invoices" },
  { key: "unpaidInvoiceCount", label: "Unpaid Invoices" },
];

export function buildExecutiveReportPdf(
  data: Record<string, unknown>,
): Buffer {
  const currency = String(data.currency ?? "SAR");
  const filters = (data.filters ?? {}) as Record<string, unknown>;
  const from = filters.from ? String(filters.from).slice(0, 10) : null;
  const to = filters.to ? String(filters.to).slice(0, 10) : null;
  const period =
    from || to
      ? `Period: ${from ?? "…"}  →  ${to ?? "…"}`
      : "Period: All available data";

  const blocks: PdfBlock[] = [
    { kind: "title", text: "Executive Dashboard" },
    {
      kind: "subtitle",
      text: `${period}   |   Currency: ${currency}   |   ${new Date().toISOString().slice(0, 10)}`,
    },
    { kind: "spacer", size: 4 },
    { kind: "heading", text: "Key Performance Indicators" },
  ];

  const kpis = (data.kpis ?? {}) as Record<string, unknown>;
  for (const item of KPI_LABELS) {
    const raw = kpis[item.key];
    if (raw == null) continue;
    const value = item.money ? `${money(raw)} ${currency}` : String(raw);
    blocks.push({
      kind: "mono",
      text: `${pad(item.label, 22)}  ${pad(value, 28, "right")}`,
    });
  }

  const products = Array.isArray(data.bestProducts)
    ? (data.bestProducts as Array<Record<string, unknown>>).slice(0, 12)
    : [];
  if (products.length) {
    blocks.push({ kind: "heading", text: "Top Products" });
    blocks.push({
      kind: "mono",
      text: `${pad("#", 3)}${pad("Product", 28)}${pad("SKU", 12)}${pad("Qty", 8, "right")}${pad("Revenue", 12, "right")}${pad("Profit", 12, "right")}`,
    });
    blocks.push({
      kind: "mono",
      text: "-".repeat(75),
    });
    products.forEach((p, i) => {
      blocks.push({
        kind: "mono",
        text: `${pad(String(i + 1), 3)}${pad(latinSafe(String(p.name ?? ""), 27), 28)}${pad(latinSafe(String(p.sku ?? ""), 11), 12)}${pad(qty(p.quantity), 8, "right")}${pad(money(p.revenue), 12, "right")}${pad(money(p.profit), 12, "right")}`,
      });
    });
  }

  const employees = Array.isArray(data.bestEmployees)
    ? (data.bestEmployees as Array<Record<string, unknown>>).slice(0, 12)
    : [];
  if (employees.length) {
    blocks.push({ kind: "heading", text: "Top Employees" });
    blocks.push({
      kind: "mono",
      text: `${pad("#", 3)}${pad("Name", 32)}${pad("Emp No", 12)}${pad("Revenue", 14, "right")}`,
    });
    blocks.push({ kind: "mono", text: "-".repeat(61) });
    employees.forEach((e, i) => {
      blocks.push({
        kind: "mono",
        text: `${pad(String(i + 1), 3)}${pad(latinSafe(String(e.name ?? ""), 31), 32)}${pad(String(e.employeeNumber ?? ""), 12)}${pad(money(e.revenue), 14, "right")}`,
      });
    });
  }

  const branches = Array.isArray(data.bestBranches)
    ? (data.bestBranches as Array<Record<string, unknown>>).slice(0, 8)
    : [];
  if (branches.length) {
    blocks.push({ kind: "heading", text: "Top Branches" });
    blocks.push({
      kind: "mono",
      text: `${pad("#", 3)}${pad("Code", 10)}${pad("Name", 28)}${pad("Revenue", 14, "right")}`,
    });
    blocks.push({ kind: "mono", text: "-".repeat(55) });
    branches.forEach((b, i) => {
      blocks.push({
        kind: "mono",
        text: `${pad(String(i + 1), 3)}${pad(String(b.code ?? ""), 10)}${pad(latinSafe(String(b.name ?? ""), 27), 28)}${pad(money(b.revenue), 14, "right")}`,
      });
    });
  }

  const inv = data.inventoryStatus as Record<string, unknown> | undefined;
  if (inv) {
    blocks.push({ kind: "heading", text: "Inventory Snapshot" });
    blocks.push({
      kind: "mono",
      text: `${pad("In stock (OK)", 22)}${pad(String(inv.ok ?? 0), 10, "right")}`,
    });
    blocks.push({
      kind: "mono",
      text: `${pad("Low stock", 22)}${pad(String(inv.low ?? 0), 10, "right")}`,
    });
    blocks.push({
      kind: "mono",
      text: `${pad("Out of stock", 22)}${pad(String(inv.outOfStock ?? 0), 10, "right")}`,
    });
    blocks.push({
      kind: "mono",
      text: `${pad("Stock value", 22)}${pad(`${money(inv.stockValue)} ${currency}`, 18, "right")}`,
    });
  }

  const projects = data.projectStatus as
    | { byStatus?: Record<string, number>; total?: number }
    | undefined;
  if (projects?.byStatus && Object.keys(projects.byStatus).length) {
    blocks.push({ kind: "heading", text: "Projects by Status" });
    blocks.push({
      kind: "mono",
      text: `${pad("Total projects", 22)}${pad(String(projects.total ?? 0), 10, "right")}`,
    });
    for (const [status, count] of Object.entries(projects.byStatus)) {
      blocks.push({
        kind: "mono",
        text: `${pad(status, 22)}${pad(String(count), 10, "right")}`,
      });
    }
  }

  blocks.push({ kind: "spacer", size: 16 });
  blocks.push({
    kind: "subtitle",
    text: "Confidential — generated by SaaS ERP reports",
  });

  return buildReportPdf(blocks);
}

export function buildModuleReportPdf(
  module: string,
  data: Record<string, unknown>,
): Buffer {
  const classifications = extractClassificationSheets(data);
  const sheets = extractModuleTables(data);
  const blocks: PdfBlock[] = [
    { kind: "title", text: `Module Report: ${module}` },
    {
      kind: "subtitle",
      text: `Generated ${new Date().toISOString().slice(0, 10)}`,
    },
  ];

  const relatedKeys = (tableKey: string): string[] => {
    const map: Record<string, string[]> = {
      employees: ["employeesByStatus"],
      leaves: ["leavesByStatus"],
      rows: [
        "closingsByStatus",
        "invoicesByStatus",
        "quotesByStatus",
        "contactsByType",
        "contactsByStatus",
      ],
      invoices: ["invoicesByStatus", "quotesByStatus"],
      purchaseOrders: ["ordersByStatus"],
      bills: ["billsByStatus"],
      projects: ["projectsByStatus", "tasksByStatus"],
      notes: ["notesByStatus", "notesByPriority"],
      rules: ["rulesByStatus"],
      runs: ["runsByStatus"],
      balances: ["movementsByType"],
      contacts: ["contactsByType", "contactsByStatus"],
      opportunities: ["opportunitiesByStatus"],
    };
    return map[tableKey] ?? [];
  };

  const appendClassification = (group: (typeof classifications)[number]) => {
    const parts = group.rows
      .filter((row) => row.category !== "TOTAL" && row.category !== "Total")
      .map(
        (row) =>
          `${humanizeReportLabel(String(row.category ?? ""))}: ${row.count ?? 0}`,
      );
    parts.push(`Total: ${group.total}`);
    blocks.push({ kind: "spacer", size: 6 });
    blocks.push({
      kind: "line",
      text: parts.join("  ·  "),
    });
  };

  const detailSheets = sheets.filter(
    (s) => !isClassificationKey(s.name) && s.name !== "totals",
  );
  const usedClassification = new Set<string>();

  for (const sheet of detailSheets.slice(0, 4)) {
    blocks.push({
      kind: "heading",
      text: `${humanizeReportLabel(sheet.name)} (${sheet.rows.length})`,
    });
    const rows = sheet.rows.slice(0, 25).map(stripIds);
    if (!rows.length) {
      blocks.push({ kind: "line", text: "No data" });
    } else {
      const cols = Object.keys(rows[0]).slice(0, 5);
      const widths = cols.map((c, i) =>
        i === 0 ? 28 : i === cols.length - 1 ? 14 : 12,
      );
      blocks.push({
        kind: "mono",
        text: cols
          .map((c, i) =>
            pad(
              humanizeReportLabel(c),
              widths[i],
              i === 0 ? "left" : "right",
            ),
          )
          .join(""),
      });
      blocks.push({
        kind: "mono",
        text: "-".repeat(Math.min(90, widths.reduce((a, b) => a + b, 0))),
      });
      for (const row of rows) {
        blocks.push({
          kind: "mono",
          text: cols
            .map((c, i) => {
              const raw = row[c];
              const s =
                typeof raw === "number" ||
                (typeof raw === "string" && /^-?\d+(\.\d+)?$/.test(raw))
                  ? money(raw)
                  : typeof raw === "string" && /^[A-Z][A-Z0-9_]*$/.test(raw)
                    ? latinSafe(humanizeReportLabel(raw), widths[i] - 1)
                    : latinSafe(String(raw ?? ""), widths[i] - 1);
              return pad(s, widths[i], i === 0 ? "left" : "right");
            })
            .join(""),
        });
      }
    }

    for (const group of classifications) {
      if (!relatedKeys(sheet.name).includes(group.name)) continue;
      usedClassification.add(group.name);
      appendClassification(group);
    }
  }

  for (const group of classifications) {
    if (usedClassification.has(group.name)) continue;
    appendClassification(group);
  }

  return buildReportPdf(blocks);
}

export const REPORT_MODULES = [
  { value: "sales", label: "Sales" },
  { value: "customers", label: "Customers" },
  { value: "purchases", label: "Purchases" },
  { value: "inventory", label: "Inventory" },
  { value: "hr", label: "HR" },
  { value: "finance", label: "Daily closing" },
  { value: "projects", label: "Projects" },
  { value: "notes", label: "Notes" },
  { value: "automation", label: "Automation" },
] as const;

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export function buildExportHref(opts: {
  companyId: string;
  kind: "executive" | "module";
  module?: string;
  format: ReportExportFormat;
  qs?: string;
}): string {
  const q = new URLSearchParams();
  q.set("companyId", opts.companyId);
  q.set("kind", opts.kind);
  q.set("format", opts.format);
  if (opts.module) q.set("module", opts.module);
  if (opts.qs) {
    const extra = new URLSearchParams(
      opts.qs.startsWith("?") ? opts.qs.slice(1) : opts.qs,
    );
    extra.forEach((v, k) => {
      if (!q.has(k)) q.set(k, v);
    });
  }
  return `/api/reports/export?${q.toString()}`;
}
