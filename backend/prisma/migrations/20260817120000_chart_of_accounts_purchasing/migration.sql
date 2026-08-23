-- Chart of Accounts, GL mapping, purchase requisitions, goods receipts,
-- international PO / landing-cost fields, and GL journal lines.

ALTER TABLE `journal_entries`
  MODIFY COLUMN `entry_type` ENUM(
    'Z_REPORT',
    'HANDOVER',
    'DISCREPANCY',
    'MANUAL',
    'PERIOD_CLOSE',
    'SALES',
    'PURCHASE',
    'INVENTORY_ADJUSTMENT',
    'WALLET_PURCHASE',
    'SUPPLIER_PAYMENT',
    'OPENING'
  ) NOT NULL;

ALTER TABLE `journal_entries`
  ADD COLUMN `source_type` VARCHAR(40) NULL,
  ADD COLUMN `source_id` CHAR(36) NULL;

CREATE INDEX `idx_journal_source` ON `journal_entries`(`company_id`, `source_type`, `source_id`);

ALTER TABLE `journal_lines`
  MODIFY COLUMN `clearing_account_id` CHAR(36) NULL,
  ADD COLUMN `gl_account_id` CHAR(36) NULL;

CREATE INDEX `idx_journal_line_gl_account` ON `journal_lines`(`gl_account_id`);

