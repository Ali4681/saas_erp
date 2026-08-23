import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  addDynamicWindow,
  generateBusinessShifts,
  saveBusinessHours,
} from "../actions";

type Profile = {
  id: string;
  mode: string;
  defaultStartTime: string;
  defaultEndTime: string;
  autoSplitShifts: boolean;
  autoShiftHours: number;
  twelveHourMode: string;
  period2StartTime: string | null;
  period2EndTime: string | null;
  notes: string | null;
  windows: Array<{
    id: string;
    label: string | null;
    startsAt: string;
    endsAt: string;
  }>;
  shifts: Array<{
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    sequenceIndex: number;
  }>;
};

export default async function BusinessHoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("settings");
  const session = await getSession();
  const canWrite = can(session?.user, "companies.write");

  const profile = await apiServer<Profile>(
    `/companies/${companyId}/business-hours`,
    { companyId },
  ).catch(() => null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("businessHoursTitle")}
        description={t("businessHoursDesc")}
        actions={
          <Button href={`/c/${companyId}/settings`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {profile && canWrite ? (
        <Card className="space-y-4 p-4">
          <form
            action={saveBusinessHours.bind(null, companyId)}
            className="grid gap-3 md:grid-cols-2"
          >
            <Select
              name="mode"
              label={t("bhMode")}
              required
              showPlaceholderOption={false}
              defaultValue={profile.mode}
              options={[
                { value: "HOURS_24", label: t("bhMode24") },
                { value: "HOURS_12", label: t("bhMode12") },
                { value: "DYNAMIC", label: t("bhModeDynamic") },
              ]}
            />
            <Select
              name="twelveHourMode"
              label={t("bhTwelveMode")}
              showPlaceholderOption={false}
              defaultValue={profile.twelveHourMode}
              options={[
                { value: "FIXED", label: t("bhFixed") },
                { value: "TWO_PERIODS", label: t("bhTwoPeriods") },
              ]}
            />
            <Input
              name="defaultStartTime"
              label={t("bhStart")}
              defaultValue={profile.defaultStartTime}
              required
            />
            <Input
              name="defaultEndTime"
              label={t("bhEnd")}
              defaultValue={profile.defaultEndTime}
              required
            />
            <Input
              name="autoShiftHours"
              label={t("bhAutoHours")}
              type="number"
              defaultValue={String(profile.autoShiftHours)}
            />
            <Input
              name="period2StartTime"
              label={t("bhPeriod2Start")}
              defaultValue={profile.period2StartTime ?? ""}
            />
            <Input
              name="period2EndTime"
              label={t("bhPeriod2End")}
              defaultValue={profile.period2EndTime ?? ""}
            />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="autoSplitShifts"
                defaultChecked={profile.autoSplitShifts}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {t("bhAutoSplit")}
            </label>
            <div className="md:col-span-2">
              <Textarea
                name="notes"
                label={t("bhNotes")}
                defaultValue={profile.notes ?? ""}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("bhSave")}</Button>
            </div>
          </form>
          {profile.mode === "HOURS_24" || profile.mode === "HOURS_12" ? (
            <ActionForm
              label={t("bhGenerate")}
              action={generateBusinessShifts.bind(null, companyId)}
            />
          ) : null}
        </Card>
      ) : null}

      {profile?.mode === "DYNAMIC" && canWrite ? (
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">{t("bhWindows")}</h3>
          <form
            action={addDynamicWindow.bind(null, companyId)}
            className="grid gap-3 md:grid-cols-3"
          >
            <Input name="label" label={t("bhWindowLabel")} />
            <Input
              name="startsAt"
              label={t("bhWindowStart")}
              type="datetime-local"
              required
            />
            <Input
              name="endsAt"
              label={t("bhWindowEnd")}
              type="datetime-local"
              required
            />
            <div className="md:col-span-3">
              <Button type="submit">{t("bhAddWindow")}</Button>
            </div>
          </form>
          <ul className="space-y-1 text-sm">
            {profile.windows.map((w) => (
              <li key={w.id}>
                {w.label ?? "—"} · {w.startsAt} → {w.endsAt}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {profile?.shifts?.length ? (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">{t("bhShifts")}</h3>
          <ul className="space-y-1 text-sm">
            {profile.shifts.map((s) => (
              <li key={s.id}>
                {s.name}: {s.startTime}–{s.endTime}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
