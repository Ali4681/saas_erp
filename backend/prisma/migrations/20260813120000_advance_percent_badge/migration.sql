-- Advance % of earned + biometric badge id for punch mapping
ALTER TABLE `employees`
  ADD COLUMN `advance_allowance_percent` DECIMAL(5, 2) NULL,
  ADD COLUMN `attendance_badge_id` VARCHAR(80) NULL;

CREATE INDEX `idx_employee_badge` ON `employees`(`company_id`, `attendance_badge_id`);
