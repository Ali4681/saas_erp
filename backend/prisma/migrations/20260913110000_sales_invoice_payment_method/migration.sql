-- Sales invoice tender at issue (CASH | BANK_TRANSFER | CARD | …)
-- Idempotent-ish: fails loudly if already present (expected after one successful deploy).
ALTER TABLE `sales_invoices`
  ADD COLUMN `payment_method` VARCHAR(40) NULL;
