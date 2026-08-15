# Seed login credentials

Password for **all** users below: `Admin123!`

## Production (Plesk / server)

From the **backend** folder for **erpwejha** (not other projects like `theana` or `/var/www/html`):

```bash
cd /var/www/vhosts/bssflow.com/erpwejha.bssflow.com/backend

npm run build          # generate + migrate deploy + nest build + copy i18n
npm run seed           # roles + demo-co data (password Admin123!)
pm2 reload ecosystem.config.cjs --update-env
```

Optional check:

```bash
npm run seed:verify
```

Log in on the live site: `owner@demo-co.local` / `Admin123!`

Roles/permissions only (skip demo bulk data):

```bash
SEED_SKIP_DEMO=1 npm run seed
```

## Local

```bash
cd backend
npx prisma db seed
# or
npm run seed
```

## Platform

| Email | Role |
|-------|------|
| `admin@saas-erp.local` | PLATFORM_SUPER_ADMIN (all permissions) |

## Demo company

| Email | Role |
|-------|------|
| `owner@demo-co.local` | COMPANY_OWNER |
| `admin@demo-co.local` | COMPANY_ADMIN |
| `accountant@demo-co.local` | ACCOUNTANT |
| `finance@demo-co.local` | ACCOUNTANT |
| `ops@demo-co.local` | OPERATIONS_MANAGER |
| `hr@demo-co.local` | OPERATIONS_MANAGER |
| `warehouse@demo-co.local` | OPERATIONS_MANAGER |
| `sales@demo-co.local` | COMPANY_ADMIN |
| `viewer@demo-co.local` | EMPLOYEE_VIEWER |
| `support@demo-co.local` | EMPLOYEE_VIEWER |

## Role → permissions

### PLATFORM_SUPER_ADMIN
All module permissions (companies, users, plans, subscriptions, audit, integrations, finance, crm, sales, purchasing, inventory, hr, hr.sales_cash.approve, tracking, work, automation, marketing, attachments, ai, notebook, integration_center, messaging, notifications, reports, retention).

### COMPANY_OWNER
Tenant full access: companies R/W, users R/W, plans R, subscriptions R/W, audit R, integrations R/W, finance/crm/sales/purchasing/inventory R/W, hr R/W + sales_cash.approve + qiwa.manage + qiwa.approve, tracking R/W, work/automation/marketing R/W, attachments R/W, ai R/W, notebook/integration_center/messaging/notifications R/W, reports R, retention.run.

### COMPANY_ADMIN
Like owner without companies.write, subscriptions.write, retention.run (includes hr.qiwa.manage + hr.qiwa.approve).

### ACCOUNTANT
companies R, plans R, subscriptions R, audit R, integrations R, finance R/W, sales R/W, purchasing R/W, crm R, hr R, **hr.sales_cash.approve**, tracking R, attachments R/W, notebook R, reports R.

### OPERATIONS_MANAGER
companies R, users R, plans R, integrations R/W, finance R, crm R/W, sales R, purchasing R/W, inventory R/W, hr R/W + sales_cash.approve + **hr.qiwa.manage** (not qiwa.approve), tracking R/W, work/automation/marketing R/W, attachments R/W, ai R/W, notebook/integration_center/messaging/notifications R/W, reports R.

### EMPLOYEE_VIEWER
companies R, plans R, integrations R, finance/crm/sales/purchasing/inventory R, hr R, tracking R, work/automation/marketing R, attachments R/**W** (receipts), ai R, notebook/integration_center/messaging/notifications R, reports R.

### COMPANY_EMPLOYEE
Same broad reads as EMPLOYEE_VIEWER + **hr.self** (My Profile self-service). Created automatically when HR checks “Create app login” on a new employee.
