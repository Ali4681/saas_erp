import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  addTaskComment,
  createPhase,
  createTask,
  setProjectStatus,
  setTaskStatus,
} from "../../actions";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  phases?: Array<{ id: string; name: string; status: string; position: number }>;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string | null;
  phase?: { name: string } | null;
  comments?: Array<{ id: string; body: string }>;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; projectId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId, projectId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("work");
  const session = await getSession();
  const canWrite = can(session?.user, "work.write");

  const [projects, tasks] = await Promise.all([
    apiServer<Project[]>(`/companies/${companyId}/work/projects`, {
      companyId,
    }).catch(() => []),
    apiServer<Task[]>(
      `/companies/${companyId}/work/projects/${projectId}/tasks`,
      { companyId },
    ).catch(() => []),
  ]);

  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("project")} />
        <Card>
          <EmptyState message={t("projectNotFound")} />
        </Card>
      </div>
    );
  }

  const addPhase = createPhase.bind(null, companyId, projectId);
  const addTask = createTask.bind(null, companyId, projectId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        description={`${project.code}`}
        actions={
          <>
            <StatusBadge status={project.status} />
            <Button
              href={`/c/${companyId}/work/projects`}
              variant="secondary"
            >
              {t("allProjects")}
            </Button>
            {canWrite && project.status === "PLANNED" ? (
              <ActionForm
                label={t("activate")}
                variant="primary"
                action={setProjectStatus.bind(
                  null,
                  companyId,
                  projectId,
                  "ACTIVE",
                )}
              />
            ) : null}
            {canWrite && project.status === "ACTIVE" ? (
              <ActionForm
                label={t("complete")}
                action={setProjectStatus.bind(
                  null,
                  companyId,
                  projectId,
                  "COMPLETED",
                )}
              />
            ) : null}
          </>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("phases")}>
          {canWrite ? (
            <div className="mb-4">
              <CreateFormDialog
                title={t("newPhase")}
                triggerLabel={t("addPhase")}
                triggerVariant="secondary"
              >
                <form action={addPhase} className="grid gap-3 sm:grid-cols-2">
                  <Input name="name" label={t("phaseName")} required />
                  <Input
                    name="position"
                    label={t("position")}
                    defaultValue={String((project.phases?.length ?? 0) + 1)}
                  />
                  <div className="sm:col-span-2">
                    <Button type="submit">{t("add")}</Button>
                  </div>
                </form>
              </CreateFormDialog>
            </div>
          ) : null}
          {!project.phases?.length ? (
            <EmptyState message={t("emptyPhases")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {project.phases
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((ph) => (
                  <li
                    key={ph.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {ph.position}. {ph.name}
                    </span>
                    <StatusBadge status={ph.status} />
                  </li>
                ))}
            </ul>
          )}
        </Card>

        {canWrite ? (
          <CreateFormDialog title={t("newTask")} triggerLabel={t("addTask")}>
            <form action={addTask} className="grid gap-3">
              <Input name="title" label={t("titleLabel")} required />
              <Textarea name="description" label={t("descriptionLabel")} />
              <Select
                name="workProjectPhaseId"
                label={t("phase")}
                placeholder={t("optional")}
                options={(project.phases ?? []).map((ph) => ({
                  value: ph.id,
                  label: ph.name,
                }))}
              />
              <Select
                name="priority"
                label={t("priority")}
                options={[
                  { value: "LOW", label: t("priorityLow") },
                  { value: "MEDIUM", label: t("priorityMedium") },
                  { value: "HIGH", label: t("priorityHigh") },
                  { value: "URGENT", label: t("priorityUrgent") },
                ]}
              />
              <Input name="dueAt" label={t("dueAt")} type="datetime-local" />
              <Button type="submit">{t("createTask")}</Button>
            </form>
          </CreateFormDialog>
        ) : null}
      </div>

      <Card title={t("tasksCount", { count: tasks.length })}>
        {tasks.length === 0 ? (
          <EmptyState message={t("emptyTasks")} />
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-md border border-[var(--color-border)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {task.phase?.name ?? t("noPhase")} · {task.priority}
                    </p>
                    {task.description ? (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {task.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    {canWrite && task.status !== "DONE" ? (
                      <ActionForm
                        label={t("finish")}
                        variant="primary"
                        action={setTaskStatus.bind(
                          null,
                          companyId,
                          projectId,
                          task.id,
                          "DONE",
                        )}
                      />
                    ) : null}
                    {canWrite && task.status === "BACKLOG" ? (
                      <ActionForm
                        label={t("start")}
                        action={setTaskStatus.bind(
                          null,
                          companyId,
                          projectId,
                          task.id,
                          "IN_PROGRESS",
                        )}
                      />
                    ) : null}
                  </div>
                </div>
                {task.comments?.length ? (
                  <ul className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-muted)]">
                    {task.comments.map((c) => (
                      <li key={c.id}>• {c.body}</li>
                    ))}
                  </ul>
                ) : null}
                {canWrite ? (
                  <div className="mt-2">
                    <CreateFormDialog
                      title={t("commentOn", { title: task.title })}
                      triggerLabel={t("comment")}
                      triggerVariant="secondary"
                      showPlus={false}
                    >
                      <form
                        action={addTaskComment.bind(
                          null,
                          companyId,
                          projectId,
                          task.id,
                        )}
                        className="grid gap-3"
                      >
                        <Textarea
                          name="body"
                          label={t("commentLabel")}
                          required
                          rows={3}
                        />
                        <Button type="submit">{t("add")}</Button>
                      </form>
                    </CreateFormDialog>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
