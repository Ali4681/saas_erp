-- CreateTable
CREATE TABLE `external_categories` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `project_location_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `parent_external_id` VARCHAR(191) NULL,
    `name` VARCHAR(180) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `sort_order` INTEGER NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_external_category_location_status`(`connected_project_id`, `project_location_id`, `status`),
    UNIQUE INDEX `uq_external_category_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_products` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `project_location_id` CHAR(36) NULL,
    `external_category_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(120) NULL,
    `name` VARCHAR(220) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `price` DECIMAL(18, 2) NULL,
    `currency` CHAR(3) NULL,
    `tax_rate` DECIMAL(5, 2) NULL,
    `image_url` TEXT NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_external_product_status`(`connected_project_id`, `status`),
    INDEX `idx_external_product_sku`(`connected_project_id`, `sku`),
    UNIQUE INDEX `uq_external_product_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_product_variants` (
    `id` CHAR(36) NOT NULL,
    `external_product_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(120) NULL,
    `name` VARCHAR(180) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `price` DECIMAL(18, 2) NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_external_variant_status`(`external_product_id`, `status`),
    UNIQUE INDEX `uq_external_variant_product_external`(`external_product_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_inventory_levels` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `project_location_id` CHAR(36) NOT NULL,
    `external_product_id` CHAR(36) NOT NULL,
    `external_product_variant_id` CHAR(36) NULL,
    `variant_key` VARCHAR(36) NOT NULL DEFAULT '',
    `external_id` VARCHAR(191) NULL,
    `quantity_available` DECIMAL(18, 3) NULL,
    `quantity_reserved` DECIMAL(18, 3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `external_updated_at` DATETIME(3) NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_external_inventory_level`(`connected_project_id`, `project_location_id`, `external_product_id`, `variant_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_customers` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(180) NULL,
    `email_ciphertext` BLOB NULL,
    `phone_ciphertext` BLOB NULL,
    `key_version` SMALLINT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `data_retention_until` DATE NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_external_customer_status`(`connected_project_id`, `status`),
    UNIQUE INDEX `uq_external_customer_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_orders` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `project_location_id` CHAR(36) NULL,
    `external_customer_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `external_number` VARCHAR(120) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `financial_status` ENUM('PENDING', 'AUTHORIZED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'VOIDED', 'UNKNOWN') NULL,
    `fulfillment_status` ENUM('UNFULFILLED', 'PROCESSING', 'READY', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED', 'UNKNOWN') NULL,
    `placed_at` DATETIME(3) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `delivery_fee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `provider_fee` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `net_amount` DECIMAL(18, 2) NULL,
    `payment_method` VARCHAR(80) NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_external_order_placed`(`connected_project_id`, `placed_at` DESC),
    INDEX `idx_external_order_status`(`connected_project_id`, `status`),
    UNIQUE INDEX `uq_external_order_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_order_items` (
    `id` CHAR(36) NOT NULL,
    `external_order_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NULL,
    `external_id_key` VARCHAR(191) NOT NULL DEFAULT '',
    `external_product_id` CHAR(36) NULL,
    `external_product_variant_id` CHAR(36) NULL,
    `name` VARCHAR(220) NOT NULL,
    `sku` VARCHAR(120) NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_price` DECIMAL(18, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_external_order_item_order`(`external_order_id`),
    UNIQUE INDEX `uq_external_order_item_external`(`external_order_id`, `external_id_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_order_status_history` (
    `id` CHAR(36) NOT NULL,
    `external_order_id` CHAR(36) NOT NULL,
    `external_status` VARCHAR(100) NOT NULL,
    `normalized_status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED', 'UNKNOWN') NOT NULL,
    `source` ENUM('POLL', 'WEBHOOK', 'USER_ACTION', 'RECONCILIATION') NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_external_order_status_history`(`external_order_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_refunds` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `external_order_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `status` ENUM('REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `reason` TEXT NULL,
    `requested_at` DATETIME(3) NULL,
    `processed_at` DATETIME(3) NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_external_refund_order_status`(`external_order_id`, `status`),
    UNIQUE INDEX `uq_external_refund_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_fulfillments` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `external_order_id` CHAR(36) NOT NULL,
    `external_driver_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `status` ENUM('UNFULFILLED', 'PROCESSING', 'READY', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED', 'UNKNOWN') NOT NULL,
    `tracking_number` VARCHAR(160) NULL,
    `tracking_url` TEXT NULL,
    `pickup_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `delivery_fee` DECIMAL(18, 2) NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_external_fulfillment_order_status`(`external_order_id`, `status`),
    UNIQUE INDEX `uq_external_fulfillment_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_promotions` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `project_location_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `promotion_type` VARCHAR(60) NOT NULL,
    `value` DECIMAL(18, 2) NULL,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `raw_payload` JSON NOT NULL,

    INDEX `idx_external_promotion_status`(`connected_project_id`, `status`),
    UNIQUE INDEX `uq_external_promotion_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_drivers` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `project_location_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(180) NULL,
    `phone_ciphertext` BLOB NULL,
    `key_version` SMALLINT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `vehicle_type` VARCHAR(80) NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_external_driver_status`(`connected_project_id`, `status`),
    UNIQUE INDEX `uq_external_driver_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_settlements` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `period_start` DATE NULL,
    `period_end` DATE NULL,
    `status` ENUM('PENDING', 'EXPECTED', 'PROCESSING', 'PAID', 'PARTIALLY_PAID', 'DISPUTED', 'FAILED') NOT NULL,
    `gross_sales` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `provider_fees` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `refunds` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `adjustments` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `net_amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `expected_at` DATE NULL,
    `paid_at` DATETIME(3) NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_external_settlement_status_period`(`connected_project_id`, `status`, `period_end` DESC),
    UNIQUE INDEX `uq_external_settlement_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installment_transactions` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `merchant_order_reference` VARCHAR(191) NOT NULL,
    `external_customer_reference` VARCHAR(191) NULL,
    `status` ENUM('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_CAPTURED', 'CLOSED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `provider_fee` DECIMAL(18, 2) NULL,
    `net_amount` DECIMAL(18, 2) NULL,
    `checkout_url` TEXT NULL,
    `authorized_at` DATETIME(3) NULL,
    `captured_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NOT NULL,

    INDEX `idx_installment_txn_merchant_ref`(`connected_project_id`, `merchant_order_reference`),
    UNIQUE INDEX `uq_installment_txn_project_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installment_events` (
    `id` CHAR(36) NOT NULL,
    `installment_transaction_id` CHAR(36) NOT NULL,
    `external_event_id` VARCHAR(191) NULL,
    `external_event_key` VARCHAR(191) NOT NULL DEFAULT '',
    `event_type` VARCHAR(100) NOT NULL,
    `status` ENUM('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_CAPTURED', 'CLOSED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED', 'UNKNOWN') NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_installment_event_occurred`(`installment_transaction_id`, `occurred_at`),
    UNIQUE INDEX `uq_installment_event_external`(`installment_transaction_id`, `external_event_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installment_refunds` (
    `id` CHAR(36) NOT NULL,
    `installment_transaction_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `status` ENUM('REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `reason` TEXT NULL,
    `requested_at` DATETIME(3) NULL,
    `processed_at` DATETIME(3) NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_installment_refund_status`(`installment_transaction_id`, `status`),
    UNIQUE INDEX `uq_installment_refund_external`(`installment_transaction_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installment_disputes` (
    `id` CHAR(36) NOT NULL,
    `installment_transaction_id` CHAR(36) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'EVIDENCE_REQUIRED', 'CHALLENGED', 'ACCEPTED', 'WON', 'LOST', 'CLOSED') NOT NULL,
    `reason` VARCHAR(180) NULL,
    `amount` DECIMAL(18, 2) NULL,
    `due_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `raw_payload` JSON NOT NULL,

    INDEX `idx_installment_dispute_status_due`(`status`, `due_at`),
    UNIQUE INDEX `uq_installment_dispute_external`(`installment_transaction_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `external_categories` ADD CONSTRAINT `external_categories_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_categories` ADD CONSTRAINT `external_categories_project_location_id_fkey` FOREIGN KEY (`project_location_id`) REFERENCES `project_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_products` ADD CONSTRAINT `external_products_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_products` ADD CONSTRAINT `external_products_project_location_id_fkey` FOREIGN KEY (`project_location_id`) REFERENCES `project_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_products` ADD CONSTRAINT `external_products_external_category_id_fkey` FOREIGN KEY (`external_category_id`) REFERENCES `external_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_product_variants` ADD CONSTRAINT `external_product_variants_external_product_id_fkey` FOREIGN KEY (`external_product_id`) REFERENCES `external_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_inventory_levels` ADD CONSTRAINT `external_inventory_levels_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_inventory_levels` ADD CONSTRAINT `external_inventory_levels_project_location_id_fkey` FOREIGN KEY (`project_location_id`) REFERENCES `project_locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_inventory_levels` ADD CONSTRAINT `external_inventory_levels_external_product_id_fkey` FOREIGN KEY (`external_product_id`) REFERENCES `external_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_inventory_levels` ADD CONSTRAINT `external_inventory_levels_external_product_variant_id_fkey` FOREIGN KEY (`external_product_variant_id`) REFERENCES `external_product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_customers` ADD CONSTRAINT `external_customers_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_orders` ADD CONSTRAINT `external_orders_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_orders` ADD CONSTRAINT `external_orders_project_location_id_fkey` FOREIGN KEY (`project_location_id`) REFERENCES `project_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_orders` ADD CONSTRAINT `external_orders_external_customer_id_fkey` FOREIGN KEY (`external_customer_id`) REFERENCES `external_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_order_items` ADD CONSTRAINT `external_order_items_external_order_id_fkey` FOREIGN KEY (`external_order_id`) REFERENCES `external_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_order_items` ADD CONSTRAINT `external_order_items_external_product_id_fkey` FOREIGN KEY (`external_product_id`) REFERENCES `external_products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_order_items` ADD CONSTRAINT `external_order_items_external_product_variant_id_fkey` FOREIGN KEY (`external_product_variant_id`) REFERENCES `external_product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_order_status_history` ADD CONSTRAINT `external_order_status_history_external_order_id_fkey` FOREIGN KEY (`external_order_id`) REFERENCES `external_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_refunds` ADD CONSTRAINT `external_refunds_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_refunds` ADD CONSTRAINT `external_refunds_external_order_id_fkey` FOREIGN KEY (`external_order_id`) REFERENCES `external_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_fulfillments` ADD CONSTRAINT `external_fulfillments_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_fulfillments` ADD CONSTRAINT `external_fulfillments_external_order_id_fkey` FOREIGN KEY (`external_order_id`) REFERENCES `external_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_fulfillments` ADD CONSTRAINT `external_fulfillments_external_driver_id_fkey` FOREIGN KEY (`external_driver_id`) REFERENCES `external_drivers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_promotions` ADD CONSTRAINT `external_promotions_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_promotions` ADD CONSTRAINT `external_promotions_project_location_id_fkey` FOREIGN KEY (`project_location_id`) REFERENCES `project_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_drivers` ADD CONSTRAINT `external_drivers_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_drivers` ADD CONSTRAINT `external_drivers_project_location_id_fkey` FOREIGN KEY (`project_location_id`) REFERENCES `project_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_settlements` ADD CONSTRAINT `external_settlements_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `installment_transactions` ADD CONSTRAINT `installment_transactions_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `installment_events` ADD CONSTRAINT `installment_events_installment_transaction_id_fkey` FOREIGN KEY (`installment_transaction_id`) REFERENCES `installment_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `installment_refunds` ADD CONSTRAINT `installment_refunds_installment_transaction_id_fkey` FOREIGN KEY (`installment_transaction_id`) REFERENCES `installment_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `installment_disputes` ADD CONSTRAINT `installment_disputes_installment_transaction_id_fkey` FOREIGN KEY (`installment_transaction_id`) REFERENCES `installment_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
