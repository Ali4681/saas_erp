-- DropForeignKey
ALTER TABLE `ai_usage_logs` DROP FOREIGN KEY `ai_usage_logs_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `api_request_logs` DROP FOREIGN KEY `api_request_logs_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `automation_runs` DROP FOREIGN KEY `automation_runs_automation_rule_id_fkey`;

-- DropForeignKey
ALTER TABLE `business_note_revisions` DROP FOREIGN KEY `business_note_revisions_note_id_fkey`;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `external_orders` DROP FOREIGN KEY `external_orders_connected_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `external_settlements` DROP FOREIGN KEY `external_settlements_connected_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `financial_transactions` DROP FOREIGN KEY `financial_transactions_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `financial_transactions` DROP FOREIGN KEY `financial_transactions_connected_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `integration_errors` DROP FOREIGN KEY `integration_errors_connected_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `message_deliveries` DROP FOREIGN KEY `message_deliveries_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `webhook_deliveries` DROP FOREIGN KEY `webhook_deliveries_company_webhook_id_fkey`;

-- DropIndex
DROP INDEX `idx_ai_usage_company_created` ON `ai_usage_logs`;

-- DropIndex
DROP INDEX `idx_api_request_log_created` ON `api_request_logs`;

-- DropIndex
DROP INDEX `idx_audit_company_created` ON `audit_logs`;

-- DropIndex
DROP INDEX `idx_automation_run_started` ON `automation_runs`;

-- DropIndex
DROP INDEX `idx_business_note_revision_created` ON `business_note_revisions`;

-- DropIndex
DROP INDEX `idx_probe_audit_company_created` ON `convention_probe_audit_logs`;

-- DropIndex
DROP INDEX `idx_expense_company_date_status` ON `expenses`;

-- DropIndex
DROP INDEX `idx_external_order_placed` ON `external_orders`;

-- DropIndex
DROP INDEX `idx_external_settlement_status_period` ON `external_settlements`;

-- DropIndex
DROP INDEX `idx_finance_tx_company_occurred_type` ON `financial_transactions`;

-- DropIndex
DROP INDEX `idx_finance_tx_project_occurred` ON `financial_transactions`;

-- DropIndex
DROP INDEX `idx_integration_error_project_last_seen` ON `integration_errors`;

-- DropIndex
DROP INDEX `idx_message_delivery_created` ON `message_deliveries`;

-- DropIndex
DROP INDEX `idx_notification_user_read` ON `notifications`;

-- DropIndex
DROP INDEX `idx_webhook_delivery_created` ON `webhook_deliveries`;

-- AlterTable
ALTER TABLE `companies` ALTER COLUMN `business_category` DROP DEFAULT;

-- AlterTable
ALTER TABLE `company_account_mappings` ADD COLUMN `sales_ar_international_code` VARCHAR(20) NOT NULL DEFAULT '112200',
    ADD COLUMN `sales_ar_local_code` VARCHAR(20) NOT NULL DEFAULT '112100';

-- AlterTable
ALTER TABLE `crm_contacts` ADD COLUMN `company_reg_number` VARCHAR(80) NULL,
    ADD COLUMN `credit_limit` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `credit_terms_days` SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN `customer_track` ENUM('B2C', 'B2B') NOT NULL DEFAULT 'B2C',
    ADD COLUMN `tax_number` VARCHAR(80) NULL;

-- AlterTable
ALTER TABLE `employee_sales_submissions` ALTER COLUMN `invoice_number` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `idx_ai_usage_company_created` ON `ai_usage_logs`(`company_id`, `created_at` DESC, `module`);

-- CreateIndex
CREATE INDEX `idx_api_request_log_created` ON `api_request_logs`(`company_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `idx_audit_company_created` ON `audit_logs`(`company_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `idx_automation_run_started` ON `automation_runs`(`automation_rule_id`, `started_at` DESC);

-- CreateIndex
CREATE INDEX `idx_business_note_revision_created` ON `business_note_revisions`(`note_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `idx_probe_audit_company_created` ON `convention_probe_audit_logs`(`company_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `idx_crm_contact_track_status` ON `crm_contacts`(`company_id`, `customer_track`, `status`);

-- CreateIndex
CREATE INDEX `idx_expense_company_date_status` ON `expenses`(`company_id`, `expense_date` DESC, `status`);

-- CreateIndex
CREATE INDEX `idx_external_order_placed` ON `external_orders`(`connected_project_id`, `placed_at` DESC);

-- CreateIndex
CREATE INDEX `idx_external_settlement_status_period` ON `external_settlements`(`connected_project_id`, `status`, `period_end` DESC);

-- CreateIndex
CREATE INDEX `idx_finance_tx_company_occurred_type` ON `financial_transactions`(`company_id`, `occurred_at` DESC, `transaction_type`);

-- CreateIndex
CREATE INDEX `idx_finance_tx_project_occurred` ON `financial_transactions`(`connected_project_id`, `occurred_at` DESC);

-- CreateIndex
CREATE INDEX `idx_integration_error_project_last_seen` ON `integration_errors`(`connected_project_id`, `last_seen_at` DESC);

-- CreateIndex
CREATE INDEX `idx_message_delivery_created` ON `message_deliveries`(`company_id`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `idx_notification_user_read` ON `notifications`(`user_id`, `read_at`, `created_at` DESC);

-- CreateIndex
CREATE INDEX `idx_webhook_delivery_created` ON `webhook_deliveries`(`company_webhook_id`, `created_at` DESC);

-- AddForeignKey (only re-add FKs dropped at the top of this migration)
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: Do not re-add FKs already created by earlier migrations
-- (purchase_requisitions, goods_receipt_items, work_shifts, company_users, etc.).
-- Prisma drift dumps caused errno 121 "Duplicate key on write or update".
