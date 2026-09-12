export type DialCodeOption = {
  code: string;
  labelAr: string;
  labelEn: string;
  localMin: number;
  localMax: number;
  /** Local digits without country code or leading zero. */
  localPattern: RegExp;
};

export const PHONE_DIAL_CODES: DialCodeOption[] = [
  {
    code: "966",
    labelAr: "السعودية +966",
    labelEn: "Saudi Arabia +966",
    localMin: 9,
    localMax: 9,
    localPattern: /^5\d{8}$/,
  },
  {
    code: "971",
    labelAr: "الإمارات +971",
    labelEn: "UAE +971",
    localMin: 9,
    localMax: 9,
    localPattern: /^5\d{8}$/,
  },
  {
    code: "965",
    labelAr: "الكويت +965",
    labelEn: "Kuwait +965",
    localMin: 8,
    localMax: 8,
    localPattern: /^[569]\d{7}$/,
  },
  {
    code: "973",
    labelAr: "البحرين +973",
    labelEn: "Bahrain +973",
    localMin: 8,
    localMax: 8,
    localPattern: /^[369]\d{7}$/,
  },
  {
    code: "968",
    labelAr: "عُمان +968",
    labelEn: "Oman +968",
    localMin: 8,
    localMax: 8,
    localPattern: /^[279]\d{7}$/,
  },
  {
    code: "974",
    labelAr: "قطر +974",
    labelEn: "Qatar +974",
    localMin: 8,
    localMax: 8,
    localPattern: /^[3567]\d{7}$/,
  },
  {
    code: "20",
    labelAr: "مصر +20",
    labelEn: "Egypt +20",
    localMin: 10,
    localMax: 10,
    localPattern: /^1\d{9}$/,
  },
  {
    code: "962",
    labelAr: "الأردن +962",
    labelEn: "Jordan +962",
    localMin: 9,
    localMax: 9,
    localPattern: /^7\d{8}$/,
  },
];

export function dialCodeOption(code: string): DialCodeOption {
  return PHONE_DIAL_CODES.find((row) => row.code === code) ?? PHONE_DIAL_CODES[0];
}

export function splitStoredPhone(stored?: string | null): {
  dialCode: string;
  local: string;
} {
  const digits = (stored ?? "").replace(/\D/g, "");
  if (!digits) return { dialCode: "966", local: "" };

  const sorted = [...PHONE_DIAL_CODES].sort(
    (a, b) => b.code.length - a.code.length,
  );
  for (const row of sorted) {
    if (digits.startsWith(row.code) && digits.length > row.code.length) {
      return { dialCode: row.code, local: digits.slice(row.code.length) };
    }
  }
  if (digits.startsWith("0")) {
    return { dialCode: "966", local: digits.slice(1) };
  }
  return { dialCode: "966", local: digits };
}

export function combinePhone(dialCode: string, local: string): string {
  const cleanLocal = local.replace(/\D/g, "");
  return `${dialCode}${cleanLocal}`;
}

/** Read dial-code + local phone fields from a form and combine them. */
export function parsePhoneFromForm(
  formData: FormData,
  opts?: {
    phoneField?: string;
    dialCodeField?: string;
  },
):
  | { ok: true; phone: string | undefined }
  | { ok: false; error: "invalidLength" | "invalidFormat" } {
  const phoneField = opts?.phoneField ?? "phone";
  const dialCodeField = opts?.dialCodeField ?? "phoneDialCode";
  const dialCode =
    String(formData.get(dialCodeField) ?? "").replace(/\D/g, "") || "966";
  const local = String(formData.get(phoneField) ?? "").replace(/\D/g, "");
  if (!local) return { ok: true, phone: undefined };
  const error = validateLocalPhone(dialCode, local);
  if (error === "invalidLength" || error === "invalidFormat") {
    return { ok: false, error };
  }
  return { ok: true, phone: combinePhone(dialCode, local) };
}

export function validateLocalPhone(
  dialCode: string,
  local: string,
): string | null {
  const clean = local.replace(/\D/g, "");
  if (!clean) return null;
  const rule = dialCodeOption(dialCode);
  if (clean.length < rule.localMin || clean.length > rule.localMax) {
    return "invalidLength";
  }
  if (!rule.localPattern.test(clean)) {
    return "invalidFormat";
  }
  return null;
}

export function formatPhoneDisplay(stored?: string | null): string {
  const { dialCode, local } = splitStoredPhone(stored);
  if (!local) return "—";
  return `+${dialCode} ${local}`;
}

/** Normalize phone for wa.me (international digits, no +). */
export function whatsAppDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  const sorted = [...PHONE_DIAL_CODES].sort(
    (a, b) => b.code.length - a.code.length,
  );
  for (const row of sorted) {
    if (digits.startsWith(row.code) && digits.length >= row.code.length + 8) {
      return digits;
    }
  }
  if (digits.startsWith("966") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("5")) return `966${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

export function buildWhatsAppUrl(phone: string, text: string): string | null {
  const digits = whatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildTelegramShareUrl(text: string, url?: string): string {
  const params = new URLSearchParams();
  if (url?.trim()) params.set("url", url.trim());
  if (text.trim()) params.set("text", text.trim());
  return `https://t.me/share/url?${params.toString()}`;
}

/** Open Telegram desktop app when installed, otherwise Telegram Web. */
export function openTelegramAppOrWeb(): void {
  if (typeof window === "undefined") return;

  const webUrl = "https://web.telegram.org/k/";
  let appOpened = false;

  const onBlur = () => {
    appOpened = true;
  };
  window.addEventListener("blur", onBlur, { once: true });

  try {
    const link = document.createElement("a");
    link.href = "tg://resolve";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    /* ignore */
  }

  window.setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!appOpened) {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
  }, 1200);
}
