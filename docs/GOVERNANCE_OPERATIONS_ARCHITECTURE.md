# Governance & Operations Architecture

**Status:** Adopted engineering contract (Aug 2026)  
**Scope:** Business hours, industry packs, hierarchical RBAC, role-based float/treasury mapping, Z-report posting, SoD, approval thresholds, immutable audit, break-glass, period locking.

This document overrides earlier “no journals in V1” guidance **only for shift Z-report and clearing/float handoff**. Full general ledger (Chart of Accounts, account mapping, financial statements) is documented in `CHART_OF_ACCOUNTS_AND_PURCHASING.md`.

---

## 1. Company business hours profile

| Mode | Behaviour |
|------|-----------|
| `HOURS_24` | Default start/end; system may auto-split into sequential `WorkShift` rows |
| `HOURS_12` | Manual start/end; optional second period (`TWO_PERIODS`) |
| `DYNAMIC` | Free datetime windows (`DynamicHoursWindow`) for variable operations |

**Tables:** `company_business_hours_profiles`, `dynamic_hours_windows`  
**APIs:**

- `GET/PUT /companies/:id/business-hours`
- `POST /companies/:id/business-hours/generate-shifts` (24h auto-split)
- `CRUD /companies/:id/business-hours/windows` (dynamic)

Financial periods and cashier shift eligibility are derived from the active profile + assigned `WorkShift`.

---

## 2. Role-based financial mapping

Every tenant role carries `financialProfile`:

| Profile | Float / drawer | Sales attachment | Close / approve |
|---------|----------------|------------------|-----------------|
| `CASHIER` | Opening float at shift login | Sales tied to `CashierShiftSession` | Own Z-close; no delete after save |
| `SALES_DELIVERY` | Collection float (no drawer) | Field invoices / collections | Handover to treasury |
| `MANAGER_SUPERVISOR` | No cash float | — | Approve closes, petty cash, discrepancies |
| `WAREHOUSE_KEEPER` | — | Stock docs | — |
| `ACCOUNTANT` | — | Journals / review | Period close assist |
| `TREASURY_CUSTODIAN` | Central vault | Bank deposits | Clearing settlements |
| `BRANCH_MANAGER` | Branch oversight | — | Daily close approve |
| `SYSTEM_ADMIN` | Config | — | Roles / settings (not cash) |
| `NONE` | Default / viewer | — | — |

**Tables:** `roles.financial_profile`, `cashier_shift_sessions`, `cashier_shift_handovers`

---

## 3. Real-time accounting (Z-report)

On `CashierShiftSession` close:

1. Compute expected vs counted → variance → intermediate **over/short** clearing accounts  
2. Emit compound `JournalEntry` (`Z_REPORT`) lines: cash, card network, transfer, petty expense, revenue, VAT, discrepancy  
3. Clearing handovers use `HANDOVER` journal type so funds never mix across users without a posting  

**Tables:** `journal_entries`, `journal_lines`, `clearing_accounts` (chart subset per company)

**APIs:**

- `POST .../cashier-shifts/:id/open|close|approve`
- `GET .../cashier-shifts/:id/z-report`
- Alerts via existing notifications on large variance / open outside approved hours

---

## 4. Smart industry adaptation

Platform catalog (`industry_activities`) with 50+ codes (flowers, F&B, retail, services, …).  
On company registration / settings pick:

1. Activate pack → seed suggested job titles (roles), item categories, expense categories, supplier types  
2. Does **not** wipe custom data; idempotent apply  

**Tables:** `industry_activities`, `industry_pack_role_templates`, `industry_pack_category_templates`, `company_industry_activations`

Keep existing `Company.businessCategory` (integration: delivery/installment/ecommerce) separate from **industry activity**.

---

## 5. Hierarchical tree RBAC

```
Owner (root)
 └─ Departments (Level 1)
     └─ Branches / sub-depts (Level 2)
         └─ Job roles + users (leaves)
```

- Org tree already partially in `CompanyDepartment.parentDepartmentId` + `CompanyBranch`  
- Roles gain optional `parentRoleId` + `description` + optional `companyId`  
- Delegation rule: granter may only assign permission codes ⊆ own effective set  
- Inheritance: new member inherits department/role defaults; user overrides via role change only (V1 single role per membership)

**UI:** existing `/roles` becomes “إدارة الأدوار والصلاحيات” with matrix (view/create/update/delete/approve/post).

---

## 6. Governance principles (hard rules)

### 6.1 Segregation of Duties (SoD)

`sod_conflict_rules` define forbidden permission pairs (e.g. `purchasing.write` vs `finance.pay`).  
Enforced on role create/update and user role assign. Owner may require dual control to override (logged).

### 6.2 Approval thresholds

`approval_thresholds`: `(companyId, actionType, maxAmount, currency, requiredPermission|roleCode)`.  
Examples: petty cash approve ≤ 500 SAR at branch supervisor; above → pending for finance manager.

### 6.3 Immutable audit trail

`audit_logs` remain append-only. Application **must reject** UPDATE/DELETE.  
Enhancement columns: `before_data`, `after_data`, `request_id`, `device_fingerprint`.  
Even platform admin cannot erase rows (retention archive = copy-out, never mutate).

### 6.4 Break-glass

`break_glass_sessions`: time-boxed elevated grant; SMS/email/high-priority notification to owner + finance; all actions tagged `breakGlassSessionId` in audit metadata.

### 6.5 Period locking & backdating

`financial_period_locks`: locked range blocks invoice/journal/expense create/update with `documentDate` inside lock.  
Exception: permission `finance.period_unlock` or `finance.backdate` within `backdateUntil`.

---

## 7. Common core roles (seed targets)

| Code suggestion | Financial profile |
|-----------------|-------------------|
| CASHIER | CASHIER |
| SHIFT_SUPERVISOR | MANAGER_SUPERVISOR |
| SALES_DELIVERY_REP | SALES_DELIVERY |
| WAREHOUSE_KEEPER | WAREHOUSE_KEEPER |
| ACCOUNTANT | ACCOUNTANT |
| TREASURY_CUSTODIAN | TREASURY_CUSTODIAN |
| BRANCH_MANAGER | BRANCH_MANAGER |
| SYSTEM_ADMIN (tenant) | SYSTEM_ADMIN |

Plus industry-specific titles from packs.

---

## 8. Delivery phases

| Phase | Deliverable |
|-------|-------------|
| **P0 (this change)** | Schema + migration; role description/financialProfile; architecture contract |
| **P1** | Business-hours API + settings UI; generate shifts |
| **P2** | Cashier shift open/close + Z-report journals |
| **P3** | SoD + thresholds enforcement in guards |
| **P4** | Industry packs apply-on-register |
| **P5** | Break-glass + period locks + audit column hardening |

Do not implement P2–P5 logic until P0 schema is deployed.
