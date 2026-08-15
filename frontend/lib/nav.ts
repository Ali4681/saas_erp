import { COMPANY_CHANNEL_SECTIONS } from "@/lib/integrations";

export type NavItem = {
  href: string;
  /** Message key under the `nav` namespace */
  labelKey?: string;
  /** Literal label (e.g. provider brand names) when labelKey is absent */
  label?: string;
  permissions?: string[];
  platformOnly?: boolean;
  children?: NavItem[];
};

export function platformNav(): NavItem[] {
  return [
    { href: "/platform", labelKey: "platformHome", platformOnly: true },
    {
      href: "/platform/companies",
      labelKey: "companies",
      platformOnly: true,
      permissions: ["companies.read"],
    },
    {
      href: "/platform/plans",
      labelKey: "plans",
      platformOnly: true,
      permissions: ["plans.read"],
    },
  ];
}

function child(base: string, path: string, labelKey: string): NavItem {
  return { href: `${base}${path}`, labelKey };
}

function childLabel(base: string, path: string, label: string): NavItem {
  return { href: `${base}${path}`, label };
}

const CHANNEL_LABEL_KEYS: Record<string, string> = {
  delivery: "channelDelivery",
  installments: "channelInstallments",
  stores: "channelStores",
};

export function tenantNav(companyId: string): NavItem[] {
  const root = `/c/${companyId}`;
  const channelNav: NavItem[] = COMPANY_CHANNEL_SECTIONS.map((section) => {
    const base = `${root}/channels/${section.slug}`;
    return {
      href: base,
      labelKey: CHANNEL_LABEL_KEYS[section.slug] ?? section.slug,
      permissions: ["integrations.read"],
      children: section.providers.map((provider) => {
        const providerPath = `/${provider.code.toLowerCase()}`;
        if (provider.code === "HUNGERSTATION") {
          const hsBase = `${base}${providerPath}`;
          return {
            href: hsBase,
            label: provider.name,
            permissions: ["integrations.read"],
            children: [
              child(hsBase, "/orders", "hsOrders"),
              child(hsBase, "/reports", "hsReports"),
              child(hsBase, "/catalog", "hsCatalog"),
              child(hsBase, "/store", "hsStore"),
            ],
          };
        }
        return childLabel(base, providerPath, provider.name);
      }),
    };
  });

  return [
    { href: root, labelKey: "home" },
    ...channelNav,
    {
      href: `${root}/crm`,
      labelKey: "crm",
      permissions: ["crm.read"],
      children: [
        child(`${root}/crm`, "/contacts", "crmContacts"),
        child(`${root}/crm`, "/opportunities", "crmOpportunities"),
        child(`${root}/crm`, "/activities", "crmActivities"),
        child(`${root}/crm`, "/contracts", "crmContracts"),
      ],
    },
    {
      href: `${root}/sales`,
      labelKey: "sales",
      permissions: ["sales.read"],
      children: [
        child(`${root}/sales`, "/quotes", "salesQuotes"),
        child(`${root}/sales`, "/invoices", "salesInvoices"),
        child(`${root}/sales`, "/credit-notes", "salesCreditNotes"),
      ],
    },
    {
      href: `${root}/purchasing`,
      labelKey: "purchasing",
      permissions: ["purchasing.read"],
      children: [
        child(`${root}/purchasing`, "/suppliers", "purchasingSuppliers"),
        child(`${root}/purchasing`, "/purchase-orders", "purchasingOrders"),
        child(`${root}/purchasing`, "/bills", "purchasingBills"),
        child(`${root}/purchasing`, "/operators", "purchasingOperators"),
      ],
    },
    {
      href: `${root}/inventory`,
      labelKey: "inventory",
      permissions: ["inventory.read"],
      children: [
        child(`${root}/inventory`, "/items", "inventoryItems"),
        child(`${root}/inventory`, "/categories", "inventoryCategories"),
        child(`${root}/inventory`, "/warehouses", "inventoryWarehouses"),
        child(`${root}/inventory`, "/movements", "inventoryMovements"),
        child(`${root}/inventory`, "/counts", "inventoryCounts"),
        child(`${root}/inventory`, "/balances", "inventoryBalances"),
      ],
    },
    {
      href: `${root}/finance`,
      labelKey: "finance",
      permissions: ["finance.read"],
      children: [
        child(`${root}/finance`, "/accounts", "financeAccounts"),
        child(`${root}/finance`, "/expenses", "financeExpenses"),
        child(`${root}/finance`, "/transactions", "financeTransactions"),
        child(`${root}/finance`, "/payment-methods", "financePaymentMethods"),
        child(`${root}/finance`, "/daily-closing", "financeDailyClosing"),
      ],
    },
    {
      href: `${root}/hr`,
      labelKey: "hr",
      permissions: ["hr.read"],
      children: [
        child(`${root}/hr`, "/employees", "hrEmployees"),
        child(`${root}/hr`, "/advances", "hrAdvances"),
        child(`${root}/hr`, "/leaves", "hrLeaves"),
        child(`${root}/hr`, "/sales-submissions", "hrSalesSubmissions"),
        child(`${root}/hr`, "/me", "hrMe"),
      ],
    },
    {
      href: `${root}/tracking`,
      labelKey: "tracking",
      // Prefer tracking.read; hr.read kept until all tenants re-seed
      permissions: ["tracking.read", "hr.read"],
      children: [
        child(`${root}/tracking`, "/cameras", "trackingCameras"),
        child(`${root}/tracking`, "/biometrics", "trackingBiometrics"),
        child(`${root}/tracking`, "/events", "trackingEvents"),
      ],
    },
    {
      href: `${root}/work`,
      labelKey: "work",
      permissions: ["work.read"],
      children: [child(`${root}/work`, "/projects", "workProjects")],
    },
    {
      href: `${root}/notebook`,
      labelKey: "notebook",
      permissions: ["notebook.read"],
      children: [
        child(`${root}/notebook`, "/problems", "notebookProblems"),
        child(`${root}/notebook`, "/dev-ideas", "notebookDevIdeas"),
        child(`${root}/notebook`, "/work-notes", "notebookWorkNotes"),
      ],
    },
    {
      href: `${root}/marketing`,
      labelKey: "marketing",
      permissions: ["marketing.read"],
      children: [
        child(`${root}/marketing`, "/posts", "marketingPosts"),
        child(`${root}/marketing`, "/calendar", "marketingCalendar"),
        child(`${root}/marketing`, "/connections", "marketingConnections"),
      ],
    },
    {
      href: `${root}/ai`,
      labelKey: "ai",
      permissions: ["ai.read"],
      children: [
        child(`${root}/ai`, "/products", "aiProducts"),
        child(`${root}/ai`, "/reports", "aiReports"),
        child(`${root}/ai`, "/notes", "aiNotes"),
        child(`${root}/ai`, "/marketing", "aiMarketing"),
        child(`${root}/ai`, "/bots/whatsapp", "aiBotWhatsapp"),
      ],
    },
    {
      href: `${root}/reports`,
      labelKey: "reports",
      permissions: ["reports.read"],
      children: [
        child(`${root}/reports`, "/modules/sales", "reportsSales"),
        child(`${root}/reports`, "/modules/customers", "reportsCustomers"),
        child(`${root}/reports`, "/modules/purchases", "reportsPurchases"),
        child(`${root}/reports`, "/modules/inventory", "reportsInventory"),
        child(`${root}/reports`, "/modules/hr", "reportsHr"),
        child(`${root}/reports`, "/modules/finance", "reportsFinance"),
        child(`${root}/reports`, "/modules/projects", "reportsProjects"),
        child(`${root}/reports`, "/modules/notes", "reportsNotes"),
        child(`${root}/reports`, "/modules/automation", "reportsAutomation"),
      ],
    },
    {
      href: `${root}/automation`,
      labelKey: "automation",
      permissions: ["automation.read"],
      children: [child(`${root}/automation`, "/runs", "automationRuns")],
    },
    {
      href: `${root}/integrations`,
      labelKey: "integrations",
      permissions: ["integrations.read"],
    },
    {
      href: `${root}/attachments`,
      labelKey: "attachments",
      permissions: ["attachments.read"],
    },
    {
      href: `${root}/audit`,
      labelKey: "audit",
      permissions: ["audit.read"],
    },
    {
      href: `${root}/settings`,
      labelKey: "settings",
      permissions: ["companies.read"],
    },
    { href: `${root}/users`, labelKey: "users", permissions: ["users.read"] },
    {
      href: `${root}/roles`,
      labelKey: "roles",
      permissions: ["users.read"],
    },
    {
      href: `${root}/notifications`,
      labelKey: "notifications",
      permissions: ["notifications.read"],
    },
  ];
}
