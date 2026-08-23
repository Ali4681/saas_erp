-- AlterTable item_categories
ALTER TABLE `item_categories`
  ADD COLUMN `inherited_tax_rate` DECIMAL(5, 2) NULL,
  ADD COLUMN `inherited_attributes` JSON NULL,
  ADD COLUMN `abc_class` VARCHAR(1) NULL,
  ADD COLUMN `shelf_life_days_alert` SMALLINT NULL;

-- AlterTable items
ALTER TABLE `items`
  ADD COLUMN `inherit_tax_from_category` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `is_matrix_parent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `matrix_axes` JSON NULL,
  ADD COLUMN `track_serial` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `track_batch` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `net_weight_kg` DECIMAL(18, 4) NULL,
  ADD COLUMN `gross_weight_kg` DECIMAL(18, 4) NULL,
  ADD COLUMN `volume_cbm` DECIMAL(18, 6) NULL,
  ADD COLUMN `abc_class` VARCHAR(1) NULL,
  ADD COLUMN `slow_moving_days` SMALLINT NULL,
  ADD COLUMN `name_ar` VARCHAR(220) NULL,
  ADD COLUMN `name_en` VARCHAR(220) NULL;

-- AlterTable warehouses
ALTER TABLE `warehouses`
  ADD COLUMN `is_sellable` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `warehouse_kind` VARCHAR(40) NOT NULL DEFAULT 'STANDARD';

-- CreateTable item_category_links
CREATE TABLE `item_category_links` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_relations
CREATE TABLE `item_relations` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `from_item_id` CHAR(36) NOT NULL,
  `to_item_id` CHAR(36) NOT NULL,
  `relation_type` VARCHAR(40) NOT NULL,
  `priority` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_attribute_defs
CREATE TABLE `item_attribute_defs` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `data_type` VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  `is_required` BOOLEAN NOT NULL DEFAULT false,
  `options_json` JSON NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_attribute_values
CREATE TABLE `item_attribute_values` (
  `id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `attribute_def_id` CHAR(36) NOT NULL,
  `value_text` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_unit_conversions
