-- AlterTable employees
ALTER TABLE `employees`
  ADD COLUMN `target_percent` DECIMAL(5, 2) NULL,
  ADD COLUMN `absence_discount_per_day` DECIMAL(18, 2) NULL,
  ADD COLUMN `late_discount_amount` DECIMAL(18, 2) NULL,
  ADD COLUMN `is_purchase_operator` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable items
ALTER TABLE `items`
  ADD COLUMN `parent_item_id` CHAR(36) NULL;

CREATE INDEX `idx_item_parent` ON `items`(`company_id`, `parent_item_id`);

ALTER TABLE `items`
  ADD CONSTRAINT `items_parent_item_id_fkey`
  FOREIGN KEY (`parent_item_id`) REFERENCES `items`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable employee_contracts
CREATE TABLE `employee_contracts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `contract_number` VARCHAR(80) NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `starts_on` DATE NULL,
  `ends_on` DATE NULL,
  `base_salary` DECIMAL(18, 2) NULL,
  `target_percent` DECIMAL(5, 2) NULL,
  `notes` TEXT NULL,
  `submitted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_employee_contract_status` ON `employee_contracts`(`company_id`, `employee_id`, `status`);

ALTER TABLE `employee_contracts`
  ADD CONSTRAINT `employee_contracts_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_contracts`
  ADD CONSTRAINT `employee_contracts_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable salary_advances
CREATE TABLE `salary_advances` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `reason` TEXT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decided_at` DATETIME(3) NULL,
  `decided_by` CHAR(36) NULL,
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_salary_advance_status` ON `salary_advances`(`company_id`, `status`, `requested_at`);
CREATE INDEX `idx_salary_advance_employee` ON `salary_advances`(`employee_id`, `status`);

ALTER TABLE `salary_advances`
  ADD CONSTRAINT `salary_advances_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `salary_advances`
  ADD CONSTRAINT `salary_advances_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `salary_advances`
  ADD CONSTRAINT `salary_advances_decided_by_fkey`
  FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable employee_ewallets
CREATE TABLE `employee_ewallets` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `wallet_code` VARCHAR(40) NOT NULL,
  `balance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL,
  `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `employee_ewallets_employee_id_key` ON `employee_ewallets`(`employee_id`);
CREATE UNIQUE INDEX `uq_employee_ewallet_code` ON `employee_ewallets`(`company_id`, `wallet_code`);
CREATE INDEX `idx_employee_ewallet_status` ON `employee_ewallets`(`company_id`, `status`);

ALTER TABLE `employee_ewallets`
  ADD CONSTRAINT `employee_ewallets_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_ewallets`
  ADD CONSTRAINT `employee_ewallets_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable attendance_devices
CREATE TABLE `attendance_devices` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `device_type` ENUM('CAMERA', 'BIOMETRIC', 'BOTH') NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `location` VARCHAR(180) NULL,
  `device_key` VARCHAR(80) NOT NULL,
  `stream_url` VARCHAR(500) NULL,
  `last_seen_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `uq_attendance_device_key` ON `attendance_devices`(`company_id`, `device_key`);
CREATE INDEX `idx_attendance_device_status` ON `attendance_devices`(`company_id`, `status`);

ALTER TABLE `attendance_devices`
  ADD CONSTRAINT `attendance_devices_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable attendance_device_events
CREATE TABLE `attendance_device_events` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `device_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NULL,
  `external_ref` VARCHAR(120) NULL,
  `event_type` VARCHAR(40) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `payload` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_attendance_device_event_time` ON `attendance_device_events`(`company_id`, `occurred_at`);
CREATE INDEX `idx_attendance_device_event_device` ON `attendance_device_events`(`device_id`, `occurred_at`);

ALTER TABLE `attendance_device_events`
  ADD CONSTRAINT `attendance_device_events_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `attendance_device_events`
  ADD CONSTRAINT `attendance_device_events_device_id_fkey`
  FOREIGN KEY (`device_id`) REFERENCES `attendance_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable daily_cash_closings
CREATE TABLE `daily_cash_closings` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `company_branch_id` CHAR(36) NULL,
  `branch_key` CHAR(36) NOT NULL DEFAULT '',
  `closing_date` DATE NOT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `opening_cash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `cash_sales` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `cash_expenses` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `expected_cash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `counted_cash` DECIMAL(18, 2) NULL,
  `variance` DECIMAL(18, 2) NULL,
  `currency` CHAR(3) NOT NULL,
  `notes` TEXT NULL,
  `closed_by` CHAR(36) NULL,
  `closed_at` DATETIME(3) NULL,
  `created_by` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `uq_daily_closing_branch_date` ON `daily_cash_closings`(`company_id`, `closing_date`, `branch_key`);
CREATE INDEX `idx_daily_closing_date_status` ON `daily_cash_closings`(`company_id`, `closing_date`, `status`);

ALTER TABLE `daily_cash_closings`
  ADD CONSTRAINT `daily_cash_closings_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `daily_cash_closings`
  ADD CONSTRAINT `daily_cash_closings_company_branch_id_fkey`
  FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `daily_cash_closings`
  ADD CONSTRAINT `daily_cash_closings_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `daily_cash_closings`
  ADD CONSTRAINT `daily_cash_closings_closed_by_fkey`
  FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
