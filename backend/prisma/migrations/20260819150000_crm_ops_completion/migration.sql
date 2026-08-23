ALTER TABLE `company_account_mappings`
  ADD COLUMN `sales_discount_code` VARCHAR(20) NOT NULL DEFAULT '415000',
  ADD COLUMN `channel_commission_code` VARCHAR(20) NOT NULL DEFAULT '524300',
  ADD COLUMN `bnpl_receivable_code` VARCHAR(20) NOT NULL DEFAULT '112500';

ALTER TABLE `sales_invoices`
  ADD COLUMN `zatca_qr` TEXT NULL,
  ADD COLUMN `extra_discount_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0;

CREATE TABLE `crm_otp_challenges` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NOT NULL,
  `purpose` VARCHAR(40) NOT NULL,
  `code_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_crm_otp_contact_purpose` (`contact_id`, `purpose`, `expires_at`),
  CONSTRAINT `crm_otp_challenges_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `crm_otp_challenges_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_purchase_orders` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NOT NULL,
  `po_number` VARCHAR(80) NOT NULL,
  `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
  `issued_on` DATE NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'SAR',
  `notes` TEXT NULL,
  `sales_invoice_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_customer_po_number` (`company_id`, `po_number`),
  INDEX `idx_customer_po_contact` (`company_id`, `contact_id`, `status`),
  CONSTRAINT `customer_purchase_orders_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `customer_purchase_orders_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_purchase_order_items` (
  `id` CHAR(36) NOT NULL,
  `customer_purchase_order_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NULL,
  `description` VARCHAR(240) NOT NULL,
  `quantity` DECIMAL(18, 3) NOT NULL,
  `unit_price` DECIMAL(18, 2) NOT NULL,
  `position` SMALLINT NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `customer_purchase_order_items_po_fkey` FOREIGN KEY (`customer_purchase_order_id`) REFERENCES `customer_purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_bundles` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `sku` VARCHAR(80) NULL,
  `bundle_price` DECIMAL(18, 2) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_product_bundle_company` (`company_id`, `is_active`),
  CONSTRAINT `product_bundles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_bundle_items` (
  `id` CHAR(36) NOT NULL,
  `bundle_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(18, 3) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_product_bundle_item` (`bundle_id`),
  CONSTRAINT `product_bundle_items_bundle_fkey` FOREIGN KEY (`bundle_id`) REFERENCES `product_bundles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_bundle_items_item_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `channel_inbound_orders` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `external_order_id` VARCHAR(120) NOT NULL,
  `sale_channel` VARCHAR(40) NOT NULL,
  `sales_invoice_id` CHAR(36) NULL,
  `commission_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `payload` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_channel_inbound_order` (`company_id`, `provider`, `external_order_id`),
  CONSTRAINT `channel_inbound_orders_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
