"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import {
  RolePermissionsForm,
  type PermOption,
} from "@/components/erp/RolePermissionsForm";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

type Props = {
  companyId: string;
  name?: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  permissions: PermOption[];
  createRoleAction: (formData: FormData) => void | Promise<void>;
  canAdd: boolean;
  addTitle: string;
  addDescription: string;
  addTriggerLabel: string;
  createSubmitLabel: string;
};

export function JobTitleFieldWithAdd({
  companyId,
  name = "jobTitle",
  label,
  options,
  defaultValue,
  permissions,
  createRoleAction,
  canAdd,
  addTitle,
  addDescription,
  addTriggerLabel,
  createSubmitLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Select
            name={name}
            label={label}
            options={options}
            defaultValue={defaultValue}
          />
        </div>
        {canAdd ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label={addTriggerLabel}
            title={addTriggerLabel}
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {canAdd ? (
        <CreateFormDialog
          title={addTitle}
          description={addDescription}
          open={open}
          onOpenChange={setOpen}
          hideTrigger
          className="max-w-3xl"
        >
          <RolePermissionsForm
            action={createRoleAction}
            companyId={companyId}
            permissions={permissions}
            submitLabel={createSubmitLabel}
          />
        </CreateFormDialog>
      ) : null}
    </>
  );
}
