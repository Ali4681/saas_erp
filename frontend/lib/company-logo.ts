export function companyLogoUrl(
  companyId: string,
  logoAttachmentId?: string | null,
): string | null {
  if (!logoAttachmentId) return null;
  return `/api/attachments/${logoAttachmentId}?companyId=${encodeURIComponent(companyId)}&inline=1`;
}
