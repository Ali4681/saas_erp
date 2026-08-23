-- Governance & operations foundation (business hours, industry packs, SoD,
-- thresholds, period locks, break-glass, journals, cashier shifts)
-- See docs/GOVERNANCE_OPERATIONS_ARCHITECTURE.md

-- Role hierarchy + financial mapping
ALTER TABLE `roles`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `company_id` CHAR(36) NULL,
  ADD COLUMN `parent_role_id` CHAR(36) NULL,
  ADD COLUMN `financial_profile` ENUM(
    'NONE',
    'CASHIER',
    'SALES_DELIVERY',
    'MANAGER_SUPERVISOR',
    'WAREHOUSE_KEEPER',
    'ACCOUNTANT',
    'TREASURY_CUSTODIAN',
    'BRANCH_MANAGER',
    'SYSTEM_ADMIN'
  ) NOT NULL DEFAULT 'NONE';

CREATE INDEX `idx_role_company` ON `roles`(`company_id`, `is_system`);
CREATE INDEX `idx_role_parent` ON `roles`(`parent_role_id`);

ALTER TABLE `roles`
  ADD CONSTRAINT `roles_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `roles_parent_role_id_fkey`
    FOREIGN KEY (`parent_role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit trail hardening columns
ALTER TABLE `audit_logs`
  ADD COLUMN `device_fingerprint` VARCHAR(128) NULL,
  ADD COLUMN `request_id` VARCHAR(64) NULL,
  ADD COLUMN `break_glass_session_id` CHAR(36) NULL,
  ADD COLUMN `before_data` JSON NULL,
  ADD COLUMN `after_data` JSON NULL;

-- Work shifts: link to business-hours profile
ALTER TABLE `work_shifts`
  ADD COLUMN `business_hours_profile_id` CHAR(36) NULL,
  ADD COLUMN `sequence_index` INT NOT NULL DEFAULT 0,
  ADD COLUMN `crosses_midnight` BOOLEAN NOT NULL DEFAULT false;

-- Business hours
CREATE TABLE `company_business_hours_profiles` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `mode` ENUM('HOURS_24', 'HOURS_12', 'DYNAMIC') NOT NULL DEFAULT 'HOURS_12',
  `default_start_time` VARCHAR(8) NOT NULL DEFAULT '09:00',
  `default_end_time` VARCHAR(8) NOT NULL DEFAULT '21:00',
  `auto_split_shifts` BOOLEAN NOT NULL DEFAULT true,
  `auto_shift_hours` SMALLINT NOT NULL DEFAULT 8,
  `twelve_hour_mode` ENUM('FIXED', 'TWO_PERIODS') NOT NULL DEFAULT 'FIXED',
  `period2_start_time` VARCHAR(8) NULL,
  `period2_end_time` VARCHAR(8) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `company_business_hours_profiles_company_id_key`(`company_id`),
  CONSTRAINT `company_business_hours_profiles_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dynamic_hours_windows` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `label` VARCHAR(120) NULL,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_dynamic_hours_company_start`(`company_id`, `starts_at`),
  CONSTRAINT `dynamic_hours_windows_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `dynamic_hours_windows_profile_id_fkey`
    FOREIGN KEY (`profile_id`) REFERENCES `company_business_hours_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `work_shifts`
  ADD CONSTRAINT `work_shifts_business_hours_profile_id_fkey`
    FOREIGN KEY (`business_hours_profile_id`) REFERENCES `company_business_hours_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Industry packs
