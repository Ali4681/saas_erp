-- Hand-written CHECK: Prisma schema cannot express this. Spike proved migrate-dev leaves CHECK in place.
ALTER TABLE `convention_probe_items`
  ADD CONSTRAINT `chk_probe_item_unit_price_non_negative`
  CHECK (`unit_price` >= 0);

