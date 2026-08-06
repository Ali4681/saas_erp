-- AlterTable
ALTER TABLE `companies` ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `logo_attachment_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `leave_balance_days` DECIMAL(8, 2) NOT NULL DEFAULT 21;
