/**
 * Side-effect imports so Turbopack/webpack invalidate `i18n/request`
 * when message JSON changes. Actual loading still uses fs.readFile
 * (dynamic JSON import can omit `.default` under Turbopack).
 */
import "../messages/ar.json";
import "../messages/en.json";
import "../messages/ar/ai.json";
import "../messages/ar/attachments.json";
import "../messages/ar/audit.json";
import "../messages/ar/automation.json";
import "../messages/ar/channels.json";
import "../messages/ar/crm.json";
import "../messages/ar/finance.json";
import "../messages/ar/home.json";
import "../messages/ar/hr.json";
import "../messages/ar/integrations.json";
import "../messages/ar/inventory.json";
import "../messages/ar/marketing.json";
import "../messages/ar/notebook.json";
import "../messages/ar/notifications.json";
import "../messages/ar/onboarding.json";
import "../messages/ar/platform.json";
import "../messages/ar/pos.json";
import "../messages/ar/purchasing.json";
import "../messages/ar/reports.json";
import "../messages/ar/rolesPage.json";
import "../messages/ar/sales.json";
import "../messages/ar/settings.json";
import "../messages/ar/tracking.json";
import "../messages/ar/users.json";
import "../messages/ar/work.json";
import "../messages/en/ai.json";
import "../messages/en/attachments.json";
import "../messages/en/audit.json";
import "../messages/en/automation.json";
import "../messages/en/channels.json";
import "../messages/en/crm.json";
import "../messages/en/finance.json";
import "../messages/en/home.json";
import "../messages/en/hr.json";
import "../messages/en/integrations.json";
import "../messages/en/inventory.json";
import "../messages/en/marketing.json";
import "../messages/en/notebook.json";
import "../messages/en/notifications.json";
import "../messages/en/onboarding.json";
import "../messages/en/platform.json";
import "../messages/en/pos.json";
import "../messages/en/purchasing.json";
import "../messages/en/reports.json";
import "../messages/en/rolesPage.json";
import "../messages/en/sales.json";
import "../messages/en/settings.json";
import "../messages/en/tracking.json";
import "../messages/en/users.json";
import "../messages/en/work.json";
