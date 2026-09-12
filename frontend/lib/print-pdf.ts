function withDownloadParam(url: string) {
  return url.includes("download=")
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

async function readPdfError(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    /* binary or empty */
  }
  return fallback;
}

/** Renew cookies before client-side PDF fetches (access token is short-lived). */
async function ensureFreshSessionCookies() {
  try {
    await fetch("/bff/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    /* PDF route also refreshes server-side */
  }
}

/** Fetch PDF with session cookies and return it as a File for Web Share. */
export async function fetchPdfFileFromUrl(
  url: string,
  fallbackName = "document.pdf",
): Promise<File> {
  await ensureFreshSessionCookies();
  const res = await fetch(withDownloadParam(url), { credentials: "include" });
  if (!res.ok) {
    throw new Error(await readPdfError(res, "تعذّر تنزيل PDF"));
  }

  const blob = await res.blob();
  const header = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(header);
  const rawName = decodeURIComponent(match?.[1] || match?.[2] || fallbackName);
  const fileName = rawName.replace(/[^\w.\-()+ ]+/g, "_") || fallbackName;
  const pdfBlob =
    blob.type === "application/pdf"
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: "application/pdf" });
  return new File(
    [pdfBlob],
    fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
    { type: "application/pdf" },
  );
}

/** Trigger a browser download for an in-memory PDF File. */
export function downloadPdfFile(file: File): void {
  const blobUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}

/** Fetch PDF with session cookies and trigger a file download. */
export async function downloadPdfFromUrl(
  url: string,
  fallbackName = "document.pdf",
): Promise<void> {
  const file = await fetchPdfFileFromUrl(url, fallbackName);
  downloadPdfFile(file);
}

/** Fetch PDF with session cookies and open the browser print dialog. */
export async function printPdfFromUrl(url: string): Promise<void> {
  await ensureFreshSessionCookies();
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(await readPdfError(res, "تعذّرت الطباعة"));
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = blobUrl;

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Print failed"));
      } finally {
        window.setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      }
    };
    iframe.onerror = () => {
      iframe.remove();
      URL.revokeObjectURL(blobUrl);
      reject(new Error("تعذّرت الطباعة"));
    };
    document.body.appendChild(iframe);
  });
}

/** Copy a PDF File to the clipboard (Chrome/Edge). Returns false if unsupported. */
export async function copyPdfFileToClipboard(file: File): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return false;
  }
  const type = "application/pdf";
  try {
    const blob =
      file.type === type
        ? file
        : new Blob([await file.arrayBuffer()], { type });
    await navigator.clipboard.write([
      new ClipboardItem({ [type]: Promise.resolve(blob) }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Share a PDF File via the system share sheet (no save to Downloads). */
export async function sharePdfFile(file: File): Promise<void> {
  if (!navigator.share) {
    throw new Error("share-unavailable");
  }
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error("share-files-unavailable");
  }
  await navigator.share({ files: [file] });
}

export {
  buildWhatsAppUrl,
  buildTelegramShareUrl,
  formatPhoneDisplay,
  whatsAppDigits,
} from "@/lib/phone";
