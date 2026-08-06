-- Hand-written CHECKs for Phase 6 simplified finance (survive migrate-dev).
-- expenses amount check may already exist from a partial prior apply.
-- Single-source rule cannot use FK columns in MySQL CHECK; enforced in FinanceService.

ALTER TABLE `financial_transactions`
  ADD CONSTRAINT `chk_finance_tx_amount_positive` CHECK (`amount` > 0);
