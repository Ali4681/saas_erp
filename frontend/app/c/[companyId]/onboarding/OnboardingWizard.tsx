"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  completeOnboarding,
  requestOnboardingService,
  saveOnboardingStep,
  skipOnboardingStep,
} from "./actions";

const CURRENCY_OPTIONS = [
  "SAR",
  "USD",
  "AED",
  "EUR",
  "EGP",
  "BHD",
  "KWD",
  "OMR",
  "QAR",
] as const;

const DOC_TYPES = [
  "COMMERCIAL_REGISTRATION",
  "MUNICIPAL_LICENSE",
  "CIVIL_DEFENSE",
  "NATIONAL_ADDRESS",
  "CHAMBER_OF_COMMERCE",
  "GOSI",
  "VAT_CERTIFICATE",
] as const;

const DELIVERY = [
  "HUNGERSTATION",
  "JAHEZ",
  "THE_CHEFZ",
  "TOYOU",
  "MRSOOL",
  "KEETA",
  "SHGARDI",
  "NINJA",
  "NINJA_GOLD",
  "LOVER",
] as const;

const INSTALLMENT = [
  "TABBY",
  "TAMARA",
  "MADFU",
  "MIS_PAY",
  "EMKAN",
  "CASHBASH",
] as const;

const SOCIAL = [
  "INSTAGRAM",
  "SNAPCHAT",
  "TIKTOK",
  "X",
  "FACEBOOK",
  "WHATSAPP",
] as const;

type DocRow = {
  documentType: string;
  documentNumber: string;
  issuedOn: string;
  expiresOn: string;
  details: Record<string, string>;
};

type ChannelCred = {
  enabled: boolean;
  dashboardUrl: string;
  username: string;
  password: string;
  apiKey: string;
};

type SocialCred = {
  enabled: boolean;
  handle: string;
  profileUrl: string;
  linkedEmail: string;
};

export type OnboardingPayload = {
  onboarding: {
    currentStep: number;
    completedSteps: number[];
    skippedSteps: number[];
    completedAt: string | null;
  };
  company: {
    displayName: string;
    defaultCurrency: string;
    countryCode: string | null;
    city: string | null;
    timezone: string;
    defaultTaxRate: string | null;
    emailFromAddress: string | null;
  };
  profile: {
    unifiedNumber: string | null;
    addressLine: string | null;
    activityDescription: string | null;
    activityType: string | null;
    mapUrl: string | null;
    officialEmail: string | null;
    companyPhone: string | null;
    vatStatus: string;
    secondaryCurrencies: string[];
    paymentMethods: string[];
    posDevices: unknown;
    posTemplateCode?: string | null;
    salesChannels: Record<string, ChannelCred>;
    socialAccounts: Record<string, SocialCred>;
    adsAccounts: Record<string, { adAccountId: string; pixelApi: string }>;
    whatsappBusiness: { number?: string; apiKey?: string } | null;
    complianceAlertDays: number[];
  };
  businessHours: { mode: string } | null;
  documents: Array<{
    documentType: string;
    documentNumber: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    details: Record<string, unknown> | null;
  }>;
  fiscalYears: Array<{
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
    openingBalances: Array<{
      accountKey: string;
      amount: string;
      label: string | null;
    }>;
  }>;
};

function emptyChannel(): ChannelCred {
  return {
    enabled: false,
    dashboardUrl: "",
    username: "",
    password: "",
    apiKey: "",
  };
}