CREATE TABLE `item_unit_conversions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `unit_id` CHAR(36) NOT NULL,
  `factor_to_base` DECIMAL(18, 6) NOT NULL,
  `barcode` VARCHAR(120) NULL,
  `is_sell_unit` BOOLEAN NOT NULL DEFAULT false,
  `is_purchase_unit` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_barcodes
CREATE TABLE `item_barcodes` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `barcode` VARCHAR(120) NOT NULL,
  `barcode_type` VARCHAR(40) NOT NULL DEFAULT 'RETAIL',
  `unit_id` CHAR(36) NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  `payload_json` JSON NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_batches
CREATE TABLE `item_batches` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `batch_number` VARCHAR(80) NOT NULL,
  `manufactured_on` DATE NULL,
  `expires_on` DATE NULL,
  `quantity` DECIMAL(18, 3) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable item_serials
CREATE TABLE `item_serials` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `serial_number` VARCHAR(120) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'IN_STOCK',
  `warehouse_id` CHAR(36) NULL,
  `sold_invoice_id` CHAR(36) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable stock_transfers
CREATE TABLE `stock_transfers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `transfer_number` VARCHAR(60) NOT NULL,
  `from_warehouse_id` CHAR(36) NOT NULL,
  `to_warehouse_id` CHAR(36) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  `requested_by` CHAR(36) NOT NULL,
  `shipped_at` DATETIME(3) NULL,
  `received_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable stock_transfer_items
CREATE TABLE `stock_transfer_items` (
  `id` CHAR(36) NOT NULL,
  `transfer_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(18, 3) NOT NULL,
  `quantity_received` DECIMAL(18, 3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable stock_reservations
CREATE TABLE `stock_reservations` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(18, 3) NOT NULL,
  `source_type` VARCHAR(60) NOT NULL,
  `source_id` CHAR(36) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `released_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable stock_adjustments
CREATE TABLE `stock_adjustments` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `adjustment_number` VARCHAR(60) NOT NULL,
  `reason_code` VARCHAR(40) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  `notes` TEXT NULL,
  `requested_by` CHAR(36) NOT NULL,
  `approved_by` CHAR(36) NULL,
  `second_approver_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approved_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable stock_adjustment_items
CREATE TABLE `stock_adjustment_items` (
  `id` CHAR(36) NOT NULL,
  `adjustment_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `quantity_delta` DECIMAL(18, 3) NOT NULL,
  `unit_cost` DECIMAL(18, 2) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable label_templates
CREATE TABLE `label_templates` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `industry_key` VARCHAR(60) NULL,
  `width_mm` INTEGER NOT NULL DEFAULT 50,
  `height_mm` INTEGER NOT NULL DEFAULT 30,
  `layout_json` JSON NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable invoice_print_templates
CREATE TABLE `invoice_print_templates` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `layout_kind` VARCHAR(40) NOT NULL,
  `body_html` LONGTEXT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable landed_cost_allocations
CREATE TABLE `landed_cost_allocations` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `goods_receipt_id` CHAR(36) NULL,
  `total_landed` DECIMAL(18, 2) NOT NULL,
  `allocation_json` JSON NOT NULL,
  `created_by` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes & unique
CREATE UNIQUE INDEX `uq_item_category_link` ON `item_category_links`(`item_id`, `category_id`);
CREATE INDEX `idx_item_category_link_cat` ON `item_category_links`(`company_id`, `category_id`);
CREATE UNIQUE INDEX `uq_item_relation` ON `item_relations`(`from_item_id`, `to_item_id`, `relation_type`);
CREATE INDEX `idx_item_relation_from` ON `item_relations`(`company_id`, `from_item_id`);
CREATE UNIQUE INDEX `uq_item_attr_def_code` ON `item_attribute_defs`(`company_id`, `code`);
CREATE UNIQUE INDEX `uq_item_attr_value` ON `item_attribute_values`(`item_id`, `attribute_def_id`);
CREATE UNIQUE INDEX `uq_item_unit_conversion` ON `item_unit_conversions`(`item_id`, `unit_id`);
CREATE UNIQUE INDEX `uq_item_barcode_company` ON `item_barcodes`(`company_id`, `barcode`);
CREATE INDEX `idx_item_barcode_item` ON `item_barcodes`(`item_id`);
CREATE UNIQUE INDEX `uq_item_batch` ON `item_batches`(`company_id`, `item_id`, `batch_number`);
CREATE INDEX `idx_item_batch_expiry` ON `item_batches`(`company_id`, `expires_on`);
CREATE UNIQUE INDEX `uq_item_serial` ON `item_serials`(`company_id`, `serial_number`);
CREATE INDEX `idx_item_serial_status` ON `item_serials`(`item_id`, `status`);
CREATE UNIQUE INDEX `uq_stock_transfer_number` ON `stock_transfers`(`company_id`, `transfer_number`);
CREATE INDEX `idx_stock_transfer_status` ON `stock_transfers`(`company_id`, `status`);
CREATE INDEX `idx_stock_transfer_item` ON `stock_transfer_items`(`transfer_id`);
CREATE INDEX `idx_stock_reservation_exp` ON `stock_reservations`(`company_id`, `status`, `expires_at`);
CREATE INDEX `idx_stock_reservation_wh_item` ON `stock_reservations`(`warehouse_id`, `item_id`, `status`);
CREATE UNIQUE INDEX `uq_stock_adjustment_number` ON `stock_adjustments`(`company_id`, `adjustment_number`);
CREATE INDEX `idx_stock_adjustment_status` ON `stock_adjustments`(`company_id`, `status`);
CREATE INDEX `idx_stock_adjustment_item` ON `stock_adjustment_items`(`adjustment_id`);
CREATE UNIQUE INDEX `uq_label_template_code` ON `label_templates`(`company_id`, `code`);
CREATE UNIQUE INDEX `uq_invoice_print_template` ON `invoice_print_templates`(`company_id`, `code`);
CREATE INDEX `idx_landed_cost_po` ON `landed_cost_allocations`(`company_id`, `purchase_order_id`);

-- Foreign keys
ALTER TABLE `item_category_links` ADD CONSTRAINT `item_category_links_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_category_links` ADD CONSTRAINT `item_category_links_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_category_links` ADD CONSTRAINT `item_category_links_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_relations` ADD CONSTRAINT `item_relations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_relations` ADD CONSTRAINT `item_relations_from_item_id_fkey` FOREIGN KEY (`from_item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_relations` ADD CONSTRAINT `item_relations_to_item_id_fkey` FOREIGN KEY (`to_item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_attribute_defs` ADD CONSTRAINT `item_attribute_defs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_attribute_defs` ADD CONSTRAINT `item_attribute_defs_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `item_attribute_values` ADD CONSTRAINT `item_attribute_values_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_attribute_values` ADD CONSTRAINT `item_attribute_values_attribute_def_id_fkey` FOREIGN KEY (`attribute_def_id`) REFERENCES `item_attribute_defs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_unit_conversions` ADD CONSTRAINT `item_unit_conversions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_unit_conversions` ADD CONSTRAINT `item_unit_conversions_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_unit_conversions` ADD CONSTRAINT `item_unit_conversions_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `item_barcodes` ADD CONSTRAINT `item_barcodes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_barcodes` ADD CONSTRAINT `item_barcodes_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_barcodes` ADD CONSTRAINT `item_barcodes_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `item_batches` ADD CONSTRAINT `item_batches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_batches` ADD CONSTRAINT `item_batches_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_serials` ADD CONSTRAINT `item_serials_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `item_serials` ADD CONSTRAINT `item_serials_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_warehouse_id_fkey` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_warehouse_id_fkey` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_reservations` ADD CONSTRAINT `stock_reservations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_reservations` ADD CONSTRAINT `stock_reservations_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_reservations` ADD CONSTRAINT `stock_reservations_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_adjustment_id_fkey` FOREIGN KEY (`adjustment_id`) REFERENCES `stock_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `label_templates` ADD CONSTRAINT `label_templates_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoice_print_templates` ADD CONSTRAINT `invoice_print_templates_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `landed_cost_allocations` ADD CONSTRAINT `landed_cost_allocations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
