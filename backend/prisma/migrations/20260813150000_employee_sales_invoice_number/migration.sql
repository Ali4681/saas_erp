-- Employee sales: require invoice number on submission
ALTER TABLE `employee_sales_submissions`
  ADD COLUMN `invoice_number` VARCHAR(80) NOT NULL DEFAULT '' AFTER `payment_method`;

CREATE INDEX `idx_employee_sales_invoice` ON `employee_sales_submissions`(`company_id`, `invoice_number`);
