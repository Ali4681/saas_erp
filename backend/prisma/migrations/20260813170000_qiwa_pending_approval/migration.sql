-- Add manager-approval step for Qiwa documentation + enum value
ALTER TABLE `employee_qiwa_contracts`
  MODIFY COLUMN `status` ENUM(
    'NOT_STARTED',
    'IN_PROGRESS',
    'AWAITING_EMPLOYEE',
    'PENDING_APPROVAL',
    'DOCUMENTED',
    'REJECTED_OR_MODIFICATION'
  ) NOT NULL DEFAULT 'NOT_STARTED';