CREATE TABLE `gl_accounts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name_ar` VARCHAR(220) NOT NULL,
  `name_en` VARCHAR(220) NOT NULL,
  `account_type` ENUM('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
  `normal_balance` ENUM('DEBIT','CREDIT') NOT NULL DEFAULT 'DEBIT',
  `parent_id` CHAR(36) NULL,
  `level` SMALLINT NOT NULL DEFAULT 1,
  `is_postable` BOOLEAN NOT NULL DEFAULT TRUE,
  `is_contra` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gl_account_company_code` (`company_id`, `code`),
  INDEX `idx_gl_account_type` (`company_id`, `account_type`, `is_active`),
  INDEX `idx_gl_account_parent` (`company_id`, `parent_id`),
  CONSTRAINT `gl_accounts_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `gl_accounts_parent_id_fkey`
    FOREIGN KEY (`parent_id`) REFERENCES `gl_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `journal_lines`
  ADD CONSTRAINT `journal_lines_gl_account_id_fkey`
    FOREIGN KEY (`gl_account_id`) REFERENCES `gl_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `company_account_mappings` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `sales_revenue_code` VARCHAR(20) NOT NULL DEFAULT '411000',
  `sales_vat_payable_code` VARCHAR(20) NOT NULL DEFAULT '212100',
  `sales_cash_pos_code` VARCHAR(20) NOT NULL DEFAULT '111200',
  `sales_card_bank_code` VARCHAR(20) NOT NULL DEFAULT '111300',
  `inventory_goods_code` VARCHAR(20) NOT NULL DEFAULT '113100',
  `inventory_in_transit_code` VARCHAR(20) NOT NULL DEFAULT '113500',
  `inventory_shrinkage_code` VARCHAR(20) NOT NULL DEFAULT '514000',
  `ap_local_code` VARCHAR(20) NOT NULL DEFAULT '211100',
  `ap_international_code` VARCHAR(20) NOT NULL DEFAULT '211200',
  `import_landing_cost_code` VARCHAR(20) NOT NULL DEFAULT '512000',
  `cogs_code` VARCHAR(20) NOT NULL DEFAULT '511000',
  `corporate_wallet_code` VARCHAR(20) NOT NULL DEFAULT '111500',
  `employee_advance_code` VARCHAR(20) NOT NULL DEFAULT '114100',
  `petty_cash_expense_code` VARCHAR(20) NOT NULL DEFAULT '522400',
  `main_treasury_code` VARCHAR(20) NOT NULL DEFAULT '111100',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_account_mappings_company_id_key` (`company_id`),
  CONSTRAINT `company_account_mappings_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `suppliers`
  ADD COLUMN `supplier_type` ENUM('LOCAL','INTERNATIONAL') NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'SAR',
  ADD COLUMN `payment_terms_days` SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN `country` VARCHAR(80) NULL,
  ADD COLUMN `origin_country` VARCHAR(80) NULL;

ALTER TABLE `items`
  ADD COLUMN `reorder_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN `supply_source` ENUM('LOCAL','INTERNATIONAL','EITHER') NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `preferred_supplier_id` CHAR(36) NULL,
  ADD COLUMN `inventory_account_id` CHAR(36) NULL;

ALTER TABLE `items`
  ADD CONSTRAINT `items_preferred_supplier_id_fkey`
    FOREIGN KEY (`preferred_supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `items_inventory_account_id_fkey`
    FOREIGN KEY (`inventory_account_id`) REFERENCES `gl_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `purchase_requisitions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `requisition_number` VARCHAR(60) NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `demand_source` ENUM('REORDER_POINT','BRANCH_REQUISITION','MANAGEMENT_PLAN','OTHER') NOT NULL DEFAULT 'BRANCH_REQUISITION',
  `company_branch_id` CHAR(36) NULL,
  `requested_by` CHAR(36) NOT NULL,
  `approved_by` CHAR(36) NULL,
  `notes` TEXT NULL,
  `needed_by` DATE NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchase_requisition_number` (`company_id`, `requisition_number`),
  INDEX `idx_purchase_requisition_status` (`company_id`, `status`),
  CONSTRAINT `purchase_requisitions_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchase_requisitions_company_branch_id_fkey`
    FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchase_requisitions_requested_by_fkey`
    FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchase_requisitions_approved_by_fkey`
    FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_requisition_items` (
  `id` CHAR(36) NOT NULL,
  `requisition_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NULL,
  `description` VARCHAR(240) NOT NULL,
  `quantity` DECIMAL(18,3) NOT NULL,
  `estimated_unit_cost` DECIMAL(18,2) NULL,
  `position` SMALLINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pr_item_position` (`requisition_id`, `position`),
  CONSTRAINT `purchase_requisition_items_requisition_id_fkey`
    FOREIGN KEY (`requisition_id`) REFERENCES `purchase_requisitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchase_requisition_items_item_id_fkey`
    FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_orders`
  ADD COLUMN `requisition_id` CHAR(36) NULL,
  ADD COLUMN `purchase_type` ENUM('LOCAL','INTERNATIONAL') NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `demand_source` ENUM('REORDER_POINT','BRANCH_REQUISITION','MANAGEMENT_PLAN','OTHER') NOT NULL DEFAULT 'OTHER',
  ADD COLUMN `freight_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `insurance_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `customs_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `port_fees_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN `customs_declaration_number` VARCHAR(80) NULL,
  ADD COLUMN `origin_country` VARCHAR(80) NULL,
  ADD COLUMN `in_transit` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `purchase_orders`
  ADD CONSTRAINT `purchase_orders_requisition_id_fkey`
    FOREIGN KEY (`requisition_id`) REFERENCES `purchase_requisitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `goods_receipts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `receipt_number` VARCHAR(60) NOT NULL,
  `status` ENUM('DRAFT','POSTED','VOID') NOT NULL DEFAULT 'POSTED',
  `received_on` DATE NOT NULL,
  `received_by` CHAR(36) NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_goods_receipt_number` (`company_id`, `receipt_number`),
  INDEX `idx_goods_receipt_po` (`company_id`, `purchase_order_id`),
  CONSTRAINT `goods_receipts_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `goods_receipts_purchase_order_id_fkey`
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `goods_receipts_warehouse_id_fkey`
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `goods_receipts_received_by_fkey`
    FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `goods_receipt_items` (
  `id` CHAR(36) NOT NULL,
  `goods_receipt_id` CHAR(36) NOT NULL,
  `purchase_order_item_id` CHAR(36) NULL,
  `item_id` CHAR(36) NOT NULL,
  `quantity_ordered` DECIMAL(18,3) NOT NULL,
  `quantity_received` DECIMAL(18,3) NOT NULL,
  `unit_cost` DECIMAL(18,2) NOT NULL,
  `position` SMALLINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gr_item_position` (`goods_receipt_id`, `position`),
  CONSTRAINT `goods_receipt_items_goods_receipt_id_fkey`
    FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `goods_receipt_items_item_id_fkey`
    FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `goods_receipt_items_purchase_order_item_id_fkey`
    FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `supplier_bills`
  ADD COLUMN `goods_receipt_id` CHAR(36) NULL,
  ADD COLUMN `three_way_matched` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `supplier_bills`
  ADD CONSTRAINT `supplier_bills_goods_receipt_id_fkey`
    FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
