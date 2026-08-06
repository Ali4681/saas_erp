import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";

export default async function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const t = await getTranslations("common");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <p className="text-sm text-[var(--color-muted)]">{description}</p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {t("comingSoonDetail")}
        </p>
      </Card>
    </div>
  );
}
