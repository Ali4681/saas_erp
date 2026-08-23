-- AlterTable
ALTER TABLE `crm_contacts` ADD COLUMN `date_of_birth` DATE NULL;

-- AlterTable
ALTER TABLE `support_tickets` ADD COLUMN `ticket_kind` VARCHAR(40) NOT NULL DEFAULT 'SUPPORT';
ALTER TABLE `support_tickets` ADD COLUMN `item_id` CHAR(36) NULL;
ALTER TABLE `support_tickets` ADD COLUMN `warranty_expires_on` DATE NULL;

-- AlterTable
ALTER TABLE `sales_invoices` ADD COLUMN `sale_channel` VARCHAR(40) NOT NULL DEFAULT 'POS';
ALTER TABLE `sales_invoices` ADD COLUMN `coupon_code` VARCHAR(80) NULL;
ALTER TABLE `sales_invoices` ADD COLUMN `price_list_id` CHAR(36) NULL;
ALTER TABLE `sales_invoices` ADD COLUMN `store_credit_applied` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `idx_sales_invoice_channel_issued` ON `sales_invoices`(`company_id`, `sale_channel`, `issued_on`);

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_price_list_id_fkey` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
