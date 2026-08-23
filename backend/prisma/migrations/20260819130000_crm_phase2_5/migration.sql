-- Phase 2: Loyalty Points + Store Credit Wallet
-- Phase 3: Contract Lifecycle (extend crm_contracts)
-- Phase 4: Pricing Tiers + Coupons
-- Phase 5: Support Tickets

-- ─── Phase 3: Extend crm_contracts ──────────────────────────────────────────
ALTER TABLE `crm_contracts`
  ADD COLUMN `contract_type` VARCHAR(40) NULL,
  ADD COLUMN `auto_renew` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `renewal_alert_days` SMALLINT NOT NULL DEFAULT 30,
  ADD COLUMN `price_list_id` CHAR(36) NULL,
  ADD COLUMN `discount_pct` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `renewed_from_id` CHAR(36) NULL;

-- ─── Phase 4: Price Lists ────────────────────────────────────────────────────
CREATE TABLE `price_lists` (
  `id`          CHAR(36) NOT NULL,
  `company_id`  CHAR(36) NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `list_type`   VARCHAR(40) NOT NULL DEFAULT 'RETAIL',
  `currency`    CHAR(3) NOT NULL DEFAULT 'SAR',
  `is_default`  BOOLEAN NOT NULL DEFAULT false,
  `is_active`   BOOLEAN NOT NULL DEFAULT true,
  `notes`       TEXT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_price_list_company_name` (`company_id`, `name`),
  INDEX `idx_price_list_type` (`company_id`, `list_type`, `is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `price_list_entries` (
  `id`             CHAR(36) NOT NULL,
  `price_list_id`  CHAR(36) NOT NULL,
  `item_id`        CHAR(36) NOT NULL,
  `unit_price`     DECIMAL(18,2) NOT NULL,
  `min_qty`        DECIMAL(18,3) NOT NULL DEFAULT 1.000,
  `is_volume_break` BOOLEAN NOT NULL DEFAULT false,
  `floor_price`    DECIMAL(18,2) NULL,
  `valid_from`     DATE NULL,
  `valid_to`       DATE NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_price_list_entry_item` (`price_list_id`, `item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `coupon_codes` (
  `id`                    CHAR(36) NOT NULL,
  `company_id`            CHAR(36) NOT NULL,
  `code`                  VARCHAR(80) NOT NULL,
  `code_key`              VARCHAR(80) NOT NULL,
  `coupon_type`           VARCHAR(40) NOT NULL DEFAULT 'PERCENT',
  `discount_value`        DECIMAL(18,2) NOT NULL,
  `max_usages`            INT NULL,
  `usage_count`           INT NOT NULL DEFAULT 0,
  `max_usage_per_contact` INT NULL,
  `min_order_amount`      DECIMAL(18,2) NULL,
  `valid_from`            DATETIME(3) NULL,
  `valid_to`              DATETIME(3) NULL,
  `sale_channel`          VARCHAR(40) NULL,
  `is_active`             BOOLEAN NOT NULL DEFAULT true,
  `notes`                 TEXT NULL,
  `created_by_user_id`    CHAR(36) NULL,
  `created_at`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`            DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupon_company_code` (`company_id`, `code_key`),
  INDEX `idx_coupon_active` (`company_id`, `is_active`, `valid_to`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `coupon_usages` (
  `id`         CHAR(36) NOT NULL,
  `coupon_id`  CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `used_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_coupon_usage_coupon` (`coupon_id`, `used_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Phase 2: Loyalty Accounts ───────────────────────────────────────────────
CREATE TABLE `loyalty_accounts` (
  `id`              CHAR(36) NOT NULL,
  `company_id`      CHAR(36) NOT NULL,
  `contact_id`      CHAR(36) NOT NULL,
  `points_balance`  DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `lifetime_points` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `tier_level`      VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loyalty_accounts_contact_id_key` (`contact_id`),
  INDEX `idx_loyalty_account_tier` (`company_id`, `tier_level`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `loyalty_events` (
  `id`                  CHAR(36) NOT NULL,
  `company_id`          CHAR(36) NOT NULL,
  `loyalty_account_id`  CHAR(36) NOT NULL,
  `event_type`          VARCHAR(40) NOT NULL,
  `direction`           VARCHAR(10) NOT NULL,
  `points`              DECIMAL(18,2) NOT NULL,
  `source_id`           CHAR(36) NULL,
  `source_type`         VARCHAR(40) NULL,
  `note`                VARCHAR(240) NULL,
  `created_by_user_id`  CHAR(36) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_loyalty_event_account` (`loyalty_account_id`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_store_credits` (
  `id`          CHAR(36) NOT NULL,
  `company_id`  CHAR(36) NOT NULL,
  `contact_id`  CHAR(36) NOT NULL,
  `balance`     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `currency`    CHAR(3) NOT NULL DEFAULT 'SAR',
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_store_credits_contact_id_key` (`contact_id`),
  INDEX `idx_store_credit_company` (`company_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `store_credit_events` (
  `id`                  CHAR(36) NOT NULL,
  `company_id`          CHAR(36) NOT NULL,
  `store_credit_id`     CHAR(36) NOT NULL,
  `direction`           VARCHAR(10) NOT NULL,
  `amount`              DECIMAL(18,2) NOT NULL,
  `source_id`           CHAR(36) NULL,
  `source_type`         VARCHAR(40) NULL,
  `note`                VARCHAR(240) NULL,
  `created_by_user_id`  CHAR(36) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_store_credit_event_account` (`store_credit_id`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Phase 5: Support Tickets ────────────────────────────────────────────────
CREATE TABLE `support_tickets` (
  `id`                  CHAR(36) NOT NULL,
  `company_id`          CHAR(36) NOT NULL,
  `contact_id`          CHAR(36) NOT NULL,
  `ticket_number`       VARCHAR(60) NOT NULL,
  `subject`             VARCHAR(220) NOT NULL,
  `status`              VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  `priority`            VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  `assigned_to`         CHAR(36) NULL,
  `invoice_id`          CHAR(36) NULL,
  `contract_id`         CHAR(36) NULL,
  `sla_deadline`        DATETIME(3) NULL,
  `resolved_at`         DATETIME(3) NULL,
  `closed_at`           DATETIME(3) NULL,
  `description`         TEXT NULL,
  `resolution`          TEXT NULL,
  `created_by_user_id`  CHAR(36) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_ticket_number` (`company_id`, `ticket_number`),
  INDEX `idx_ticket_status_priority` (`company_id`, `status`, `priority`),
  INDEX `idx_ticket_contact` (`company_id`, `contact_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_comments` (
  `id`                  CHAR(36) NOT NULL,
  `ticket_id`           CHAR(36) NOT NULL,
  `body`                TEXT NOT NULL,
  `is_internal`         BOOLEAN NOT NULL DEFAULT false,
  `created_by_user_id`  CHAR(36) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_ticket_comment_ticket` (`ticket_id`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Foreign Keys: price_lists ───────────────────────────────────────────────
ALTER TABLE `price_lists`
  ADD CONSTRAINT `price_lists_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `price_list_entries`
  ADD CONSTRAINT `price_list_entries_price_list_id_fkey` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `price_list_entries_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `coupon_codes`
  ADD CONSTRAINT `coupon_codes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `coupon_usages`
  ADD CONSTRAINT `coupon_usages_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupon_codes` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Foreign Keys: crm_contracts extensions ──────────────────────────────────
ALTER TABLE `crm_contracts`
  ADD CONSTRAINT `crm_contracts_price_list_id_fkey` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `crm_contracts_renewed_from_id_fkey` FOREIGN KEY (`renewed_from_id`) REFERENCES `crm_contracts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Foreign Keys: loyalty ───────────────────────────────────────────────────
ALTER TABLE `loyalty_accounts`
  ADD CONSTRAINT `loyalty_accounts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `loyalty_accounts_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `loyalty_events`
  ADD CONSTRAINT `loyalty_events_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `loyalty_events_loyalty_account_id_fkey` FOREIGN KEY (`loyalty_account_id`) REFERENCES `loyalty_accounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `customer_store_credits`
  ADD CONSTRAINT `customer_store_credits_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_store_credits_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `store_credit_events`
  ADD CONSTRAINT `store_credit_events_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `store_credit_events_store_credit_id_fkey` FOREIGN KEY (`store_credit_id`) REFERENCES `customer_store_credits` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Foreign Keys: support_tickets ───────────────────────────────────────────
ALTER TABLE `support_tickets`
  ADD CONSTRAINT `support_tickets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `support_tickets_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `crm_contacts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `support_tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `support_tickets_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ticket_comments`
  ADD CONSTRAINT `ticket_comments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ticket_comments_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── CompanyAccountMapping: add store credit + loyalty columns ────────────────
ALTER TABLE `company_account_mappings`
  ADD COLUMN `customer_store_credit_code` VARCHAR(20) NOT NULL DEFAULT '214100',
  ADD COLUMN `loyalty_liability_code` VARCHAR(20) NOT NULL DEFAULT '214200';
