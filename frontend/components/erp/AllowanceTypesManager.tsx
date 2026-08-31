"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AllowanceType = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
};

export function AllowanceTypesManager({
  types,
  createAction,
  deleteAction,
  labels,
  locale = "ar",
}: {
  types: AllowanceType[];
  createAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (id: string) => void | Promise<void>;
  labels: {
    heading: string;
    hint: string;
    code: string;
    nameAr: string;
    nameEn: string;
    add: string;
    remove: string;
  };
  locale?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--border)] p-4">
      <div>
        <p className="text-sm font-medium">{labels.heading}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{labels.hint}</p>
      </div>
      <ul className="space-y-1 text-sm">
        {types.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-md bg-[var(--secondary)]/40 px-2 py-1.5"
          >
            <span>
              {locale === "ar" ? t.nameAr : t.nameEn}{" "}
              <span className="text-xs text-[var(--muted-foreground)]">
                ({t.code})
              </span>
            </span>
            <form action={deleteAction.bind(null, t.id)}>
              <Button type="submit" variant="ghost" size="sm">
                {labels.remove}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createAction} className="grid gap-2 md:grid-cols-4">
        <Input name="code" label={labels.code} required placeholder="BONUS" />
        <Input name="nameAr" label={labels.nameAr} required />
        <Input name="nameEn" label={labels.nameEn} />
        <div className="flex items-end">
          <Button type="submit" variant="secondary" size="sm">
            {labels.add}
          </Button>
        </div>
      </form>
    </div>
  );
}
