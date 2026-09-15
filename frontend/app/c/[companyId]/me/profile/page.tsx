import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { EmployeePortalProfileView } from "@/components/erp/EmployeePortalProfileView";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchMyProfile } from "@/lib/hr/my-profile";
import { updateMyProfile } from "../../hr/actions";

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const tPortal = await getTranslations("employeePortal");
  const me = await fetchMyProfile(companyId);
  const updateProfile = updateMyProfile.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader title={tPortal("profile")} description={t("meDesc")} />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <EmployeePortalProfileView
          companyId={companyId}
          me={me}
          updateProfileAction={updateProfile}
        />
      )}
    </div>
  );
}
