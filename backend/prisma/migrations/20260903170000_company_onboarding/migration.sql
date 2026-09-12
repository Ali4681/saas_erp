-- Company onboarding: compliance docs, service requests, fiscal year, opening balances

CREATE TABLE `company_compliance_documents` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `document_type` ENUM('COMMERCIAL_REGISTRATION', 'MUNICIPAL_LICENSE', 'CIVIL_DEFENSE', 'NATIONAL_ADDRESS', 'CHAMBER_OF_COMMERCE', 'GOSI', 'VAT_CERTIFICATE') NOT NULL,
    `document_number` VARCHAR(120) NULL,
    `issued_on` DATE NULL,
    `expires_on` DATE NULL,
    `details` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `service_requested_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_compliance_doc_company_type`(`company_id`, `document_type`),
    INDEX `idx_compliance_doc_expires`(`expires_on`),
    INDEX `idx_compliance_doc_company`(`company_id`),
    CONSTRAINT `company_compliance_documents_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_service_requests` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `step` TINYINT NOT NULL,
    `request_type` VARCHAR(80) NOT NULL,
    `note` VARCHAR(500) NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_service_request_status_created`(`status`, `created_at` DESC),
    INDEX `idx_service_request_company_status`(`company_id`, `status`),
    CONSTRAINT `company_service_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `company_service_requests_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `fiscal_years` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `starts_on` DATE NOT NULL,
    `ends_on` DATE NOT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_fiscal_year_company_current`(`company_id`, `is_current`),
    CONSTRAINT `fiscal_years_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `opening_balance_lines` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `fiscal_year_id` CHAR(36) NOT NULL,
    `account_key` VARCHAR(40) NOT NULL,
    `label` VARCHAR(140) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_opening_balance_year_key`(`fiscal_year_id`, `account_key`),
    INDEX `idx_opening_balance_company`(`company_id`),
    CONSTRAINT `opening_balance_lines_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `opening_balance_lines_fiscal_year_id_fkey` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
