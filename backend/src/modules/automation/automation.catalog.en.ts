/** English overlays for automation catalog (Arabic remains source in automation.catalog.ts). */

export const AUTOMATION_IDEA_EN =
  'The system follows: when something happens, run an action. Example: when a new lead is added, create a follow-up task for a sales user.';

export const MODULE_LABELS_EN = {
  crm: 'CRM',
  sales: 'Sales',
  inventory: 'Inventory',
  hr: 'HR',
  work: 'Projects',
  general: 'General',
} as const;

export const TRIGGER_EN: Record<
  string,
  { label: string; description: string }
> = {
  manual: {
    label: 'Manual run',
    description: 'Runs when you click execute or via the API',
  },
  'crm.lead.created': {
    label: 'New lead added',
    description: 'When a new lead is created',
  },
  'crm.contact.created': {
    label: 'New contact',
    description: 'When a contact is created',
  },
  'crm.opportunity.status_changed': {
    label: 'Opportunity status changed',
    description: 'For example when marked as interested',
  },
  'crm.contact.stale': {
    label: 'Stale contact',
    description: 'When a contact has not been followed up for a while',
  },
  'sales.quote.accepted': {
    label: 'Quote accepted',
    description: 'When a quote is accepted',
  },
  'sales.invoice.paid': {
    label: 'Invoice paid',
    description: 'When an invoice is paid',
  },
  'sales.invoice.overdue': {
    label: 'Overdue invoice',
    description: 'When an open invoice past due date (scheduled)',
  },
  'inventory.stock.low': {
    label: 'Low stock',
    description: 'When quantity drops or hits the minimum',
  },
  'hr.leave.approved': {
    label: 'Leave approved',
    description: 'When a leave request is approved',
  },
  'hr.attendance.absence': {
    label: 'Absence recorded',
    description: 'When an employee absence is recorded',
  },
  'hr.payroll.month_end': {
    label: 'Month-end payroll',
    description: 'Scheduled at month end to prepare payroll',
  },
  'work.task.overdue': {
    label: 'Overdue task',
    description: 'When a task due date is passed',
  },
  'work.phase.completed': {
    label: 'Phase completed',
    description: 'When a project phase is completed',
  },
  'attachments.uploaded': {
    label: 'File uploaded',
    description: 'When an attachment linked to a project or task is uploaded',
  },
  'schedule.cron': {
    label: 'Cron schedule',
    description: 'Periodic run based on a cron expression',
  },
};

export const ACTION_EN: Record<string, { label: string; description: string }> =
  {
    notify: {
      label: 'Notify a user',
      description: 'In-app notification (and push if available)',
    },
    notify_role: {
      label: 'Notify by role',
      description: 'Notify all company members with the given role',
    },
    assign_user: {
      label: 'Assign user',
      description: 'Assign a user to a contact, opportunity, or task',
    },
    create_task: {
      label: 'Create task',
      description: 'Follow-up task in the projects module',
    },
    create_crm_activity: {
      label: 'CRM follow-up reminder',
      description: 'Create a follow-up activity on the contact/opportunity',
    },
    convert_quote_to_invoice: {
      label: 'Convert quote to invoice',
      description: 'When a quote is accepted',
    },
    update_contact_status: {
      label: 'Update contact status',
      description: 'For example after invoice payment',
    },
    create_purchase_order: {
      label: 'Create purchase order',
      description: 'Draft PO for a low-stock item',
    },
    ensure_stock_deduction: {
      label: 'Deduct stock quantity',
      description: 'Auto-deduct on sale if not already deducted',
    },
    update_leave_balance: {
      label: 'Update leave balance',
      description: 'After a leave request is approved',
    },
    prepare_payroll_run: {
      label: 'Prepare payroll draft',
      description: 'Create a payroll run for the current month',
    },
    open_next_phase: {
      label: 'Open next phase',
      description: 'After a project phase is completed',
    },
  };

export const FIELD_EN: Record<string, string> = {
  userId: 'User',
  title: 'Title',
  body: 'Body',
  roleCode: 'Role code',
  assigneeUserId: 'Assignee',
  daysFromNow: 'Days from now',
  status: 'Status',
  'create_task.title': 'Task title',
};

export const TEMPLATE_EN: Record<
  string,
  { name: string; description: string }
> = {
  'crm.lead.assign_sales': {
    name: 'Assign lead to sales user',
    description: 'When a new lead is added, assign it to a sales user',
  },
  'crm.interested.followup': {
    name: 'Follow-up reminder when interested',
    description:
      'When opportunity status becomes interested, create a follow-up reminder',
  },
  'crm.stale.manager_alert': {
    name: 'Alert manager on stale follow-up',
    description:
      'When a contact is not followed up, notify the manager and create a reminder',
  },
  'sales.quote.to_invoice': {
    name: 'Convert accepted quote to invoice',
    description: 'When a quote is accepted, convert it to an invoice',
  },
  'sales.invoice.overdue_alert': {
    name: 'Overdue invoice alert',
    description: 'When invoice payment is late, notify the owner and admins',
  },
  'sales.invoice.paid_update_customer': {
    name: 'Update customer after payment',
    description: 'When an invoice is paid, update the contact status',
  },
  'inventory.low.notify': {
    name: 'Low stock alert',
    description: 'When quantity drops, send an alert',
  },
  'inventory.min.create_po': {
    name: 'Purchase order at minimum',
    description: 'When stock hits minimum, create a purchase order',
  },
  'sales.deduct_stock': {
    name: 'Deduct quantity on sale',
    description: 'When a product is sold, deduct quantity automatically',
  },
  'hr.leave.update_balance': {
    name: 'Update leave balance',
    description: 'When leave is approved, update leave balances',
  },
  'hr.absence.notify': {
    name: 'Notify on absence',
    description: 'When absence is recorded, send a notification',
  },
  'hr.payroll.month_end': {
    name: 'Prepare month-end payroll',
    description: 'At month end, prepare payroll data',
  },
  'work.task.overdue_notify': {
    name: 'Overdue task notification',
    description: 'When a task is overdue, send a notification',
  },
  'work.phase.open_next': {
    name: 'Open next phase',
    description: 'When a phase is completed, open the next phase',
  },
  'work.file.notify_pm': {
    name: 'Notify PM on file upload',
    description: 'When a file is uploaded, notify the project manager',
  },
};

export const VERIFICATION_EN: Record<string, string> = {
  'crm.lead.created': 'New lead → assign + task',
  'crm.opportunity.status_changed': 'Interested → follow-up reminder',
  'crm.contact.stale': 'Stale contact → alert / follow-up',
  'sales.quote.accepted': 'Accepted quote → invoice',
  'sales.invoice.overdue': 'Overdue invoice → alert',
  'sales.invoice.paid': 'Paid invoice → update contact / deduct stock',
  'inventory.stock.low': 'Low stock → alert / purchase order',
  'hr.leave.approved': 'Leave approved → balance',
  'hr.attendance.absence': 'Absence → notify',
  'hr.payroll.month_end': 'Month end → payroll',
  'work.task.overdue': 'Overdue task → notify',
  'work.phase.completed': 'Phase complete → open next',
  'attachments.uploaded': 'File upload → notify PM',
};
