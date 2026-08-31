-- Employee hire expansion: trial, shifts JSON, reward, identity photo, allowances

ALTER TABLE `employees`
  ADD COLUMN `trial_starts_on` DATE NULL,
  ADD COLUMN `trial_ends_on` DATE NULL,
  ADD COLUMN `shift_pattern_mode` VARCHAR(20) NULL,
  ADD COLUMN `shift_windows_json` JSON NULL,
  ADD COLUMN `sales_reward_amount` DECIMAL(18, 2) NULL,
  ADD COLUMN `identity_attachment_id` CHAR(36) NULL;

CREATE INDEX `idx_employee_trial_end` ON `employees` (`company_id`, `trial_ends_on`);

-- Expand employment category enum
ALTER TABLE `employees`
  MODIFY COLUMN `employment_category` ENUM('WAGE_WORKER', 'EMPLOYMENT_CONTRACT', 'TRIAL_PERIOD')
  NOT NULL DEFAULT 'EMPLOYMENT_CONTRACT';

-- Expand sales target mode enum (keep legacy values)
ALTER TABLE `employees`
  MODIFY COLUMN `sales_target_mode` ENUM(
    'PERCENT',
    'AMOUNT',
    'BOTH',
    'TARGET_FIXED',
    'TARGET_PERCENT',
    'NO_TARGET_PERCENT'
  ) NULL;

CREATE TABLE `company_allowance_types` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name_ar` VARCHAR(120) NOT NULL,
  `name_en` VARCHAR(120) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_company_allowance_type_code` (`company_id`, `code`),
  INDEX `idx_company_allowance_type_active` (`company_id`, `is_active`),
  CONSTRAINT `company_allowance_types_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `employee_allowances` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `allowance_type_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_employee_allowance_employee` (`employee_id`),
  INDEX `idx_employee_allowance_company` (`company_id`, `employee_id`),
  CONSTRAINT `employee_allowances_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `employee_allowances_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_allowances_allowance_type_id_fkey`
    FOREIGN KEY (`allowance_type_id`) REFERENCES `company_allowance_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
