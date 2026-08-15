-- Link employee sales submissions to existing sales invoices
ALTER TABLE `employee_sales_submissions`
  ADD COLUMN `sales_invoice_id` CHAR(36) NULL AFTER `invoice_number`;

CREATE INDEX `idx_employee_sales_invoice_id` ON `employee_sales_submissions`(`sales_invoice_id`);

ALTER TABLE `employee_sales_submissions`
  ADD CONSTRAINT `employee_sales_submissions_sales_invoice_id_fkey`
  FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
