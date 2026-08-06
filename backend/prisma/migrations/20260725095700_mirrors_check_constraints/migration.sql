-- Hand-written CHECKs for Phase 5 provider mirrors (survive migrate-dev).
ALTER TABLE `external_products`
  ADD CONSTRAINT `chk_external_products_price` CHECK (`price` IS NULL OR `price` >= 0),
  ADD CONSTRAINT `chk_external_products_tax` CHECK (`tax_rate` IS NULL OR (`tax_rate` >= 0 AND `tax_rate` <= 100));

ALTER TABLE `external_inventory_levels`
  ADD CONSTRAINT `chk_external_inventory_available` CHECK (`quantity_available` IS NULL OR `quantity_available` >= 0),
  ADD CONSTRAINT `chk_external_inventory_reserved` CHECK (`quantity_reserved` IS NULL OR `quantity_reserved` >= 0);

ALTER TABLE `external_orders`
  ADD CONSTRAINT `chk_external_orders_subtotal` CHECK (`subtotal` >= 0),
  ADD CONSTRAINT `chk_external_orders_discount` CHECK (`discount_amount` >= 0),
  ADD CONSTRAINT `chk_external_orders_tax` CHECK (`tax_amount` >= 0),
  ADD CONSTRAINT `chk_external_orders_delivery_fee` CHECK (`delivery_fee` >= 0),
  ADD CONSTRAINT `chk_external_orders_provider_fee` CHECK (`provider_fee` >= 0),
  ADD CONSTRAINT `chk_external_orders_total` CHECK (`total_amount` >= 0);

ALTER TABLE `external_order_items`
  ADD CONSTRAINT `chk_external_order_items_qty` CHECK (`quantity` > 0),
  ADD CONSTRAINT `chk_external_order_items_unit_price` CHECK (`unit_price` >= 0),
  ADD CONSTRAINT `chk_external_order_items_total` CHECK (`total_amount` >= 0);

ALTER TABLE `external_refunds`
  ADD CONSTRAINT `chk_external_refunds_amount` CHECK (`amount` > 0);

ALTER TABLE `external_fulfillments`
  ADD CONSTRAINT `chk_external_fulfillments_delivery_window` CHECK (
    `delivered_at` IS NULL OR `pickup_at` IS NULL OR `delivered_at` >= `pickup_at`
  );

ALTER TABLE `external_promotions`
  ADD CONSTRAINT `chk_external_promotions_window` CHECK (
    `starts_at` IS NULL OR `ends_at` IS NULL OR `ends_at` > `starts_at`
  );

ALTER TABLE `external_settlements`
  ADD CONSTRAINT `chk_external_settlements_period` CHECK (
    `period_start` IS NULL OR `period_end` IS NULL OR `period_end` >= `period_start`
  );

ALTER TABLE `installment_transactions`
  ADD CONSTRAINT `chk_installment_transactions_amount` CHECK (`amount` > 0);

ALTER TABLE `installment_refunds`
  ADD CONSTRAINT `chk_installment_refunds_amount` CHECK (`amount` > 0);

ALTER TABLE `installment_disputes`
  ADD CONSTRAINT `chk_installment_disputes_amount` CHECK (`amount` IS NULL OR `amount` >= 0);
