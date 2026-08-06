-- AlterTable
ALTER TABLE `sales_invoices`
  ADD COLUMN `company_branch_id` CHAR(36) NULL,
  ADD COLUMN `created_by` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `idx_sales_invoice_branch_issued` ON `sales_invoices`(`company_id`, `company_branch_id`, `issued_on`);

-- CreateIndex
CREATE INDEX `idx_sales_invoice_creator_issued` ON `sales_invoices`(`company_id`, `created_by`, `issued_on`);

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_company_branch_id_fkey` FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
