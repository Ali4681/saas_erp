# Chart of Accounts & Purchasing Operations

**Status:** Adopted (Aug 2026)  
**Scope:** Full hierarchical COA, automatic account mapping, GL journals for sales/purchases, purchase requisitions, goods receipts (GRN), three-way matching, financial statement reports.

This extends `GOVERNANCE_OPERATIONS_ARCHITECTURE.md`: clearing journals remain for Z-report; full GL postings use `gl_accounts` + `journal_lines.gl_account_id`.

---

## 1. Chart of Accounts

Standard Saudi-oriented tree (codes `100000`–`525200`) seeded per company via:

- `POST /companies/:id/finance/chart-of-accounts/ensure`
- Seed helpers: `prisma/seed-coa.ts`

Families: Assets `1*`, Liabilities `2*`, Equity `3*`, Revenue `4*`, Costs/Expenses `5*`.

## 2. Account mapping (auto-posting)

`company_account_mappings` defaults:

| Event | Debit | Credit |
|-------|-------|--------|
| POS sale (cash) | `111200` | `411000` + VAT `212100` |
| POS sale (card) | `111300` | `411000` + VAT `212100` |
| Local bill issued | Inventory `113100` (+ VAT input) | AP `211100` |
| International bill | Inventory + landing `512000` | AP `211200` |
| Intl GRN from transit | `113100` | `113500` |
| Wallet / advances | `111500` / `114100` | expense / AP as configured |

APIs: `GET/PUT .../finance/account-mapping`

## 3. Purchasing cycle

1. **Demand:** reorder point (`min_stock`), branch/employee **purchase requisition**, or management plan (`demand_source`)
2. **Supplier type:** `LOCAL` vs `INTERNATIONAL` (currency, payment terms, origin)
3. **PO:** landing-cost fields; international → `in_transit` when ordered
4. **GRN:** `goods_receipts` on receive; stock movement + optional in-transit GL clear
5. **Bill + 3-way match:** PO ↔ GR ↔ bill (`three_way_matched`); GL AP posting when `ISSUED`

## 4. Reports

- Trial balance: `GET .../finance/reports/trial-balance?asOf=`
- Income statement: `GET .../finance/reports/income-statement?from=&to=`
- Balance sheet: `GET .../finance/reports/balance-sheet?asOf=`

## 5. UI

Finance: Chart of Accounts, Account mapping, Journals, Reports  
Purchasing: Requisitions (+ reorder suggestions)
