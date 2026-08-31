import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import {
  CustomerStatementsWorkspace,
  type CustomerStatementRow,
} from "@/components/erp/CustomerStatementActions";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

type Contact = { id: string; name: string };

export default async function CreditNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("sales");
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");

  const [statements, contacts] = await Promise.all([
    apiServer<CustomerStatementRow[]>(
      `/companies/${companyId}/sales/customer-statements`,
      { companyId },
    ).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("creditNotes.title")}
        description={t("creditNotes.description")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <CustomerStatementsWorkspace
        companyId={companyId}
        contacts={contacts}
        statements={statements}
        canWrite={canWrite}
      />
    </div>
  );
}
