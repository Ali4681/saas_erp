export const QUEUE_SYNC = 'integration-sync';
export const QUEUE_WEBHOOKS = 'integration-webhooks';
export const QUEUE_OPERATIONS = 'integration-operations';

export const JOB_FULL_SYNC = 'full-sync';
export const JOB_INCREMENTAL_SYNC = 'incremental-sync';
export const JOB_PROCESS_WEBHOOK = 'process-webhook';
export const JOB_EXECUTE_OPERATION = 'execute-operation';

export type SyncJobPayload = {
  integrationJobId: string;
  connectedProjectId: string;
  companyId: string;
  entityType: string;
  jobType: 'FULL_SYNC' | 'INCREMENTAL_SYNC';
};

export type WebhookJobPayload = {
  webhookEventId: string;
  connectedProjectId: string;
};

export type OperationJobPayload = {
  operationRequestId: string;
  connectedProjectId: string;
  companyId: string;
};