function emptySocial(): SocialCred {
  return { enabled: false, handle: "", profileUrl: "", linkedEmail: "" };
}

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function OnboardingWizard({
  companyId,
  initialStep,
  initial,
}: {
  companyId: string;
  initialStep: number;
  initial: OnboardingPayload;
}) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [step, setStepState] = useState(
    Math.min(5, Math.max(1, initialStep || initial.onboarding.currentStep || 1)),
  );

  /** Soft navigations after save/skip keep this client tree mounted — sync from URL. */
  useEffect(() => {
    const fromUrl = Number(searchParams.get("step"));
    const next = Number.isFinite(fromUrl)
      ? fromUrl
      : Number(initialStep) || 1;
    const clamped = Math.min(5, Math.max(1, next));
    setStepState((prev) => (prev === clamped ? prev : clamped));
  }, [searchParams, initialStep]);

  function setStep(n: number) {
    const next = Math.min(5, Math.max(1, n));
    setStepState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(next));
    params.delete("ok");
    params.delete("error");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const [displayName, setDisplayName] = useState(initial.company.displayName);
  const [unifiedNumber, setUnifiedNumber] = useState(
    initial.profile.unifiedNumber ?? "",
  );
  const [mapUrl, setMapUrl] = useState(initial.profile.mapUrl ?? "");
  const [addressLine, setAddressLine] = useState(
    initial.profile.addressLine ?? "",
  );
  const [city, setCity] = useState(initial.company.city ?? "");
  const [officialEmail, setOfficialEmail] = useState(
    initial.profile.officialEmail ?? initial.company.emailFromAddress ?? "",
  );
  const [companyPhone, setCompanyPhone] = useState(
    initial.profile.companyPhone ?? "",
  );
  const [activityType, setActivityType] = useState(
    initial.profile.activityType ?? "retail",
  );
  const [activityDescription, setActivityDescription] = useState(
    initial.profile.activityDescription ?? "",
  );
  const [posTemplateCode, setPosTemplateCode] = useState(
    initial.profile.posTemplateCode ?? "",
  );
  const [bhMode, setBhMode] = useState(
    initial.businessHours?.mode === "HOURS_24" ? "HOURS_24" : "HOURS_12",
  );

  const [docs, setDocs] = useState<DocRow[]>(() =>
    DOC_TYPES.map((documentType) => {
      const found = initial.documents.find((d) => d.documentType === documentType);
      const details = (found?.details ?? {}) as Record<string, unknown>;
      return {
        documentType,
        documentNumber: found?.documentNumber ?? "",
        issuedOn: toDateInput(found?.issuedOn),
        expiresOn: toDateInput(found?.expiresOn),
        details: {
          fireExtinguishers: String(details.fireExtinguishers ?? ""),
          saudization: String(details.saudization ?? ""),
          chamberGrade: String(details.chamberGrade ?? ""),
          siteSafety: String(details.siteSafety ?? ""),
          country: String(
            details.country ?? initial.company.countryCode ?? "SA",
          ),
          city: String(details.city ?? initial.company.city ?? ""),
          district: String(details.district ?? ""),
          street: String(details.street ?? ""),
          building: String(details.building ?? ""),
          secondaryNumber: String(details.secondaryNumber ?? ""),
          postalCode: String(details.postalCode ?? ""),
        },
      };
    }),
  );
  const [alertDays, setAlertDays] = useState(
    (initial.profile.complianceAlertDays ?? [30, 60]).join(","),
  );

  const [currency, setCurrency] = useState(initial.company.defaultCurrency || "SAR");
  const [secondaryCurrencies, setSecondaryCurrencies] = useState<string[]>(
    () =>
      (initial.profile.secondaryCurrencies ?? [])
        .map((c) => String(c).trim().toUpperCase())
        .filter(Boolean),
  );
  const [vatStatus, setVatStatus] = useState(initial.profile.vatStatus || "TAXABLE");
  const [taxRate, setTaxRate] = useState(initial.company.defaultTaxRate ?? "15");
  const currentFy = initial.fiscalYears.find((f) => true) ?? null;
  const [fyName, setFyName] = useState(currentFy?.name ?? new Date().getFullYear().toString());
  const [fyStart, setFyStart] = useState(
    toDateInput(currentFy?.startsOn) || `${new Date().getFullYear()}-01-01`,
  );
  const [fyEnd, setFyEnd] = useState(
    toDateInput(currentFy?.endsOn) || `${new Date().getFullYear()}-12-31`,
  );
  const obMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const line of currentFy?.openingBalances ?? []) {
      m[line.accountKey] = String(line.amount);
    }
    return m;
  }, [currentFy]);
  const [obCash, setObCash] = useState(obMap.cash ?? "0");
  const [obBank, setObBank] = useState(obMap.bank ?? "0");
  const [obCustomers, setObCustomers] = useState(obMap.customers ?? "0");
  const [obSuppliers, setObSuppliers] = useState(obMap.suppliers ?? "0");
  const [obInventory, setObInventory] = useState(obMap.inventory ?? "0");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [iban, setIban] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    initial.profile.paymentMethods?.length
      ? initial.profile.paymentMethods
      : ["CASH", "CARD"],
  );
  const [posDevices, setPosDevices] = useState(
    Array.isArray(initial.profile.posDevices)
      ? (initial.profile.posDevices as string[]).join("\n")
      : "",
  );

  const [salesChannels, setSalesChannels] = useState<Record<string, ChannelCred>>(
    () => {
      const base: Record<string, ChannelCred> = {
        ECOMMERCE: { ...emptyChannel(), ...(initial.profile.salesChannels?.ECOMMERCE ?? {}) },
      };
      for (const code of DELIVERY) {
        base[code] = { ...emptyChannel(), ...(initial.profile.salesChannels?.[code] ?? {}) };
      }
      for (const code of INSTALLMENT) {
        base[code] = { ...emptyChannel(), ...(initial.profile.salesChannels?.[code] ?? {}) };
      }
      return base;
    },
  );

  const [social, setSocial] = useState<Record<string, SocialCred>>(() => {
    const base: Record<string, SocialCred> = {};
    for (const code of SOCIAL) {
      base[code] = { ...emptySocial(), ...(initial.profile.socialAccounts?.[code] ?? {}) };
    }
    return base;
  });
  const [adsMeta, setAdsMeta] = useState(
    initial.profile.adsAccounts?.META ?? { adAccountId: "", pixelApi: "" },
  );
  const [adsSnap, setAdsSnap] = useState(
    initial.profile.adsAccounts?.SNAPCHAT ?? { adAccountId: "", pixelApi: "" },
  );
  const [waNumber, setWaNumber] = useState(
    initial.profile.whatsappBusiness?.number ?? "",
  );
  const [waApi, setWaApi] = useState(initial.profile.whatsappBusiness?.apiKey ?? "");

  function request(type: string, note?: string) {
    startTransition(() => {
      void requestOnboardingService(companyId, step, type, note);
    });
  }

  function save() {
    startTransition(() => {
      if (step === 1) {
        void saveOnboardingStep(companyId, 1, {
          displayName,
          unifiedNumber,
          mapUrl,
          addressLine,
          city,
          officialEmail,
          companyPhone,
          activityType,
          activityDescription,
          posTemplateCode: posTemplateCode || null,
          businessHoursMode: bhMode,
          countryCode: initial.company.countryCode ?? "SA",
        });
      } else if (step === 2) {
        void saveOnboardingStep(companyId, 2, {
          complianceAlertDays: alertDays
            .split(/[,\s]+/)
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n)),
          documents: docs.map((d) => ({
            documentType: d.documentType,
            documentNumber: d.documentNumber,
            issuedOn: d.issuedOn || null,
            expiresOn: d.expiresOn || null,
            details: d.details,
          })),
        });
      } else if (step === 3) {
        void saveOnboardingStep(companyId, 3, {
          defaultCurrency: currency,
          secondaryCurrencies: secondaryCurrencies.filter(
            (c) => c && c !== currency,
          ),
          vatStatus,
          defaultTaxRate: taxRate,
          paymentMethods,
          posDevices: posDevices
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          fiscalYear: {
            id: currentFy?.id,
            name: fyName,
            startsOn: fyStart,
            endsOn: fyEnd,
          },
          openingBalances: [
            { accountKey: "cash", label: "Cash", amount: obCash },
            { accountKey: "bank", label: "Banks", amount: obBank },
            { accountKey: "customers", label: "Customers", amount: obCustomers },
            { accountKey: "suppliers", label: "Suppliers", amount: obSuppliers },
            { accountKey: "inventory", label: "Inventory", amount: obInventory },
          ],
          ...(accountName.trim()
            ? {
                bankAccount: {
                  name: accountName,
                  bankName,
                  iban,
                  currency,
                },
              }
            : {}),
        });
      } else if (step === 4) {
        void saveOnboardingStep(companyId, 4, { salesChannels });
      } else {
        void saveOnboardingStep(companyId, 5, {
          socialAccounts: social,
          adsAccounts: { META: adsMeta, SNAPCHAT: adsSnap },
          whatsappBusiness: { number: waNumber, apiKey: waApi },
        });
      }
    });
  }

  function ChannelEditor({
    code,
    label,
  }: {
    code: string;
    label: string;
  }) {
    const row = salesChannels[code] ?? emptyChannel();
    return (
      <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) =>
              setSalesChannels((prev) => ({
                ...prev,
                [code]: { ...row, enabled: e.target.checked },
              }))
            }
          />
          {label}
        </label>
        {row.enabled ? (
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              label={t("dashboardUrl")}
              value={row.dashboardUrl}
              onChange={(e) =>
                setSalesChannels((prev) => ({
                  ...prev,
                  [code]: { ...row, dashboardUrl: e.target.value },
                }))
              }
            />
            <Input
              label={t("username")}
              value={row.username}
              onChange={(e) =>
                setSalesChannels((prev) => ({
                  ...prev,
                  [code]: { ...row, username: e.target.value },
                }))
              }
            />
            <Input
              label={t("password")}
              type="password"
              value={row.password}
              onChange={(e) =>
                setSalesChannels((prev) => ({
                  ...prev,
                  [code]: { ...row, password: e.target.value },
                }))
              }
            />
            <Input
              label={t("apiKey")}
              value={row.apiKey}
              onChange={(e) =>
                setSalesChannels((prev) => ({
                  ...prev,
                  [code]: { ...row, apiKey: e.target.value },
                }))
              }
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              step === n
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--secondary)] text-[var(--foreground)]"
            }`}
          >
            {n}. {t(`steps.${n}`)}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        {t("stepOf", { current: step, total: 5 })}
      </p>

      <Card className="space-y-4 p-4">
        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label={t("brandName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <div className="space-y-2">
              <Input
                label={t("unifiedNumber")}
                value={unifiedNumber}
                onChange={(e) => setUnifiedNumber(e.target.value)}
                dir="ltr"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => request("UNIFIED_PHONE")}
              >
                {t("requestUnifiedPhone")}
              </Button>
            </div>
            <p className="md:col-span-2 text-sm text-[var(--muted-foreground)]">
              {t("logoHint")}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => request("LOGO_DESIGN")}
            >
              {t("requestLogo")}
            </Button>
            <Select
              label={t("businessHours")}
              value={bhMode}
              onChange={(e) => setBhMode(e.target.value)}
              showPlaceholderOption={false}
              options={[
                { value: "HOURS_12", label: t("bh12") },
                { value: "HOURS_24", label: t("bh24") },
              ]}
            />
            <div className="space-y-2 md:col-span-2">
              <Input
                label={t("mapUrl")}
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                dir="ltr"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => request("LOCATION_SETUP")}
              >
                {t("requestLocation")}
              </Button>
            </div>
            <Textarea
              label={t("addressLine")}
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              className="md:col-span-2"
            />
            <Input label={t("city")} value={city} onChange={(e) => setCity(e.target.value)} />
            <Input
              label={t("officialEmail")}
              type="email"
              value={officialEmail}
              onChange={(e) => setOfficialEmail(e.target.value)}
            />
            <Input
              label={t("companyPhone")}
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              dir="ltr"
            />
            <Select
              label={t("activityType")}
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              showPlaceholderOption={false}
              options={[
                "grocery",
                "retail",
                "wholesale",
                "hotel",
                "hospital",
                "restaurant",
                "pharmacy",
                "salon",
                "services",
                "other",
              ].map((v) => ({ value: v, label: t(`activityTypes.${v}`) }))}
            />
            <Textarea
              label={t("activityDescription")}
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              className="md:col-span-2"
            />
            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-medium">{t("posTemplate")}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("posTemplateHint")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    "restaurant",
                    "cafe",
                    "flowers",
                    "buffet",
                    "building",
                  ] as const
                ).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() =>
                      setPosTemplateCode((prev) => (prev === code ? "" : code))
                    }
                    className={`rounded-xl border p-3 text-start transition ${
                      posTemplateCode === code
                        ? "border-[var(--primary)] bg-[var(--primary)]/10"
                        : "border-[var(--border)] hover:border-[var(--primary)]/40"
                    }`}
                  >
                    <p className="font-medium">{t(`posTemplates.${code}`)}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {t(`posTemplateDescs.${code}`)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <Input
              label={t("alertDays")}
              value={alertDays}
              onChange={(e) => setAlertDays(e.target.value)}
              placeholder="30, 60"
              dir="ltr"
            />
            {docs.map((doc, idx) => (
              <div
                key={doc.documentType}
                className="space-y-2 rounded-lg border border-[var(--border)] p-3"
              >
                <div className="space-y-1">
                  <p className="font-medium">{t(`docs.${doc.documentType}`)}</p>
                  <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                    {t.has(`officialHints.${doc.documentType}`)
                      ? t(`officialHints.${doc.documentType}`)
                      : t("officialHint")}
                  </p>
                </div>
                {doc.documentType === "NATIONAL_ADDRESS" ? (
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {(
                      [
                        ["country", "country"],
                        ["city", "city"],
                        ["district", "district"],
                        ["street", "street"],
                        ["building", "building"],
                        ["secondaryNumber", "secondaryNumber"],
                        ["postalCode", "postalCode"],
                      ] as const
                    ).map(([key, labelKey]) => (
                      <Input
                        key={key}
                        label={t(labelKey)}
                        value={doc.details[key] ?? ""}
                        onChange={(e) => {
                          const next = [...docs];
                          next[idx] = {
                            ...doc,
                            details: { ...doc.details, [key]: e.target.value },
                          };
                          setDocs(next);
                        }}
                        dir={
                          key === "postalCode" || key === "secondaryNumber"
                            ? "ltr"
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        label={t("docNumber")}
                        value={doc.documentNumber}
                        onChange={(e) => {
                          const next = [...docs];
                          next[idx] = { ...doc, documentNumber: e.target.value };
                          setDocs(next);
                        }}
                        dir="ltr"
                      />
                      {doc.documentType !== "GOSI" ? (
                        <Input
                          label={t("issuedOn")}
                          type="date"
                          value={doc.issuedOn}
                          onChange={(e) => {
                            const next = [...docs];
                            next[idx] = { ...doc, issuedOn: e.target.value };
                            setDocs(next);
                          }}
                        />
                      ) : null}
                      {doc.documentType !== "VAT_CERTIFICATE" &&
                      doc.documentType !== "GOSI" ? (
                        <Input
                          label={t("expiresOn")}
                          type="date"
                          value={doc.expiresOn}
                          onChange={(e) => {
                            const next = [...docs];
                            next[idx] = { ...doc, expiresOn: e.target.value };
                            setDocs(next);
                          }}
                        />
                      ) : null}
                      {doc.documentType === "GOSI" ? (
                        <Input
                          label={t("saudization")}
                          value={doc.details.saudization}
                          onChange={(e) => {
                            const next = [...docs];
                            next[idx] = {
                              ...doc,
                              details: {
                                ...doc.details,
                                saudization: e.target.value,
                              },
                            };
                            setDocs(next);
                          }}
                        />
                      ) : null}
                    </div>
                    {doc.documentType === "CIVIL_DEFENSE" ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input
                          label={t("fireExtinguishers")}
                          value={doc.details.fireExtinguishers}
                          onChange={(e) => {
                            const next = [...docs];
                            next[idx] = {
                              ...doc,
                              details: {
                                ...doc.details,
                                fireExtinguishers: e.target.value,
                              },
                            };
                            setDocs(next);
                          }}
                        />
                        <Input
                          label={t("siteSafety")}
                          value={doc.details.siteSafety ?? ""}
                          onChange={(e) => {
                            const next = [...docs];
                            next[idx] = {
                              ...doc,
                              details: {
                                ...doc.details,
                                siteSafety: e.target.value,
                              },
                            };
                            setDocs(next);
                          }}
                        />
                      </div>
                    ) : null}
                    {doc.documentType === "CHAMBER_OF_COMMERCE" ? (
                      <Input
                        label={t("chamberGrade")}
                        value={doc.details.chamberGrade}
                        onChange={(e) => {
                          const next = [...docs];
                          next[idx] = {
                            ...doc,
                            details: {
                              ...doc.details,
                              chamberGrade: e.target.value,
                            },
                          };
                          setDocs(next);
                        }}
                      />
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label={t("defaultCurrency")}
              value={currency}
              onChange={(e) => {
                const next = e.target.value;
                setCurrency(next);
                setSecondaryCurrencies((prev) =>
                  prev.filter((c) => c !== next),
                );
              }}
              showPlaceholderOption={false}
              options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("secondaryCurrencies")}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2.5">
                {CURRENCY_OPTIONS.filter((c) => c !== currency).map((code) => (
                  <label
                    key={code}
                    className="inline-flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={secondaryCurrencies.includes(code)}
                      onChange={(e) => {
                        setSecondaryCurrencies((prev) =>
                          e.target.checked
                            ? [...prev, code]
                            : prev.filter((p) => p !== code),
                        );
                      }}
                    />
                    {code}
                  </label>
                ))}
              </div>
            </fieldset>
            <Select
              label={t("vatStatus")}
              value={vatStatus}
              onChange={(e) => setVatStatus(e.target.value)}
              showPlaceholderOption={false}
              options={[
                { value: "TAXABLE", label: t("vatTaxable") },
                { value: "EXEMPT", label: t("vatExempt") },
                { value: "NOT_SUBJECT", label: t("vatNotSubject") },
              ]}
            />
            <Input
              label={t("defaultTaxRate")}
              type="number"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
            <Input label={t("fiscalYearName")} value={fyName} onChange={(e) => setFyName(e.target.value)} />
            <Input label={t("fiscalStarts")} type="date" value={fyStart} onChange={(e) => setFyStart(e.target.value)} />
            <Input label={t("fiscalEnds")} type="date" value={fyEnd} onChange={(e) => setFyEnd(e.target.value)} />
            <p className="md:col-span-2 font-medium">{t("openingBalances")}</p>
            <Input label={t("obCash")} value={obCash} onChange={(e) => setObCash(e.target.value)} />
            <Input label={t("obBank")} value={obBank} onChange={(e) => setObBank(e.target.value)} />
            <Input label={t("obCustomers")} value={obCustomers} onChange={(e) => setObCustomers(e.target.value)} />
            <Input label={t("obSuppliers")} value={obSuppliers} onChange={(e) => setObSuppliers(e.target.value)} />
            <Input label={t("obInventory")} value={obInventory} onChange={(e) => setObInventory(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => request("CHART_OF_ACCOUNTS")}
            >
              {t("requestCoa")}
            </Button>
            <Input label={t("bankName")} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Input label={t("accountName")} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            <Input label={t("iban")} value={iban} onChange={(e) => setIban(e.target.value)} dir="ltr" />
            <fieldset className="md:col-span-2 space-y-2">
              <legend className="text-sm font-medium">{t("paymentMethods")}</legend>
              {[
                ["CASH", t("payCash")],
                ["CREDIT", t("payCredit")],
                ["CARD", t("payCard")],
                ["INSTALLMENT", t("payInstallment")],
              ].map(([code, label]) => (
                <label key={code} className="me-4 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={paymentMethods.includes(code)}
                    onChange={(e) => {
                      setPaymentMethods((prev) =>
                        e.target.checked
                          ? [...prev, code]
                          : prev.filter((p) => p !== code),
                      );
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <p className="font-medium">{t("ecommerce")}</p>
            <ChannelEditor code="ECOMMERCE" label={t("ecommerce")} />
            <p className="font-medium">{t("deliveryApps")}</p>
            {DELIVERY.map((code) => (
              <ChannelEditor key={code} code={code} label={code} />
            ))}
            <p className="font-medium">{t("installmentApps")}</p>
            {INSTALLMENT.map((code) => (
              <ChannelEditor key={code} code={code} label={code} />
            ))}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <p className="font-medium">{t("social")}</p>
            {SOCIAL.map((code) => {
              const row = social[code] ?? emptySocial();
              return (
                <div key={code} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        setSocial((prev) => ({
                          ...prev,
                          [code]: { ...row, enabled: e.target.checked },
                        }))
                      }
                    />
                    {code}
                  </label>
                  {row.enabled ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        label={t("handle")}
                        value={row.handle}
                        onChange={(e) =>
                          setSocial((prev) => ({
                            ...prev,
                            [code]: { ...row, handle: e.target.value },
                          }))
                        }
                      />
                      <Input
                        label={t("profileUrl")}
                        value={row.profileUrl}
                        onChange={(e) =>
                          setSocial((prev) => ({
                            ...prev,
                            [code]: { ...row, profileUrl: e.target.value },
                          }))
                        }
                      />
                      <Input
                        label={t("linkedEmail")}
                        value={row.linkedEmail}
                        onChange={(e) =>
                          setSocial((prev) => ({
                            ...prev,
                            [code]: { ...row, linkedEmail: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            <p className="font-medium">{t("ads")}</p>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                label={`Meta ${t("adAccountId")}`}
                value={adsMeta.adAccountId}
                onChange={(e) => setAdsMeta({ ...adsMeta, adAccountId: e.target.value })}
              />
              <Input
                label={`Meta ${t("pixelApi")}`}
                value={adsMeta.pixelApi}
                onChange={(e) => setAdsMeta({ ...adsMeta, pixelApi: e.target.value })}
              />
              <Input
                label={`Snapchat ${t("adAccountId")}`}
                value={adsSnap.adAccountId}
                onChange={(e) => setAdsSnap({ ...adsSnap, adAccountId: e.target.value })}
              />
              <Input
                label={`Snapchat ${t("pixelApi")}`}
                value={adsSnap.pixelApi}
                onChange={(e) => setAdsSnap({ ...adsSnap, pixelApi: e.target.value })}
              />
            </div>
            <p className="font-medium">{t("whatsapp")}</p>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                label={t("whatsappNumber")}
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
                dir="ltr"
              />
              <Input
                label={t("apiKey")}
                value={waApi}
                onChange={(e) => setWaApi(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
              {t("back")}
            </Button>
          ) : null}
          <Button type="button" disabled={pending} onClick={save}>
            {step < 5 ? t("saveContinue") : t("saved")}
          </Button>
          {step < 5 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  void skipOnboardingStep(companyId, step);
                })
              }
            >
              {t("skip")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void completeOnboarding(companyId);
              })
            }
          >
            {t("finish")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
