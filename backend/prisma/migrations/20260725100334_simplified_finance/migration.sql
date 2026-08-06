-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `account_type` ENUM('CASH', 'BANK', 'PAYMENT_GATEWAY') NOT NULL,
    `bank_name` VARCHAR(140) NULL,
    `iban_ciphertext` BLOB NULL,
    `iban_key_version` SMALLINT NULL,
    `iban_last4` CHAR(4) NULL,
    `iban_fingerprint` CHAR(64) NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_bank_account_company_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_bank_account_iban_fingerprint`(`company_id`, `iban_fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NULL,
    `code_key` VARCHAR(40) NOT NULL DEFAULT '',
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_expense_category_company_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_expense_category_company_code`(`company_id`, `code_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `expense_category_id` CHAR(36) NOT NULL,
    `bank_account_id` CHAR(36) NULL,
    `connected_project_id` CHAR(36) NULL,
    `description` VARCHAR(240) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `expense_date` DATE NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `reference_number` VARCHAR(100) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_expense_company_date_status`(`company_id`, `expense_date` DESC, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_transactions` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NULL,
    `transaction_type` ENUM('PLATFORM_SALE', 'PROVIDER_FEE', 'REFUND', 'SETTLEMENT', 'EXPENSE', 'INTERNAL_SALE', 'INTERNAL_PURCHASE', 'RECEIPT', 'PAYMENT', 'ADJUSTMENT') NOT NULL,
    `direction` ENUM('INFLOW', 'OUTFLOW') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `external_order_id` CHAR(36) NULL,
    `installment_transaction_id` CHAR(36) NULL,
    `external_settlement_id` CHAR(36) NULL,
    `expense_id` CHAR(36) NULL,
    `sales_invoice_id` CHAR(36) NULL,
    `supplier_bill_id` CHAR(36) NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_finance_tx_company_occurred_type`(`company_id`, `occurred_at` DESC, `transaction_type`),
    INDEX `idx_finance_tx_project_occurred`(`connected_project_id`, `occurred_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_categories` ADD CONSTRAINT `expense_categories_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_expense_category_id_fkey` FOREIGN KEY (`expense_category_id`) REFERENCES `expense_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_external_order_id_fkey` FOREIGN KEY (`external_order_id`) REFERENCES `external_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_installment_transaction_id_fkey` FOREIGN KEY (`installment_transaction_id`) REFERENCES `installment_transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_external_settlement_id_fkey` FOREIGN KEY (`external_settlement_id`) REFERENCES `external_settlements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_transactions` ADD CONSTRAINT `financial_transactions_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
