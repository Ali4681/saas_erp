-- Hand-written CHECKs for Phase 2 tenancy/billing (survive migrate-dev).
ALTER TABLE `company_settings`
  ADD CONSTRAINT `chk_company_settings_tax_rate` CHECK (`default_tax_rate` >= 0 AND `default_tax_rate` <= 100),
  ADD CONSTRAINT `chk_company_settings_next_invoice` CHECK (`next_invoice_number` > 0);

ALTER TABLE `plans`
  ADD CONSTRAINT `chk_plans_price_non_negative` CHECK (`price` >= 0);

ALTER TABLE `plan_features`
  ADD CONSTRAINT `chk_plan_features_limit` CHECK (`limit_value` IS NULL OR `limit_value` >= 0);

ALTER TABLE `subscriptions`
  ADD CONSTRAINT `chk_subscriptions_ends_after_starts` CHECK (`ends_at` > `starts_at`);

ALTER TABLE `subscription_invoices`
  ADD CONSTRAINT `chk_sub_invoice_amounts` CHECK (`subtotal` >= 0 AND `tax_amount` >= 0 AND `total_amount` >= 0);

ALTER TABLE `subscription_payments`
  ADD CONSTRAINT `chk_sub_payment_amount_positive` CHECK (`amount` > 0);

