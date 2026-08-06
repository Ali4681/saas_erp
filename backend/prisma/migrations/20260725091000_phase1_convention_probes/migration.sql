-- CreateTable
CREATE TABLE `convention_probe_companies` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convention_probe_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(220) NOT NULL,
    `description` TEXT NULL,
    `unit_price` DECIMAL(18, 2) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `deleted_at` DATETIME(3) NULL,
    `deleted_marker` VARCHAR(36) NOT NULL DEFAULT '',
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_probe_item_company_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_probe_item_company_name`(`company_id`, `name`, `deleted_marker`),
    FULLTEXT INDEX `ft_probe_item_name_description`(`name`, `description`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convention_probe_audit_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NULL,
    `actor_user_id` CHAR(36) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` CHAR(36) NULL,
    `metadata` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_probe_audit_company_created`(`company_id`, `created_at` DESC),
    INDEX `idx_probe_audit_entity`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `convention_probe_items` ADD CONSTRAINT `convention_probe_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `convention_probe_companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
