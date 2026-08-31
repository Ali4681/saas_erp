-- Temporary hold status for sales invoices (parked before issue/collection)
ALTER TABLE `sales_invoices`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'ON_HOLD',
    'ISSUED',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT';
