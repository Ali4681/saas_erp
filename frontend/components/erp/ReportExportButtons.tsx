import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildExportHref, type ReportExportFormat } from "@/lib/erp/reports";

type Props = {
  companyId: string;
  kind: "executive" | "module";
  module?: string;
  qs?: string;
};

const FORMATS: Array<{
  format: ReportExportFormat;
  label: string;
  icon: typeof Download;
}> = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", icon: Download },
];

export function ReportExportButtons({ companyId, kind, module, qs }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATS.map(({ format, label, icon: Icon }) => (
        <Button
          key={format}
          href={buildExportHref({ companyId, kind, module, format, qs })}
          variant="secondary"
          size="sm"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
