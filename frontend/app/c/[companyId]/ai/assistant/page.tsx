import { redirect } from "next/navigation";

/** AI assistant is a floating widget — redirect to AI tools hub. */
export default async function AiAssistantPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/ai`);
}
