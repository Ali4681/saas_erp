-- AlterTable
ALTER TABLE `marketing_posts`
  ADD COLUMN `archived_at` DATETIME(3) NULL,
  ADD COLUMN `failure_reason` TEXT NULL,
  ADD COLUMN `publish_mode` VARCHAR(40) NULL;

-- CreateIndex
CREATE INDEX `idx_marketing_post_calendar` ON `marketing_posts`(`company_id`, `scheduled_at`);

-- CreateTable
CREATE TABLE `marketing_post_media` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `marketing_post_id` CHAR(36) NOT NULL,
    `media_type` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `checksum_sha256` CHAR(64) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_marketing_post_media_position`(`marketing_post_id`, `position`),
    INDEX `idx_marketing_post_media_company`(`company_id`, `marketing_post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketing_platform_connections` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `channel` ENUM('INTERNAL_DRAFT', 'FACEBOOK', 'INSTAGRAM', 'X', 'LINKEDIN', 'TIKTOK', 'GOOGLE_BUSINESS_PROFILE', 'OTHER') NOT NULL,
    `display_name` VARCHAR(160) NOT NULL,
    `external_account_id` VARCHAR(191) NULL,
    `status` ENUM('DISCONNECTED', 'CONNECTED', 'ERROR', 'REVOKED') NOT NULL DEFAULT 'DISCONNECTED',
    `credentials_ciphertext` LONGBLOB NULL,
    `key_version` INTEGER NULL,
    `last_error` TEXT NULL,
    `connected_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_marketing_connection_status`(`company_id`, `channel`, `status`),
    UNIQUE INDEX `uq_marketing_connection_channel_name`(`company_id`, `channel`, `display_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketing_post_media` ADD CONSTRAINT `marketing_post_media_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_post_media` ADD CONSTRAINT `marketing_post_media_marketing_post_id_fkey` FOREIGN KEY (`marketing_post_id`) REFERENCES `marketing_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_platform_connections` ADD CONSTRAINT `marketing_platform_connections_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_platform_connections` ADD CONSTRAINT `marketing_platform_connections_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
