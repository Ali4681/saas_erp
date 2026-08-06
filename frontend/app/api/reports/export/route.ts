import { getSession } from "@/lib/auth/session";
import { nestFetch, ApiError } from "@/lib/api/client";
import {
  buildExecutiveReportPdf,
  buildModuleReportPdf,
  executiveToSheets,
  extractModuleTables,
  toCsv,
  toExcelXml,
  type ReportExportFormat,
} from "@/lib/erp/reports";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const kind = req.nextUrl.searchParams.get("kind") ?? "executive";
  const module = req.nextUrl.searchParams.get("module") ?? "sales";
  const format = (req.nextUrl.searchParams.get("format") ??
    "csv") as ReportExportFormat;

  if (!companyId) {
    return NextResponse.json({ message: "companyId مطلوب" }, { status: 400 });
  }
  if (!["csv", "xlsx", "pdf"].includes(format)) {
    return NextResponse.json(
      { message: "format يجب أن يكون csv أو xlsx أو pdf" },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "غير مسجّل" }, { status: 401 });
  }

  const allowed = [
    "from",
    "to",
    "employeeId",
    "customerId",
    "productId",
    "status",
    "limit",
  ];
  const q = new URLSearchParams();
  for (const key of allowed) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) q.set(key, v);
  }
  const qs = q.toString() ? `?${q.toString()}` : "";

  try {
    if (kind === "executive") {
      const data = await nestFetch<Record<string, unknown>>(
        `/companies/${companyId}/reports/executive${qs}`,
        {
          accessToken: session.accessToken,
          companyId,
        },
      );

      if (format === "pdf") {
        const pdf = buildExecutiveReportPdf(data);
        return new NextResponse(new Uint8Array(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition":
              'attachment; filename="executive-report.pdf"',
          },
        });
      }

      const sheets = executiveToSheets(data);
      if (format === "xlsx") {
        return new NextResponse(toExcelXml(sheets), {
          headers: {
            "Content-Type": "application/vnd.ms-excel; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="executive-report.xls"',
          },
        });
      }

      return new NextResponse(toCsv(sheets[0]?.rows ?? []), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="executive-report.csv"',
        },
      });
    }

    const data = await nestFetch<Record<string, unknown>>(
      `/companies/${companyId}/reports/modules/${module}${qs}`,
      {
        accessToken: session.accessToken,
        companyId,
      },
    );
    const baseName = `report-${module}`;

    if (format === "pdf") {
      const pdf = buildModuleReportPdf(module, data);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        },
      });
    }

    const sheets = extractModuleTables(data);
    if (format === "xlsx") {
      return new NextResponse(toExcelXml(sheets), {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.xls"`,
        },
      });
    }

    return new NextResponse(toCsv(sheets[0]?.rows ?? []), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "تعذّر التصدير";
    return NextResponse.json({ message }, { status: 502 });
  }
}
