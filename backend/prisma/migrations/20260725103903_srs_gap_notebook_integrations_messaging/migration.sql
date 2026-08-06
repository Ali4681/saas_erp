-- AlterTable
ALTER TABLE `marketing_posts` MODIFY `channel` ENUM('INTERNAL_DRAFT', 'FACEBOOK', 'INSTAGRAM', 'X', 'LINKEDIN', 'TIKTOK', 'GOOGLE_BUSINESS_PROFILE', 'OTHER') NOT NULL;

-- CreateTable
CREATE TABLE `company_api_keys` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `key_prefix` VARCHAR(16) NOT NULL,
    `key_hash` CHAR(64) NOT NULL,
    `scopes` JSON NOT NULL,
    `rate_limit_per_min` INTEGER NOT NULL DEFAULT 60,
    `status` ENUM('ACTIVE', 'DISABLED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_company_api_key_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_company_api_key_hash`(`key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_request_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `company_api_key_id` CHAR(36) NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `status_code` SMALLINT NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `duration_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_api_request_log_created`(`company_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_webhooks` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `target_url` VARCHAR(500) NOT NULL,
    `secret_hash` CHAR(64) NOT NULL,
    `events` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'FAILED') NOT NULL DEFAULT 'ACTIVE',
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_company_webhook_status`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_deliveries` (
    `id` CHAR(36) NOT NULL,
    `company_webhook_id` CHAR(36) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `attempt_count` SMALLINT NOT NULL DEFAULT 1,
    `response_code` SMALLINT NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_webhook_delivery_created`(`company_webhook_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messaging_channels` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `provider` ENUM('WHATSAPP', 'SMTP', 'SMS') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `config` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_messaging_channel_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_messaging_channel_name`(`company_id`, `provider`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_templates` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `messaging_channel_id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `subject` VARCHAR(180) NULL,
    `body_template` TEXT NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_message_template_code`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_deliveries` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `messaging_channel_id` CHAR(36) NOT NULL,
    `message_template_id` CHAR(36) NULL,
    `recipient` VARCHAR(254) NOT NULL,
    `subject` VARCHAR(180) NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'QUEUED',
    `provider_message_id` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_message_delivery_created`(`company_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notebook_categories` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NULL,
    `code_key` VARCHAR(40) NOT NULL DEFAULT '',
    `name` VARCHAR(140) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `idx_notebook_category_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_notebook_category_code`(`company_id`, `code_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_notes` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NULL,
    `title` VARCHAR(220) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `work_project_id` CHAR(36) NULL,
    `crm_contact_id` CHAR(36) NULL,
    `employee_id` CHAR(36) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_business_note_status_priority`(`company_id`, `status`, `priority`),
    FULLTEXT INDEX `ft_business_note_search`(`title`, `body`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_note_comments` (
    `id` CHAR(36) NOT NULL,
    `note_id` CHAR(36) NOT NULL,
    `author_user_id` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_business_note_comment_created`(`note_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_note_revisions` (
    `id` CHAR(36) NOT NULL,
    `note_id` CHAR(36) NOT NULL,
    `edited_by` CHAR(36) NOT NULL,
    `title` VARCHAR(220) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_business_note_revision_created`(`note_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_api_keys` ADD CONSTRAINT `company_api_keys_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_api_keys` ADD CONSTRAINT `company_api_keys_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_request_logs` ADD CONSTRAINT `api_request_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_request_logs` ADD CONSTRAINT `api_request_logs_company_api_key_id_fkey` FOREIGN KEY (`company_api_key_id`) REFERENCES `company_api_keys`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_webhooks` ADD CONSTRAINT `company_webhooks_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_webhooks` ADD CONSTRAINT `company_webhooks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_company_webhook_id_fkey` FOREIGN KEY (`company_webhook_id`) REFERENCES `company_webhooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messaging_channels` ADD CONSTRAINT `messaging_channels_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_messaging_channel_id_fkey` FOREIGN KEY (`messaging_channel_id`) REFERENCES `messaging_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_messaging_channel_id_fkey` FOREIGN KEY (`messaging_channel_id`) REFERENCES `messaging_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_message_template_id_fkey` FOREIGN KEY (`message_template_id`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notebook_categories` ADD CONSTRAINT `notebook_categories_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_notes` ADD CONSTRAINT `business_notes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_notes` ADD CONSTRAINT `business_notes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `notebook_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_notes` ADD CONSTRAINT `business_notes_work_project_id_fkey` FOREIGN KEY (`work_project_id`) REFERENCES `work_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_notes` ADD CONSTRAINT `business_notes_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_notes` ADD CONSTRAINT `business_notes_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_notes` ADD CONSTRAINT `business_notes_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_note_comments` ADD CONSTRAINT `business_note_comments_note_id_fkey` FOREIGN KEY (`note_id`) REFERENCES `business_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_note_comments` ADD CONSTRAINT `business_note_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_note_revisions` ADD CONSTRAINT `business_note_revisions_note_id_fkey` FOREIGN KEY (`note_id`) REFERENCES `business_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_note_revisions` ADD CONSTRAINT `business_note_revisions_edited_by_fkey` FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
