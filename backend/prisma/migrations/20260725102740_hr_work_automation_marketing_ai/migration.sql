-- CreateTable
CREATE TABLE `employees` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `user_key` CHAR(36) NOT NULL DEFAULT '',
    `company_branch_id` CHAR(36) NULL,
    `company_department_id` CHAR(36) NULL,
    `employee_number` VARCHAR(40) NOT NULL,
    `full_name` VARCHAR(180) NOT NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `job_title` VARCHAR(120) NULL,
    `hire_date` DATE NULL,
    `employment_status` ENUM('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
    `basic_salary` DECIMAL(18, 2) NULL,
    `currency` CHAR(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_employee_status`(`company_id`, `employment_status`),
    UNIQUE INDEX `uq_employee_number`(`company_id`, `employee_number`),
    UNIQUE INDEX `uq_employee_company_user`(`company_id`, `user_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_id` CHAR(36) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `check_in_at` DATETIME(3) NULL,
    `check_out_at` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY', 'REMOTE') NOT NULL,
    `worked_minutes` INTEGER NULL,
    `source` VARCHAR(40) NULL,
    `notes` TEXT NULL,

    INDEX `idx_attendance_company_date`(`company_id`, `attendance_date`),
    UNIQUE INDEX `uq_attendance_employee_date`(`employee_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_id` CHAR(36) NOT NULL,
    `leave_type` VARCHAR(60) NOT NULL,
    `starts_on` DATE NOT NULL,
    `ends_on` DATE NOT NULL,
    `requested_days` DECIMAL(6, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `approved_by` CHAR(36) NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_leave_company_status_start`(`company_id`, `status`, `starts_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_runs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `status` ENUM('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `total_gross` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_deductions` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_net` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `processed_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_payroll_run_period`(`company_id`, `period_start`, `period_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_items` (
    `id` CHAR(36) NOT NULL,
    `payroll_run_id` CHAR(36) NOT NULL,
    `employee_id` CHAR(36) NOT NULL,
    `basic_salary` DECIMAL(18, 2) NOT NULL,
    `allowances` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bonuses` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `deductions` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `advances` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `net_amount` DECIMAL(18, 2) NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'PAID', 'HELD') NOT NULL DEFAULT 'DRAFT',

    UNIQUE INDEX `uq_payroll_item_run_employee`(`payroll_run_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_rules` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `module` VARCHAR(60) NOT NULL,
    `trigger_event` VARCHAR(100) NOT NULL,
    `conditions` JSON NOT NULL,
    `actions` JSON NOT NULL,
    `schedule_cron` VARCHAR(120) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'DRAFT',
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_automation_company_status_module`(`company_id`, `status`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_runs` (
    `id` CHAR(36) NOT NULL,
    `automation_rule_id` CHAR(36) NOT NULL,
    `status` ENUM('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'RUNNING',
    `trigger_entity_type` VARCHAR(80) NULL,
    `trigger_entity_id` CHAR(36) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `result` JSON NOT NULL,
    `error_message` TEXT NULL,

    INDEX `idx_automation_run_started`(`automation_rule_id`, `started_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketing_posts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `title` VARCHAR(180) NULL,
    `content` TEXT NOT NULL,
    `channel` ENUM('INTERNAL_DRAFT', 'FACEBOOK', 'INSTAGRAM', 'X', 'LINKEDIN', 'TIKTOK', 'OTHER') NOT NULL,
    `status` ENUM('DRAFT', 'READY', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `scheduled_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `external_post_id` VARCHAR(191) NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_marketing_post_status_scheduled`(`company_id`, `status`, `scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `uploaded_by` CHAR(36) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` CHAR(36) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `checksum_sha256` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attachments_storage_key_key`(`storage_key`),
    INDEX `idx_attachment_entity`(`company_id`, `entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `module` VARCHAR(60) NOT NULL,
    `provider` VARCHAR(60) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `estimated_cost` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `request_reference` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ai_usage_company_created`(`company_id`, `created_at` DESC, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_projects` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `crm_contact_id` CHAR(36) NULL,
    `status` ENUM('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `starts_on` DATE NULL,
    `ends_on` DATE NULL,
    `budget` DECIMAL(18, 2) NULL,
    `currency` CHAR(3) NULL,
    `owner_user_id` CHAR(36) NULL,
    `progress_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_work_project_status`(`company_id`, `status`),
    UNIQUE INDEX `uq_work_project_code`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_project_members` (
    `work_project_id` CHAR(36) NOT NULL,
    `company_user_id` CHAR(36) NOT NULL,
    `project_role` VARCHAR(80) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`work_project_id`, `company_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_project_phases` (
    `id` CHAR(36) NOT NULL,
    `work_project_id` CHAR(36) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `position` SMALLINT NOT NULL,
    `status` ENUM('NOT_STARTED', 'ACTIVE', 'COMPLETED', 'BLOCKED') NOT NULL DEFAULT 'NOT_STARTED',
    `starts_on` DATE NULL,
    `ends_on` DATE NULL,
    `progress_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `uq_work_phase_position`(`work_project_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_tasks` (
    `id` CHAR(36) NOT NULL,
    `work_project_id` CHAR(36) NOT NULL,
    `work_project_phase_id` CHAR(36) NULL,
    `assignee_company_user_id` CHAR(36) NULL,
    `parent_task_id` CHAR(36) NULL,
    `title` VARCHAR(220) NOT NULL,
    `description` TEXT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `due_at` DATETIME(3) NULL,
    `estimated_hours` DECIMAL(8, 2) NULL,
    `actual_hours` DECIMAL(8, 2) NULL,
    `progress_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_work_task_status_due`(`work_project_id`, `status`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_task_comments` (
    `id` CHAR(36) NOT NULL,
    `work_task_id` CHAR(36) NOT NULL,
    `author_user_id` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `edited_at` DATETIME(3) NULL,

    INDEX `idx_work_task_comment_created`(`work_task_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_branch_id_fkey` FOREIGN KEY (`company_branch_id`) REFERENCES `company_branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_department_id_fkey` FOREIGN KEY (`company_department_id`) REFERENCES `company_departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_payroll_run_id_fkey` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_rules` ADD CONSTRAINT `automation_rules_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_rules` ADD CONSTRAINT `automation_rules_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_runs` ADD CONSTRAINT `automation_runs_automation_rule_id_fkey` FOREIGN KEY (`automation_rule_id`) REFERENCES `automation_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_posts` ADD CONSTRAINT `marketing_posts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketing_posts` ADD CONSTRAINT `marketing_posts_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_logs` ADD CONSTRAINT `ai_usage_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_logs` ADD CONSTRAINT `ai_usage_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_projects` ADD CONSTRAINT `work_projects_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_projects` ADD CONSTRAINT `work_projects_crm_contact_id_fkey` FOREIGN KEY (`crm_contact_id`) REFERENCES `crm_contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_projects` ADD CONSTRAINT `work_projects_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_project_members` ADD CONSTRAINT `work_project_members_work_project_id_fkey` FOREIGN KEY (`work_project_id`) REFERENCES `work_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_project_members` ADD CONSTRAINT `work_project_members_company_user_id_fkey` FOREIGN KEY (`company_user_id`) REFERENCES `company_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_project_phases` ADD CONSTRAINT `work_project_phases_work_project_id_fkey` FOREIGN KEY (`work_project_id`) REFERENCES `work_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_tasks` ADD CONSTRAINT `work_tasks_work_project_id_fkey` FOREIGN KEY (`work_project_id`) REFERENCES `work_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_tasks` ADD CONSTRAINT `work_tasks_work_project_phase_id_fkey` FOREIGN KEY (`work_project_phase_id`) REFERENCES `work_project_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_tasks` ADD CONSTRAINT `work_tasks_assignee_company_user_id_fkey` FOREIGN KEY (`assignee_company_user_id`) REFERENCES `company_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_tasks` ADD CONSTRAINT `work_tasks_parent_task_id_fkey` FOREIGN KEY (`parent_task_id`) REFERENCES `work_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_task_comments` ADD CONSTRAINT `work_task_comments_work_task_id_fkey` FOREIGN KEY (`work_task_id`) REFERENCES `work_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_task_comments` ADD CONSTRAINT `work_task_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
