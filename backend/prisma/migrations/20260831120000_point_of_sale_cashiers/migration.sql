-- Point of sale terminals + cashiers + invoice attribution
CREATE TABLE IF NOT EXISTS `points_of_sale` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `company_branch_id` CHAR(36) NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `location_note` VARCHAR(240) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_point_of_sale_code`(`company_id`, `code`),
  INDEX `idx_point_of_sale_status`(`company_id`, `status`),
  CONSTRAINT `points_of_sale_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `points_of_sale_company_branch_id_fkey` FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pos_cashiers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `point_of_sale_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `display_name` VARCHAR(140) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_pos_cashier_employee`(`point_of_sale_id`, `employee_id`),
  UNIQUE INDEX `uq_pos_cashier_user`(`point_of_sale_id`, `user_id`),
  INDEX `idx_pos_cashier_company_status`(`company_id`, `status`),
  CONSTRAINT `pos_cashiers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pos_cashiers_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pos_cashiers_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pos_cashiers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_invoices`
  ADD COLUMN `point_of_sale_id` CHAR(36) NULL,
  ADD COLUMN `pos_cashier_id` CHAR(36) NULL;

CREATE INDEX `idx_sales_invoice_pos_issued` ON `sales_invoices`(`company_id`, `point_of_sale_id`, `issued_on`);
CREATE INDEX `idx_sales_invoice_cashier_issued` ON `sales_invoices`(`company_id`, `pos_cashier_id`, `issued_on`);

ALTER TABLE `sales_invoices`
  ADD CONSTRAINT `sales_invoices_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sales_invoices_pos_cashier_id_fkey` FOREIGN KEY (`pos_cashier_id`) REFERENCES `pos_cashiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `cashier_shift_sessions`
  ADD COLUMN `point_of_sale_id` CHAR(36) NULL;

ALTER TABLE `cashier_shift_sessions`
  ADD CONSTRAINT `cashier_shift_sessions_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
