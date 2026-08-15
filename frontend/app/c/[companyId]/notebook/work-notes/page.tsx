import { NotebookBucketPage } from "../NotebookBucketPage";

export default async function WorkNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  return (
    <NotebookBucketPage
      companyId={companyId}
      bucket="WORK_NOTES"
      flash={flash}
    />
  );
}
