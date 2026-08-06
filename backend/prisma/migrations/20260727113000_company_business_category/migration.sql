-- Add business category to tenant companies (Delivery / Installment / E-commerce)
ALTER TABLE `companies`
  ADD COLUMN `business_category` ENUM('DELIVERY', 'INSTALLMENT', 'ECOMMERCE') NOT NULL DEFAULT 'DELIVERY' AFTER `status`;

ALTER TABLE `companies`
  MODIFY COLUMN `business_category` ENUM('DELIVERY', 'INSTALLMENT', 'ECOMMERCE') NOT NULL;
