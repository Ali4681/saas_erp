-- AlterTable
ALTER TABLE `ai_usage_logs` DROP PRIMARY KEY,
    ADD PRIMARY KEY (`id`, `created_at`);

-- AlterTable
ALTER TABLE `api_request_logs` DROP PRIMARY KEY,
    ADD PRIMARY KEY (`id`, `created_at`);

-- AlterTable
ALTER TABLE `message_deliveries` DROP PRIMARY KEY,
    ADD PRIMARY KEY (`id`, `created_at`);

-- AlterTable
ALTER TABLE `webhook_deliveries` DROP PRIMARY KEY,
    ADD PRIMARY KEY (`id`, `created_at`);
