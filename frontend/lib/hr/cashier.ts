/** Job titles that should not use sales target / commission fields. */
export function isCashierJobTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toLowerCase();
  return t === "كاشير" || t === "cashier";
}

export function isMarketerJobTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toLowerCase();
  return (
    t === "مسوق" ||
    t === "marketer" ||
    t === "pos_marketer" ||
    t === "pos marketer"
  );
}

/**
 * Skip commission UI/payload when:
 * - Cashier role/title
 * - Marketer without pos.invoice_create (and no sales.write)
 */
export function shouldSkipSalesCommission(input: {
  loginRoleCode?: string | null;
  jobTitle?: string | null;
  /** Whether the selected login role may create POS invoices */
  roleCanCreateInvoice?: boolean | null;
}): boolean {
  const role = (input.loginRoleCode ?? "").trim().toUpperCase();
  if (role === "CASHIER") return true;
  if (isCashierJobTitle(input.jobTitle)) return true;

  if (role === "POS_MARKETER") {
    // Hide unless invoice-create is explicitly enabled on the role.
    return input.roleCanCreateInvoice !== true;
  }
  if (isMarketerJobTitle(input.jobTitle) && input.loginRoleCode == null) {
    // Edit forms without login role: hide marketer titles unless told otherwise.
    return input.roleCanCreateInvoice !== true;
  }
  return false;
}

export function roleAllowsInvoiceCreate(
  role:
    | {
        code?: string | null;
        displayCode?: string | null;
        permissions?: Array<{ code?: string | null }> | null;
      }
    | null
    | undefined,
): boolean {
  if (!role?.permissions?.length) return false;
  return role.permissions.some((p) => {
    const code = (p.code ?? "").trim();
    return code === "pos.invoice_create" || code === "pos.quick_invoice" || code === "sales.write";
  });
}

/** Map role code → can create invoice (from roles API payload). */
export function buildInvoiceCreateByRoleCode(
  roles: Array<{
    code?: string | null;
    displayCode?: string | null;
    permissions?: Array<{ code?: string | null }> | null;
  }>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const role of roles) {
    const allowed = roleAllowsInvoiceCreate(role);
    for (const key of [role.code, role.displayCode]) {
      const k = (key ?? "").trim().toUpperCase();
      if (!k) continue;
      // company-prefixed codes → last segment
      const short = k.includes(":") ? (k.split(":").pop() ?? k) : k;
      out[k] = allowed;
      out[short] = allowed;
    }
  }
  return out;
}
