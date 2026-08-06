export function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function optStr(formData: FormData, key: string): string | undefined {
  const v = str(formData, key);
  return v ? v : undefined;
}
