-- CreateTable
CREATE TABLE `platform_categories` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `platform_categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_providers` (
    `id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `api_availability` ENUM('PUBLIC_DOCUMENTED', 'PARTNER_PORTAL', 'PRIVATE_CONFIRMED', 'UNVERIFIED_PUBLICLY', 'NOT_SUPPORTED') NOT NULL,
    `official_docs_url` TEXT NULL,
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `platform_providers_code_key`(`code`),
    INDEX `idx_provider_category_active`(`category_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `capabilities` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `entity_type` VARCHAR(60) NOT NULL,
    `direction` ENUM('READ', 'WRITE', 'BOTH', 'EVENT') NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `capabilities_code_key`(`code`),
    INDEX `idx_capability_entity_direction`(`entity_type`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_capabilities` (
    `provider_id` CHAR(36) NOT NULL,
    `capability_id` CHAR(36) NOT NULL,
    `support_status` ENUM('VERIFIED', 'PARTNER_ENABLED', 'UNVERIFIED', 'NOT_SUPPORTED') NOT NULL,
    `required_scope` VARCHAR(160) NULL,
    `notes` TEXT NULL,
    `source_url` TEXT NULL,
    `verified_at` DATE NULL,

    PRIMARY KEY (`provider_id`, `capability_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `connected_projects` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NOT NULL,
    `provider_id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `external_account_id` VARCHAR(191) NULL,
    `environment` ENUM('SANDBOX', 'PRODUCTION') NOT NULL DEFAULT 'SANDBOX',
    `status` ENUM('DRAFT', 'CONNECTING', 'ACTIVE', 'ERROR', 'DISABLED', 'REVOKED') NOT NULL DEFAULT 'DRAFT',
    `default_currency` CHAR(3) NULL,
    `last_successful_sync_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_connected_project_company_category_status`(`company_id`, `category_id`, `status`),
    UNIQUE INDEX `uq_connected_project_company_provider_name`(`company_id`, `provider_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_credentials` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `auth_type` ENUM('OAUTH2', 'API_KEY', 'BASIC', 'HMAC', 'CUSTOM') NOT NULL,
    `credentials_ciphertext` LONGBLOB NOT NULL,
    `key_version` SMALLINT NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXPIRING', 'EXPIRED', 'REVOKED', 'INVALID') NOT NULL DEFAULT 'ACTIVE',
    `rotated_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `project_credentials_connected_project_id_key`(`connected_project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_locations` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `company_branch_id` CHAR(36) NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `code` VARCHAR(80) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `timezone` VARCHAR(64) NULL,
    `city` VARCHAR(100) NULL,
    `address_line` TEXT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `raw_payload` JSON NOT NULL,
    `last_synced_at` DATETIME(3) NULL,

    INDEX `idx_project_location_status`(`connected_project_id`, `status`),
    UNIQUE INDEX `uq_project_location_external`(`connected_project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_sync_states` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `entity_type` VARCHAR(60) NOT NULL,
    `direction` ENUM('IMPORT', 'EXPORT', 'BIDIRECTIONAL') NOT NULL,
    `cursor` TEXT NULL,
    `last_synced_at` DATETIME(3) NULL,
    `last_status` ENUM('NEVER_RUN', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'NEVER_RUN',
    `consecutive_failures` INTEGER NOT NULL DEFAULT 0,
    `last_error_at` DATETIME(3) NULL,

    UNIQUE INDEX `uq_project_sync_state`(`connected_project_id`, `entity_type`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_operation_requests` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `capability_id` CHAR(36) NOT NULL,
    `requested_by` CHAR(36) NOT NULL,
    `operation_type` VARCHAR(80) NOT NULL,
    `idempotency_key` VARCHAR(120) NOT NULL,
    `external_target_id` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'VALIDATING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `response_external_id` VARCHAR(191) NULL,
    `failure_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    INDEX `idx_operation_project_status_created`(`connected_project_id`, `status`, `created_at`),
    UNIQUE INDEX `uq_operation_idempotency`(`connected_project_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_jobs` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `job_type` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(60) NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `attempt_count` SMALLINT NOT NULL DEFAULT 0,
    `scheduled_at` DATETIME(3) NOT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `metrics` JSON NOT NULL,
    `active_sync_key` VARCHAR(120) NULL,

    UNIQUE INDEX `integration_jobs_active_sync_key_key`(`active_sync_key`),
    INDEX `idx_integration_job_status_scheduled`(`status`, `scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_errors` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `integration_job_id` CHAR(36) NULL,
    `operation_request_id` CHAR(36) NULL,
    `error_code` VARCHAR(100) NULL,
    `message` TEXT NOT NULL,
    `is_retryable` BOOLEAN NOT NULL DEFAULT false,
    `payload_excerpt` TEXT NULL,
    `occurrence_count` INTEGER NOT NULL DEFAULT 1,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_integration_error_project_last_seen`(`connected_project_id`, `last_seen_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` CHAR(36) NOT NULL,
    `connected_project_id` CHAR(36) NOT NULL,
    `provider_event_id` VARCHAR(191) NULL,
    `event_type` VARCHAR(120) NOT NULL,
    `payload` JSON NOT NULL,
    `signature_valid` BOOLEAN NULL,
    `status` ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `payload_hash` CHAR(64) NOT NULL,

    INDEX `idx_webhook_status_received`(`status`, `received_at`),
    UNIQUE INDEX `uq_webhook_provider_event`(`connected_project_id`, `provider_event_id`),
    UNIQUE INDEX `uq_webhook_payload_hash`(`connected_project_id`, `payload_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `platform_providers` ADD CONSTRAINT `platform_providers_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `platform_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_capabilities` ADD CONSTRAINT `provider_capabilities_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `platform_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_capabilities` ADD CONSTRAINT `provider_capabilities_capability_id_fkey` FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connected_projects` ADD CONSTRAINT `connected_projects_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connected_projects` ADD CONSTRAINT `connected_projects_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `platform_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connected_projects` ADD CONSTRAINT `connected_projects_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `platform_providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connected_projects` ADD CONSTRAINT `connected_projects_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_credentials` ADD CONSTRAINT `project_credentials_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_locations` ADD CONSTRAINT `project_locations_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_locations` ADD CONSTRAINT `project_locations_company_branch_id_fkey` FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_sync_states` ADD CONSTRAINT `project_sync_states_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_operation_requests` ADD CONSTRAINT `provider_operation_requests_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_operation_requests` ADD CONSTRAINT `provider_operation_requests_capability_id_fkey` FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_operation_requests` ADD CONSTRAINT `provider_operation_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_jobs` ADD CONSTRAINT `integration_jobs_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_errors` ADD CONSTRAINT `integration_errors_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_errors` ADD CONSTRAINT `integration_errors_integration_job_id_fkey` FOREIGN KEY (`integration_job_id`) REFERENCES `integration_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_errors` ADD CONSTRAINT `integration_errors_operation_request_id_fkey` FOREIGN KEY (`operation_request_id`) REFERENCES `provider_operation_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_events` ADD CONSTRAINT `webhook_events_connected_project_id_fkey` FOREIGN KEY (`connected_project_id`) REFERENCES `connected_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
