-- Employee identity / IBAN / approval / targets / insurance / qiwa / advance allowance
ALTER TABLE `employees`
  ADD COLUMN `identity_type` ENUM('RESIDENT', 'CITIZEN') NULL,
  ADD COLUMN `identity_number` VARCHAR(40) NULL,
  ADD COLUMN `identity_expires_on` DATE NULL,
  ADD COLUMN `iban_ciphertext` BLOB NULL,
  ADD COLUMN `iban_key_version` SMALLINT NULL,
  ADD COLUMN `iban_last4` CHAR(4) NULL,
  ADD COLUMN `iban_fingerprint` CHAR(64) NULL,
  ADD COLUMN `iban_bank_name` VARCHAR(120) NULL,
  ADD COLUMN `approval_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `sales_target_mode` ENUM('PERCENT', 'AMOUNT', 'BOTH') NULL,
  ADD COLUMN `sales_target_amount` DECIMAL(18, 2) NULL,
  ADD COLUMN `late_hour_rate` DECIMAL(18, 2) NULL,
  ADD COLUMN `advance_allowance_monthly` DECIMAL(18, 2) NULL,
  ADD COLUMN `advance_allowance_month` CHAR(7) NULL,
  ADD COLUMN `insurance_attachment_id` CHAR(36) NULL,
  ADD COLUMN `qiwa_contract_url` VARCHAR(500) NULL,
  ADD COLUMN `qiwa_contract_ref` VARCHAR(120) NULL;

CREATE INDEX `idx_employee_approval` ON `employees`(`company_id`, `approval_status`);
CREATE INDEX `idx_employee_identity_expiry` ON `employees`(`company_id`, `identity_expires_on`);

-- Employee contracts: kind + external (Qiwa) refs
ALTER TABLE `employee_contracts`
  ADD COLUMN `contract_kind` ENUM('EMPLOYMENT', 'LOAN') NOT NULL DEFAULT 'EMPLOYMENT',
  ADD COLUMN `external_platform` VARCHAR(60) NULL,
  ADD COLUMN `external_ref` VARCHAR(120) NULL;

-- Device type index for tracking filters
CREATE INDEX `idx_attendance_device_type` ON `attendance_devices`(`company_id`, `device_type`);

-- Work shifts (stub)
CREATE TABLE `work_shifts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `start_time` VARCHAR(8) NOT NULL,
  `end_time` VARCHAR(8) NOT NULL,
  `break_minutes` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_work_shift_active` ON `work_shifts`(`company_id`, `is_active`);

ALTER TABLE `work_shifts`
  ADD CONSTRAINT `work_shifts_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `employee_shift_assignments` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `shift_id` CHAR(36) NOT NULL,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_employee_shift_assignment` ON `employee_shift_assignments`(`company_id`, `employee_id`);

ALTER TABLE `employee_shift_assignments`
  ADD CONSTRAINT `employee_shift_assignments_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_shift_assignments`
  ADD CONSTRAINT `employee_shift_assignments_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_shift_assignments`
  ADD CONSTRAINT `employee_shift_assignments_shift_id_fkey`
  FOREIGN KEY (`shift_id`) REFERENCES `work_shifts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Employee sales submissions
CREATE TABLE `employee_sales_submissions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `sale_date` DATE NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `payment_method` ENUM('CASH', 'CARD', 'TRANSFER', 'NETWORK') NOT NULL,
  `status` ENUM('SUBMITTED', 'PENDING_CASH_APPROVAL', 'APPROVED', 'REJECTED', 'NEEDS_RECEIPT') NOT NULL DEFAULT 'SUBMITTED',
  `receipt_attachment_id` CHAR(36) NULL,
  `approved_by` CHAR(36) NULL,
  `decided_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_employee_sales_status` ON `employee_sales_submissions`(`company_id`, `status`, `sale_date`);
CREATE INDEX `idx_employee_sales_employee` ON `employee_sales_submissions`(`employee_id`, `sale_date`);

ALTER TABLE `employee_sales_submissions`
  ADD CONSTRAINT `employee_sales_submissions_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_sales_submissions`
  ADD CONSTRAINT `employee_sales_submissions_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_sales_submissions`
  ADD CONSTRAINT `employee_sales_submissions_approved_by_fkey`
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AI bot configs (scaffold)
CREATE TABLE `ai_bot_configs` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `channel` ENUM('WHATSAPP', 'VOICE_CALL') NOT NULL,
  `status` ENUM('DISABLED', 'DRAFT', 'ACTIVE') NOT NULL DEFAULT 'DISABLED',
  `settings` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `uq_ai_bot_config_channel` ON `ai_bot_configs`(`company_id`, `channel`);
CREATE INDEX `idx_ai_bot_config_status` ON `ai_bot_configs`(`company_id`, `status`);

ALTER TABLE `ai_bot_configs`
  ADD CONSTRAINT `ai_bot_configs_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
