-- DropIndex
DROP INDEX `uq_employee_company_user` ON `employees`;

-- CreateIndex
CREATE INDEX `idx_employee_company_user` ON `employees`(`company_id`, `user_id`);
