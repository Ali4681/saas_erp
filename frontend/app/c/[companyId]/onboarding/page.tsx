import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import {
  OnboardingWizard,
  type OnboardingPayload,
} from "./OnboardingWizard";

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ step?: string; ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("onboarding");

  const status = await apiServer<OnboardingPayload>(
    `/companies/${companyId}/onboarding`,
    { companyId },
  );

  const step = Number(flash.step ?? status.onboarding.currentStep ?? 1);

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />
      <FlashFromSearch searchParams={flash} />
      <Suspense fallback={null}>
        <OnboardingWizard
          companyId={companyId}
          initialStep={Number.isFinite(step) ? step : 1}
          initial={status}
        />
      </Suspense>
    </div>
  );
}
