-- CreateTable
CREATE TABLE `crm_contacts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `contact_type` ENUM('LEAD', 'CUSTOMER') NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `company_name` VARCHAR(180) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `source` VARCHAR(80) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `owner_user_id` CHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_crm_contact_type_status`(`company_id`, `contact_type`, `status`),
    INDEX `idx_crm_contact_owner`(`company_id`, `owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_pipelines` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `default_company_id` CHAR(36) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',

    UNIQUE INDEX `crm_pipelines_default_company_id_key`(`default_company_id`),
    UNIQUE INDEX `uq_crm_pipeline_company_name`(`company_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_pipeline_stages` (
    `id` CHAR(36) NOT NULL,
    `crm_pipeline_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `position` SMALLINT NOT NULL,
    `probability` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `is_closed` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `uq_crm_stage_pipeline_position`(`crm_pipeline_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_opportunities` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `crm_contact_id` CHAR(36) NOT NULL,
    `crm_pipeline_id` CHAR(36) NOT NULL,
    `crm_pipeline_stage_id` CHAR(36) NOT NULL,
    `owner_user_id` CHAR(36) NULL,
    `title` VARCHAR(180) NOT NULL,
    `estimated_value` DECIMAL(18, 2) NULL,
    `currency` CHAR(3) NULL,
    `expected_close_date` DATE NULL,
    `status` ENUM('OPEN', 'WON', 'LOST', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_crm_opportunity_stage_status`(`company_id`, `crm_pipeline_stage_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_activities` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `crm_contact_id` CHAR(36) NULL,
    `crm_opportunity_id` CHAR(36) NULL,
    `activity_type` ENUM('CALL', 'MEETING', 'FOLLOW_UP', 'TASK', 'EMAIL', 'NOTE') NOT NULL,
    `subject` VARCHAR(180) NOT NULL,
    `notes` TEXT NULL,
    `scheduled_at` DATETIME(3) NULL,
    `occurred_at` DATETIME(3) NULL,
    `status` ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED') NOT NULL DEFAULT 'PLANNED',
    `assigned_to` CHAR(36) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_crm_activity_assignee_status`(`company_id`, `assigned_to`, `status`, `scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crm_contracts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `crm_contact_id` CHAR(36) NOT NULL,
    `crm_opportunity_id` CHAR(36) NULL,
    `contract_number` VARCHAR(60) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `starts_on` DATE NULL,
    `ends_on` DATE NULL,
    `value` DECIMAL(18, 2) NULL,
    `currency` CHAR(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_crm_contract_number`(`company_id`, `contract_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_categories` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `code` VARCHAR(40) NULL,
    `code_key` VARCHAR(40) NOT NULL DEFAULT '',
    `name` VARCHAR(140) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `idx_item_category_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_item_category_company_code`(`company_id`, `code_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `decimal_places` SMALLINT NOT NULL DEFAULT 0,

    UNIQUE INDEX `uq_unit_company_code`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `item_category_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NOT NULL,
    `sku` VARCHAR(120) NULL,
    `sku_key` VARCHAR(120) NOT NULL DEFAULT '',
    `barcode` VARCHAR(120) NULL,
    `barcode_key` VARCHAR(120) NOT NULL DEFAULT '',
    `name` VARCHAR(220) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `cost` DECIMAL(18, 2) NULL,
    `sale_price` DECIMAL(18, 2) NULL,
    `min_stock` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_item_company_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_item_company_sku`(`company_id`, `sku_key`),
    UNIQUE INDEX `uq_item_company_barcode`(`company_id`, `barcode_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouses` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `company_branch_id` CHAR(36) NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `address_line` TEXT NULL,

    INDEX `idx_warehouse_company_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_warehouse_company_code`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_balances` (
    `warehouse_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NOT NULL,
    `quantity_on_hand` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `quantity_reserved` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`warehouse_id`, `item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `warehouse_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NOT NULL,
    `movement_type` ENUM('OPENING', 'PURCHASE_RECEIPT', 'SALE_ISSUE', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'COUNT_ADJUSTMENT', 'MANUAL_ADJUSTMENT') NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_cost` DECIMAL(18, 2) NULL,
    `reference_type` VARCHAR(60) NULL,
    `reference_id` CHAR(36) NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_stock_movement_wh_item_time`(`company_id`, `warehouse_id`, `item_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_counts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `warehouse_id` CHAR(36) NOT NULL,
    `count_number` VARCHAR(60) NOT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `open_warehouse_id` CHAR(36) NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NOT NULL,
    `approved_by` CHAR(36) NULL,

    UNIQUE INDEX `stock_counts_open_warehouse_id_key`(`open_warehouse_id`),
    UNIQUE INDEX `uq_stock_count_number`(`company_id`, `count_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_count_items` (
    `id` CHAR(36) NOT NULL,
    `stock_count_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NOT NULL,
    `system_quantity` DECIMAL(18, 3) NOT NULL,
    `counted_quantity` DECIMAL(18, 3) NULL,
    `variance_quantity` DECIMAL(18, 3) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `uq_stock_count_item`(`stock_count_id`, `item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NULL,
    `code_key` VARCHAR(40) NOT NULL DEFAULT '',
    `name` VARCHAR(180) NOT NULL,
    `tax_number` VARCHAR(80) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,

    INDEX `idx_supplier_status_name`(`company_id`, `status`, `name`),
    UNIQUE INDEX `uq_supplier_company_code`(`company_id`, `code_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NOT NULL,
    `warehouse_id` CHAR(36) NULL,
    `order_number` VARCHAR(60) NOT NULL,
    `status` ENUM('DRAFT', 'REQUESTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `ordered_on` DATE NULL,
    `expected_on` DATE NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `requested_by` CHAR(36) NOT NULL,
    `approved_by` CHAR(36) NULL,

    INDEX `idx_purchase_order_status_ordered`(`company_id`, `status`, `ordered_on`),
    UNIQUE INDEX `uq_purchase_order_number`(`company_id`, `order_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` CHAR(36) NOT NULL,
    `purchase_order_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NOT NULL,
    `description` VARCHAR(240) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_cost` DECIMAL(18, 2) NOT NULL,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `position` SMALLINT NOT NULL,

    UNIQUE INDEX `uq_purchase_order_item_position`(`purchase_order_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_bills` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NOT NULL,
    `purchase_order_id` CHAR(36) NULL,
    `bill_number` VARCHAR(80) NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `issued_on` DATE NOT NULL,
    `due_on` DATE NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `balance_due` DECIMAL(18, 2) NOT NULL,

    INDEX `idx_supplier_bill_status_due`(`company_id`, `status`, `due_on`),
    UNIQUE INDEX `uq_supplier_bill_number`(`company_id`, `supplier_id`, `bill_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_bill_items` (
    `id` CHAR(36) NOT NULL,
    `supplier_bill_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NULL,
    `description` VARCHAR(240) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_cost` DECIMAL(18, 2) NOT NULL,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `position` SMALLINT NOT NULL,

    UNIQUE INDEX `uq_supplier_bill_item_position`(`supplier_bill_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `supplier_bill_id` CHAR(36) NOT NULL,
    `bank_account_id` CHAR(36) NULL,
    `payment_number` VARCHAR(60) NOT NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'PAYMENT_GATEWAY', 'OTHER') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'SUCCEEDED',
    `paid_at` DATETIME(3) NOT NULL,
    `external_reference` VARCHAR(191) NULL,

    INDEX `idx_supplier_payment_bill_status`(`supplier_bill_id`, `status`),
    UNIQUE INDEX `uq_supplier_payment_number`(`company_id`, `payment_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_quotes` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `crm_contact_id` CHAR(36) NOT NULL,
    `quote_number` VARCHAR(60) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `issued_on` DATE NOT NULL,
    `expires_on` DATE NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `approved_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sales_quote_status_issued`(`company_id`, `status`, `issued_on`),
    UNIQUE INDEX `uq_sales_quote_number`(`company_id`, `quote_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_quote_items` (
    `id` CHAR(36) NOT NULL,
    `sales_quote_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NULL,
    `description` VARCHAR(240) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_price` DECIMAL(18, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `position` SMALLINT NOT NULL,

    UNIQUE INDEX `uq_sales_quote_item_position`(`sales_quote_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoices` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `crm_contact_id` CHAR(36) NOT NULL,
    `sales_quote_id` CHAR(36) NULL,
    `invoice_number` VARCHAR(60) NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `issued_on` DATE NOT NULL,
    `due_on` DATE NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `balance_due` DECIMAL(18, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sales_invoice_status_due`(`company_id`, `status`, `due_on`),
    UNIQUE INDEX `uq_sales_invoice_number`(`company_id`, `invoice_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoice_items` (
    `id` CHAR(36) NOT NULL,
    `sales_invoice_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NULL,
    `description` VARCHAR(240) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_price` DECIMAL(18, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `position` SMALLINT NOT NULL,

    UNIQUE INDEX `uq_sales_invoice_item_position`(`sales_invoice_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_payments` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `sales_invoice_id` CHAR(36) NOT NULL,
    `bank_account_id` CHAR(36) NULL,
    `receipt_number` VARCHAR(60) NOT NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'PAYMENT_GATEWAY', 'OTHER') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'SUCCEEDED',
    `paid_at` DATETIME(3) NOT NULL,
    `external_reference` VARCHAR(191) NULL,

    INDEX `idx_sales_payment_invoice_status`(`sales_invoice_id`, `status`),
    UNIQUE INDEX `uq_sales_payment_receipt`(`company_id`, `receipt_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_credit_notes` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `sales_invoice_id` CHAR(36) NOT NULL,
    `credit_note_number` VARCHAR(60) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `issued_on` DATE NOT NULL,
    `reason` TEXT NULL,
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,

    INDEX `idx_sales_credit_note_invoice_status`(`sales_invoice_id`, `status`),
    UNIQUE INDEX `uq_sales_credit_note_number`(`company_id`, `credit_note_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_credit_note_items` (
    `id` CHAR(36) NOT NULL,
    `sales_credit_note_id` CHAR(36) NOT NULL,
    `sales_invoice_item_id` CHAR(36) NULL,
    `description` VARCHAR(240) NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,

    INDEX `idx_sales_credit_note_item`(`sales_credit_note_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crm_contacts` ADD CONSTRAINT `crm_contacts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_contacts` ADD CONSTRAINT `crm_contacts_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_pipelines` ADD CONSTRAINT `crm_pipelines_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_pipeline_stages` ADD CONSTRAINT `crm_pipeline_stages_crm_pipeline_id_fkey` FOREIGN KEY (`crm_pipeline_id`) REFERENCES `crm_pipelines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_crm_pipeline_id_fkey` FOREIGN KEY (`crm_pipeline_id`) REFERENCES `crm_pipelines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_crm_pipeline_stage_id_fkey` FOREIGN KEY (`crm_pipeline_stage_id`) REFERENCES `crm_pipeline_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_opportunities` ADD CONSTRAINT `crm_opportunities_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_crm_opportunity_id_fkey` FOREIGN KEY (`crm_opportunity_id`) REFERENCES `crm_opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_activities` ADD CONSTRAINT `crm_activities_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_contracts` ADD CONSTRAINT `crm_contracts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_contracts` ADD CONSTRAINT `crm_contracts_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crm_contracts` ADD CONSTRAINT `crm_contracts_crm_opportunity_id_fkey` FOREIGN KEY (`crm_opportunity_id`) REFERENCES `crm_opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_sales_invoice_id_fkey` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_supplier_bill_id_fkey` FOREIGN KEY (`supplier_bill_id`) REFERENCES `supplier_bills`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_categories` ADD CONSTRAINT `item_categories_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_categories` ADD CONSTRAINT `item_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_item_category_id_fkey` FOREIGN KEY (`item_category_id`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_company_branch_id_fkey` FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_items` ADD CONSTRAINT `stock_count_items_stock_count_id_fkey` FOREIGN KEY (`stock_count_id`) REFERENCES `stock_counts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_items` ADD CONSTRAINT `stock_count_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_bills` ADD CONSTRAINT `supplier_bills_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_bills` ADD CONSTRAINT `supplier_bills_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_bills` ADD CONSTRAINT `supplier_bills_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_bill_items` ADD CONSTRAINT `supplier_bill_items_supplier_bill_id_fkey` FOREIGN KEY (`supplier_bill_id`) REFERENCES `supplier_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_bill_items` ADD CONSTRAINT `supplier_bill_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_bill_id_fkey` FOREIGN KEY (`supplier_bill_id`) REFERENCES `supplier_bills`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_quote_items` ADD CONSTRAINT `sales_quote_items_sales_quote_id_fkey` FOREIGN KEY (`sales_quote_id`) REFERENCES `sales_quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_quote_items` ADD CONSTRAINT `sales_quote_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_sales_quote_id_fkey` FOREIGN KEY (`sales_quote_id`) REFERENCES `sales_quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_items` ADD CONSTRAINT `sales_invoice_items_sales_invoice_id_fkey` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_items` ADD CONSTRAINT `sales_invoice_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_sales_invoice_id_fkey` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_credit_notes` ADD CONSTRAINT `sales_credit_notes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_credit_notes` ADD CONSTRAINT `sales_credit_notes_sales_invoice_id_fkey` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_credit_note_items` ADD CONSTRAINT `sales_credit_note_items_sales_credit_note_id_fkey` FOREIGN KEY (`sales_credit_note_id`) REFERENCES `sales_credit_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_credit_note_items` ADD CONSTRAINT `sales_credit_note_items_sales_invoice_item_id_fkey` FOREIGN KEY (`sales_invoice_item_id`) REFERENCES `sales_invoice_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
