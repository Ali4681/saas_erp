import { FileText } from "lucide-react";

/** Authenticated attachment URL via Next → Nest proxy. */
export function attachmentUrl(
  companyId: string,
  attachmentId: string,
  opts?: { inline?: boolean },
): string {
  const q = new URLSearchParams({ companyId });
  if (opts?.inline) q.set("inline", "1");
  return `/api/attachments/${attachmentId}?${q.toString()}`;
}

export function isImageMime(mimeType?: string | null, fileName?: string | null) {
  if (mimeType?.startsWith("image/")) return true;
  const name = (fileName ?? "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
}

/** Preview card for an uploaded HR attachment (image or download link). */
export function AttachmentFileCard({
  companyId,
  attachment,
  missingLabel,
}: {
  companyId: string;
  attachment: {
    id: string;
    fileName: string;
    mimeType?: string | null;
  } | null;
  missingLabel: string;
}) {
  if (!attachment) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">{missingLabel}</p>
    );
  }

  const href = attachmentUrl(companyId, attachment.id, { inline: true });
  const downloadHref = attachmentUrl(companyId, attachment.id);
  const showImage = isImageMime(attachment.mimeType, attachment.fileName);

  return (
    <div className="space-y-2">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated binary proxy
        <img
          src={href}
          alt={attachment.fileName}
          className="max-h-64 w-full max-w-md rounded-xl border border-[var(--border)] object-contain bg-[var(--muted)]/20"
        />
      ) : null}
      <a
        href={downloadHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-[var(--primary)] underline-offset-2 hover:underline"
      >
        <FileText className="h-4 w-4" />
        {attachment.fileName}
      </a>
    </div>
  );
}