CREATE TABLE `industry_activities` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name_en` VARCHAR(160) NOT NULL,
  `name_ar` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `industry_activities_code_key`(`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `industry_pack_role_templates` (
  `id` CHAR(36) NOT NULL,
  `industry_activity_id` CHAR(36) NOT NULL,
  `role_code` VARCHAR(50) NOT NULL,
  `role_name_en` VARCHAR(120) NOT NULL,
  `role_name_ar` VARCHAR(120) NOT NULL,
  `financial_profile` ENUM(
    'NONE', 'CASHIER', 'SALES_DELIVERY', 'MANAGER_SUPERVISOR', 'WAREHOUSE_KEEPER',
    'ACCOUNTANT', 'TREASURY_CUSTODIAN', 'BRANCH_MANAGER', 'SYSTEM_ADMIN'
  ) NOT NULL DEFAULT 'NONE',
  `permission_codes` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_industry_pack_role`(`industry_activity_id`, `role_code`),
  CONSTRAINT `industry_pack_role_templates_industry_activity_id_fkey`
    FOREIGN KEY (`industry_activity_id`) REFERENCES `industry_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `industry_pack_category_templates` (
  `id` CHAR(36) NOT NULL,
  `industry_activity_id` CHAR(36) NOT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name_en` VARCHAR(160) NOT NULL,
  `name_ar` VARCHAR(160) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_industry_pack_category`(`industry_activity_id`, `kind`, `code`),
  CONSTRAINT `industry_pack_category_templates_industry_activity_id_fkey`
    FOREIGN KEY (`industry_activity_id`) REFERENCES `industry_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_industry_activations` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `industry_activity_id` CHAR(36) NOT NULL,
  `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_by_user_id` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_company_industry`(`company_id`, `industry_activity_id`),
  CONSTRAINT `company_industry_activations_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `company_industry_activations_industry_activity_id_fkey`
    FOREIGN KEY (`industry_activity_id`) REFERENCES `industry_activities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `company_industry_activations_applied_by_user_id_fkey`
    FOREIGN KEY (`applied_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SoD / thresholds / period lock / break-glass
CREATE TABLE `sod_conflict_rules` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NULL,
  `permission_code_a` VARCHAR(100) NOT NULL,
  `permission_code_b` VARCHAR(100) NOT NULL,
  `label` VARCHAR(180) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_sod_pair`(`company_id`, `permission_code_a`, `permission_code_b`),
  INDEX `idx_sod_company_active`(`company_id`, `is_active`),
  CONSTRAINT `sod_conflict_rules_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `approval_thresholds` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `action_type` ENUM(
    'PETTY_CASH', 'DISCOUNT', 'EXPENSE', 'SALARY_ADVANCE',
    'PURCHASE_ORDER', 'CREDIT_NOTE', 'SHIFT_VARIANCE'
  ) NOT NULL,
  `max_amount` DECIMAL(18, 2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `required_permission` VARCHAR(100) NOT NULL,
  `escalate_permission` VARCHAR(100) NULL,
  `branch_id` CHAR(36) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_approval_threshold_action`(`company_id`, `action_type`, `is_active`),
  CONSTRAINT `approval_thresholds_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `approval_thresholds_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `financial_period_locks` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `locked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `locked_by_user_id` CHAR(36) NOT NULL,
  `backdate_until` DATETIME(3) NULL,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_period_lock_range`(`company_id`, `period_start`, `period_end`),
  INDEX `idx_period_lock_range`(`company_id`, `period_start`, `period_end`),
  CONSTRAINT `financial_period_locks_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `financial_period_locks_locked_by_user_id_fkey`
    FOREIGN KEY (`locked_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `break_glass_sessions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `starts_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ends_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `revoked_by_user_id` CHAR(36) NULL,
  `alerted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_break_glass_active`(`company_id`, `status`, `ends_at`),
  CONSTRAINT `break_glass_sessions_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `break_glass_sessions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `break_glass_sessions_revoked_by_user_id_fkey`
    FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Clearing accounts + journals
CREATE TABLE `clearing_accounts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_clearing_account_code`(`company_id`, `code`),
  CONSTRAINT `clearing_accounts_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cashier_shift_sessions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NULL,
  `employee_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `work_shift_id` CHAR(36) NULL,
  `status` ENUM('OPEN', 'CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'VOID') NOT NULL DEFAULT 'OPEN',
  `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closed_at` DATETIME(3) NULL,
  `opening_float` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `cash_sales` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `card_sales` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `transfer_sales` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `petty_expenses` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `expected_cash` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `counted_cash` DECIMAL(18, 2) NULL,
  `variance` DECIMAL(18, 2) NULL,
  `currency` CHAR(3) NOT NULL,
  `z_report_number` VARCHAR(40) NULL,
  `approved_by_user_id` CHAR(36) NULL,
  `approved_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_cashier_shift_status`(`company_id`, `status`, `opened_at`),
  INDEX `idx_cashier_shift_employee`(`company_id`, `employee_id`, `opened_at`),
  CONSTRAINT `cashier_shift_sessions_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_sessions_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_sessions_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_sessions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_sessions_work_shift_id_fkey`
    FOREIGN KEY (`work_shift_id`) REFERENCES `work_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_sessions_approved_by_user_id_fkey`
    FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `journal_entries` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `entry_type` ENUM('Z_REPORT', 'HANDOVER', 'DISCREPANCY', 'MANUAL', 'PERIOD_CLOSE') NOT NULL,
  `status` ENUM('DRAFT', 'POSTED', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `entry_date` DATE NOT NULL,
  `memo` VARCHAR(255) NULL,
  `currency` CHAR(3) NOT NULL,
  `cashier_shift_session_id` CHAR(36) NULL,
  `created_by_user_id` CHAR(36) NOT NULL,
  `posted_at` DATETIME(3) NULL,
  `posted_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_journal_company_date`(`company_id`, `entry_date`, `entry_type`),
  CONSTRAINT `journal_entries_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `journal_entries_cashier_shift_session_id_fkey`
    FOREIGN KEY (`cashier_shift_session_id`) REFERENCES `cashier_shift_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `journal_entries_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `journal_entries_posted_by_user_id_fkey`
    FOREIGN KEY (`posted_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `journal_lines` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `journal_entry_id` CHAR(36) NOT NULL,
  `clearing_account_id` CHAR(36) NOT NULL,
  `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `memo` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_journal_line_entry`(`journal_entry_id`),
  CONSTRAINT `journal_lines_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `journal_lines_journal_entry_id_fkey`
    FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `journal_lines_clearing_account_id_fkey`
    FOREIGN KEY (`clearing_account_id`) REFERENCES `clearing_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cashier_shift_handovers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `from_session_id` CHAR(36) NOT NULL,
  `to_session_id` CHAR(36) NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `target` VARCHAR(40) NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_by_user_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_cashier_handover_company`(`company_id`, `created_at`),
  CONSTRAINT `cashier_shift_handovers_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_handovers_from_session_id_fkey`
    FOREIGN KEY (`from_session_id`) REFERENCES `cashier_shift_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_handovers_to_session_id_fkey`
    FOREIGN KEY (`to_session_id`) REFERENCES `cashier_shift_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cashier_shift_handovers_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed platform SoD defaults (purchasing write vs finance)
INSERT INTO `sod_conflict_rules` (`id`, `company_id`, `permission_code_a`, `permission_code_b`, `label`, `is_active`, `created_at`)
VALUES
  ('019f0000-0000-7000-8000-000000000001', NULL, 'purchasing.write', 'finance.write', 'SoD: purchasing vs finance payment', true, CURRENT_TIMESTAMP(3)),
  ('019f0000-0000-7000-8000-000000000002', NULL, 'purchasing.write', 'sales.write', 'SoD: purchasing vs sales (soft default)', true, CURRENT_TIMESTAMP(3));
