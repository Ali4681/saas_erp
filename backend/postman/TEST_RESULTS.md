# Endpoint retest report

Date: 2026-07-25  
Target: `http://127.0.0.1:3000`  
Collection: `SaaS_ERP_Backend_API.postman_collection.json`

```bash
node scripts/run-endpoint-tests.js
```

## Summary (154 endpoints)

| Class | Count |
|-------|------:|
| **PASS** | **118** |
| BAD_REQUEST | 8 |
| AUTH (401/403) | 6 |
| SERVER_ERROR (500) | 17 |
| SKIP_MISSING_VAR | 4 |
| NOT_FOUND | 1 |

**Pass rate: 76.6%** (up from ~71% after separating Work vs Integration `projectId`)

Machine-readable: [`endpoint-test-report.json`](./endpoint-test-report.json)

## PASS highlights

Login, health, finance dashboard, CRM/sales/purchasing/inventory/HR lists, quotes/invoices/payments creates, reports, retention dry-run, integration project reads (with real ConnectedProject id), catalog, automation, notebook, marketing.

## Remaining non-pass (grouped)

**Expected business rules**
- Company slug exists, user already in company, cannot pay draft bill
- Stock count not open / cannot approve
- Project must be ACTIVE to sync; capability not effective (CONNECTING)
- PROJECT_LIMIT / BRANCH_LIMIT
- Sandbox without `x-company-id` → 401
- Auth refresh without tenant context → 401

**500s (mostly unhandled Prisma unique/FK / OrThrow)**
- Duplicate create codes: expense-categories, units, items, warehouses, suppliers, notebook categories, messaging channels/templates, work projects/phases, HR employees/payroll
- `GET /companies/:id`, `GET /integrations/providers/:code` (OrThrow → 500 instead of 404)
- api-request-logs, purchasing bills, mirror order without id

## Note

Re-import the latest collection if Postman still has old sample bodies.
