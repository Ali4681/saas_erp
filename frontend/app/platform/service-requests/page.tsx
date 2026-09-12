import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { updateServiceRequestStatus } from "./actions";

type ServiceRequest = {
  id: string;
  step: number;
  requestType: string;
  note: string | null;
  status: string;
  createdAt: string;
  company: { id: string; displayName: string; slug: string };
  createdBy: { fullName: string; email: string | null } | null;
};

export default async function ServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const flash = await searchParams;
  const t = await getTranslations("platform");
  const rows = await apiServer<ServiceRequest[]>(
    "/companies/service-requests",
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("serviceRequestsTitle")}
        description={t("serviceRequestsDesc")}
        actions={
          <Button href="/platform/companies" variant="secondary">
            {t("companies")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message={t("serviceRequestEmpty")} />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--secondary)]/40 text-start">
              <tr>
                <th className="px-4 py-3 font-medium">{t("serviceRequestCompany")}</th>
                <th className="px-4 py-3 font-medium">{t("serviceRequestType")}</th>
                <th className="px-4 py-3 font-medium">{t("serviceRequestStep")}</th>
                <th className="px-4 py-3 font-medium">{t("serviceRequestStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("serviceRequestNote")}</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-3">
                    <a
                      className="text-[var(--primary)] hover:underline"
                      href={`/platform/companies/${row.company.id}`}
                    >
                      {row.company.displayName}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.requestType}</td>
                  <td className="px-4 py-3">{row.step}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {row.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <form
                        action={updateServiceRequestStatus.bind(
                          null,
                          row.id,
                          "IN_PROGRESS",
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          {t("markInProgress")}
                        </Button>
                      </form>
                      <form
                        action={updateServiceRequestStatus.bind(
                          null,
                          row.id,
                          "DONE",
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          {t("markDone")}
                        </Button>
                      </form>
                      <form
                        action={updateServiceRequestStatus.bind(
                          null,
                          row.id,
                          "CANCELLED",
                        )}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          {t("markCancelled")}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
