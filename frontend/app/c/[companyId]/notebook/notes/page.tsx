import { redirect } from "next/navigation";

/** Legacy notes list — redirect to Problems bucket. */
export default async function NotesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/notebook/problems`);
}
