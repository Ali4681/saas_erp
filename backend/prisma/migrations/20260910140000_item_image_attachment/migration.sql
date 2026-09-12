-- Duplicate of 20260908140000_item_image_attachment.
-- MariaDB 10.4 rejects: ADD COLUMN IF NOT EXISTS with quoted identifiers.
-- Keep as idempotent no-op when the column already exists.

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME = 'image_attachment_id'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `items` ADD COLUMN `image_attachment_id` CHAR(36) NULL',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
