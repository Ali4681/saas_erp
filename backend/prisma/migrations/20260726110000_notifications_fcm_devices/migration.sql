-- AlterTable
ALTER TABLE `notifications`
  ADD COLUMN `data` JSON NOT NULL DEFAULT (JSON_OBJECT()),
  ADD COLUMN `push_sent_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `user_push_devices` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `platform` VARCHAR(20) NOT NULL,
  `device_name` VARCHAR(120) NULL,
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `disabled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `uq_user_push_device_token` ON `user_push_devices`(`token`);

-- CreateIndex
CREATE INDEX `idx_user_push_device_user` ON `user_push_devices`(`company_id`, `user_id`, `disabled_at`);

-- AddForeignKey
ALTER TABLE `user_push_devices`
  ADD CONSTRAINT `user_push_devices_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_push_devices`
  ADD CONSTRAINT `user_push_devices_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
