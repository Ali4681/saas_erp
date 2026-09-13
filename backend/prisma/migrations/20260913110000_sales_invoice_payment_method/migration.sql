-- Sales invoice tender at issue (CASH | BANK_TRANSFER | CARD | …)
-- Skip if column already exists (some envs got it via db push / manual ALTER).
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sales_invoices'
    AND COLUMN_NAME = 'payment_method'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `sales_invoices` ADD COLUMN `payment_method` VARCHAR(40) NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
