import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
};

export default async function BirthdaysPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("crm");
  const { formatDate } = await getFormatters();
  const contacts = await apiServer<Contact[]>(
    `/companies/${companyId}/crm/birthdays`,
    { companyId },
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("insights.birthdaysTitle")}
        description={t("insights.birthdaysHint")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <Card>
        {contacts.length === 0 ? (
          <EmptyState message={t("insights.emptyBirthdays")} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-[var(--color-muted)]">
                    {c.dateOfBirth ? formatDate(c.dateOfBirth) : "—"} · {c.phone ?? ""}
                  </p>
                </div>
                <Button
                  href={`/c/${companyId}/crm/contacts/${c.id}/insights`}
                  variant="outline"
                >
                  {t("insights.short")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
