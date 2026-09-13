-- POS fields added to Prisma schema after points_of_sale / pos_cashiers were created.
-- Idempotent: safe if columns / table already exist.

-- points_of_sale.template_code
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'points_of_sale'
    AND COLUMN_NAME = 'template_code'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `points_of_sale` ADD COLUMN `template_code` VARCHAR(40) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- points_of_sale.layout_json
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'points_of_sale'
    AND COLUMN_NAME = 'layout_json'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `points_of_sale` ADD COLUMN `layout_json` JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pos_cashiers.permissions_json
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pos_cashiers'
    AND COLUMN_NAME = 'permissions_json'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `pos_cashiers` ADD COLUMN `permissions_json` JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pos_audit_events (never shipped in an earlier migration)
CREATE TABLE IF NOT EXISTS `pos_audit_events` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `point_of_sale_id` CHAR(36) NULL,
  `pos_cashier_id` CHAR(36) NULL,
  `user_id` CHAR(36) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `payload_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_pos_audit_company_created`(`company_id`, `created_at`),
  CONSTRAINT `pos_audit_events_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pos_audit_events_point_of_sale_id_fkey` FOREIGN KEY (`point_of_sale_id`) REFERENCES `points_of_sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pos_audit_events_pos_cashier_id_fkey` FOREIGN KEY (`pos_cashier_id`) REFERENCES `pos_cashiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pos_audit_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
