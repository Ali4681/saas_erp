-- AlterTable
ALTER TABLE `sales_payments` ADD COLUMN `company_payment_method_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `supplier_payments` ADD COLUMN `company_payment_method_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `payment_gateways` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `provider_type` ENUM('GLOBAL', 'REGIONAL', 'CUSTOM') NOT NULL DEFAULT 'GLOBAL',
    `country_codes` JSON NOT NULL,
    `supports_currencies` JSON NOT NULL,
    `docs_url` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_gateways_code_key`(`code`),
    INDEX `idx_payment_gateway_active_sort`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_payment_methods` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `payment_gateway_id` CHAR(36) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `credentials_ciphertext` LONGBLOB NULL,
    `key_version` SMALLINT NULL,
    `config` JSON NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_company_payment_method_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_company_payment_method`(`company_id`, `payment_gateway_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_payment_methods` ADD CONSTRAINT `company_payment_methods_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_payment_methods` ADD CONSTRAINT `company_payment_methods_payment_gateway_id_fkey` FOREIGN KEY (`payment_gateway_id`) REFERENCES `payment_gateways`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_payment_methods` ADD CONSTRAINT `company_payment_methods_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_company_payment_method_id_fkey` FOREIGN KEY (`company_payment_method_id`) REFERENCES `company_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_payments` ADD CONSTRAINT `sales_payments_company_payment_method_id_fkey` FOREIGN KEY (`company_payment_method_id`) REFERENCES `company_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
