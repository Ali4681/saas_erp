# Qiwa Employment Contract Documentation — Implementation Report

## Backend Changes

### Models / entities
- Added enum `EmployeeQiwaContractStatus` (`NOT_STARTED`, `IN_PROGRESS`, `AWAITING_EMPLOYEE`, `DOCUMENTED`, `REJECTED_OR_MODIFICATION`).
- Added model `EmployeeQiwaContract` mapped to `employee_qiwa_contracts` (UUID v7, tenant-owned, `Employee` hasMany).
- Relations: `Company`, `Employee`, `User` (verifier + last updater).
- Registered in `schema-conventions` `TENANT_OWNED_MODELS`.

### Migration
- `backend/prisma/migrations/20260813140000_employee_qiwa_contracts/migration.sql` (applied via `prisma migrate deploy`).

### Endpoints (`/companies/:companyId/hr/...`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `employees/:employeeId/qiwa-contract` | `hr.read` |
| GET | `employees/:employeeId/qiwa-contract/summary` | `hr.qiwa.manage` |
| POST | `employees/:employeeId/qiwa-contract/start` | `hr.qiwa.manage` |
| POST | `employees/:employeeId/qiwa-contract/mark-sent` | `hr.qiwa.manage` |
| POST | `employees/:employeeId/qiwa-contract/mark-rejected` | `hr.qiwa.manage` |
| POST | `employees/:employeeId/qiwa-contract/retry` | `hr.qiwa.manage` |
| POST | `employees/:employeeId/qiwa-contract/confirm` | `hr.qiwa.manage` |

Legacy `POST .../qiwa` (link/ref) remains for compatibility; confirmation workflow is authoritative for documentation.

### Services
- `HrQiwaService` — workflow, transition guards, PDF validation, audit writes, confirm upload.
- `HrModule` wires `HrQiwaService`.
- `listEmployees` / `employeeSummary` expose `qiwaStatus` and Qiwa counts.

### Permissions / guards
- New permission: `hr.qiwa.manage`.
- Seeded for `COMPANY_OWNER`, `COMPANY_ADMIN` (via `PHASE8_WRITE`), and `OPERATIONS_MANAGER`.
- **Not** granted to `ACCOUNTANT` / `EMPLOYEE_VIEWER`.
- Enforced with existing `@RequirePermissions` (backend), not frontend-only.

### Upload logic
- Confirm uses existing `PlatformService.registerAttachment` (base64 JSON body, same pattern as insurance).
- Server-generated PDF filename; MIME + extension + `%PDF` magic-byte checks; max 15MB.
- Attachment entity type: `employee_qiwa_contract`; access via authenticated attachment routes.

### Audit integration
Uses existing `auditLog` with actions:
- `QIWA_DOCUMENTATION_STARTED`
- `QIWA_CONTRACT_SENT`
- `QIWA_STATUS_CHANGED`
- `QIWA_CONTRACT_DOCUMENTED`
- `QIWA_CONTRACT_FILE_UPLOADED`
- `QIWA_CONTRACT_MARKED_REJECTED`

---

## Frontend Changes

### Pages
- Employee detail personal tab: full Qiwa workflow section (replaces simple link/ref form).
- Employees list: Qiwa status column + Qiwa documentation summary widgets.

### Components
- `QiwaContractSection.tsx` — status UI, dialogs (start / mark sent / confirm / reject / retry), copy helpers, `window.open(qiwaUrl)`.

### API / actions
Server actions in `hr/actions.ts`:
- `startEmployeeQiwaDocumentation`
- `markEmployeeQiwaSent`
- `markEmployeeQiwaRejected`
- `retryEmployeeQiwaDocumentation`
- `confirmEmployeeQiwaDocumentation`

Conflict `409` surfaces a refresh message.

### Permission handling
- Manage actions gated with `can(..., "hr.qiwa.manage")`.
- Read of contract still available with `hr.read` via GET.

### Status UI / i18n
- `StatusBadge` tones + optional `label` for Qiwa statuses.
- EN + AR keys under `messages/*/hr.json`.
- Env: `NEXT_PUBLIC_QIWA_URL` (FE), `QIWA_URL` (BE example). Default `https://www.qiwa.sa/`.

---

## Database Changes

Final entity (`employee_qiwa_contracts`):

| Column | Notes |
|--------|--------|
| id | UUID Char(36) |
| company_id | FK companies |
| employee_id | FK employees |
| status | enum |
| qiwa_contract_reference | nullable varchar(120) |
| contract_attachment_id | nullable (attachment id) |
| started_at / sent_at / documented_at / rejected_at | nullable |
| verified_by_user_id / last_updated_by_user_id | nullable FK users |
| notes | text |
| created_at / updated_at | |

Indexes: `(company_id, employee_id, updated_at)`, `(company_id, status)`.

Relationship: `Employee` **hasMany** `EmployeeQiwaContract` (latest by `updatedAt`; renewals create a new row after `DOCUMENTED`).

---

## Qiwa Workflow

```
NOT_STARTED → IN_PROGRESS → AWAITING_EMPLOYEE → DOCUMENTED
                              ↘ REJECTED_OR_MODIFICATION → IN_PROGRESS
```

Rules:
- No Qiwa API / scrape / iframe; open official URL in a new tab only.
- `DOCUMENTED` requires reference + PDF + documentedAt (backend-enforced).
- Stale transitions return **409 Conflict**.
- Confirm also sets `employee.approvalStatus = APPROVED` and `qiwaContractRef`.

---

## Security

| Concern | Implementation |
|---------|----------------|
| HR-only manage | `hr.qiwa.manage` on mutating endpoints |
| Tenant isolation | `companyId` scoping + `TenantContextService` + employee existence check |
| File security | PDF-only, magic bytes, size limit, private attachment storage, auth download |
| Status manipulation | Server-side transition map + conditional `updateMany` on expected status |
| IDOR | Employee must belong to the same company |

---

## Testing

Added:
- `backend/src/modules/hr/hr-qiwa.service.spec.ts` — allowed/denied transitions
- `backend/src/modules/hr/hr-qiwa.workflow.spec.ts` — start, markSent conflict, confirm validation/success, 404

**Result:** `npm test` — **16 passed**.

Also:
- `prisma generate` + `migrate deploy` — OK
- `npx tsc --noEmit -p tsconfig.build.json` — OK
- `npx nest build` — OK

Frontend: no dedicated test runner configured. `tsc` noise from stale `.next/types` (pre-existing). JSON i18n validated.

---

## Existing Issues Found

- Full-repo `npm run lint` (backend) can hang / run very long in this environment; targeted Nest build + Qiwa unit tests were used instead.
- Frontend `npx tsc --noEmit` fails on stale `.next/types` routes under `app/api/auth/*` that no longer exist — unrelated to Qiwa.
- Permission `hr.qiwa.manage` is in seed; **re-run seed** (or assign the permission in Roles UI) so existing tenants receive it on OPS/Owner/Admin roles.
- Jest cannot load generated Prisma ESM client without mocks (documented in specs); tests mock `generated/prisma/client`.

---

## Ops checklist

1. Ensure migration applied (`npm run prisma:migrate` in backend).
2. Re-seed or grant `hr.qiwa.manage` to HR/ops roles.
3. Set `NEXT_PUBLIC_QIWA_URL=https://www.qiwa.sa/` in frontend env.
4. Open an employee profile → Personal → **Qiwa Employment Contract** and walk the flow.
