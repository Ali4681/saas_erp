-- Qiwa employment contract documentation workflow (manual; no Qiwa API)
CREATE TABLE `employee_qiwa_contracts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'AWAITING_EMPLOYEE', 'DOCUMENTED', 'REJECTED_OR_MODIFICATION') NOT NULL DEFAULT 'NOT_STARTED',
  `qiwa_contract_reference` VARCHAR(120) NULL,
  `contract_attachment_id` CHAR(36) NULL,
  `started_at` DATETIME(3) NULL,
  `sent_at` DATETIME(3) NULL,
  `documented_at` DATETIME(3) NULL,
  `rejected_at` DATETIME(3) NULL,
  `verified_by_user_id` CHAR(36) NULL,
  `last_updated_by_user_id` CHAR(36) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_employee_qiwa_employee` ON `employee_qiwa_contracts`(`company_id`, `employee_id`, `updated_at`);
CREATE INDEX `idx_employee_qiwa_status` ON `employee_qiwa_contracts`(`company_id`, `status`);

ALTER TABLE `employee_qiwa_contracts`
  ADD CONSTRAINT `employee_qiwa_contracts_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_qiwa_contracts`
  ADD CONSTRAINT `employee_qiwa_contracts_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_qiwa_contracts`
  ADD CONSTRAINT `employee_qiwa_contracts_verified_by_user_id_fkey`
  FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_qiwa_contracts`
  ADD CONSTRAINT `employee_qiwa_contracts_last_updated_by_user_id_fkey`
  FOREIGN KEY (`last_updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
