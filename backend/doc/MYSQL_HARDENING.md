# MySQL hardening (Phase 10)

## Arabic FULLTEXT

MySQL default `innodb_ft_min_token_size=3` drops many Arabic tokens (short stems / clitics). For Arabic search quality set:

```ini
[mysqld]
innodb_ft_min_token_size=2
innodb_ft_enable_stopword=OFF
```

**Requires MySQL restart.** After changing the setting, rebuild FULLTEXT indexes (or `OPTIMIZE TABLE` on tables that use `@@fulltext`).

Docker Compose already passes `--innodb-ft-min-token-size=2`.

Verify:

```sql
SHOW VARIABLES LIKE 'innodb_ft_min_token_size';
```

Prisma note: FULLTEXT must be declared with `@@fulltext` in the schema — raw indexes are dropped on the next `prisma migrate dev` (see Phase 1 spike notes).

## Partition readiness

Append-only high-volume tables use composite primary keys `@@id([id, createdAt])` so a future `PARTITION BY RANGE (TO_DAYS(created_at))` can include the partition key in the PK:

| Table | PK | Status |
|-------|-----|--------|
| `audit_logs` | `(id, created_at)` | Ready |
| `api_request_logs` | `(id, created_at)` | Ready |
| `webhook_deliveries` | `(id, created_at)` | Ready |
| `message_deliveries` | `(id, created_at)` | Ready |
| `ai_usage_logs` | `(id, created_at)` | Ready |
| `webhook_events` | `id` only | **Deferred** — unique keys `(project, provider_event_id)` / payload hash conflict with RANGE partitioning unless uniqueness is scoped per partition |
| `integration_errors` | `id` only | **Deferred** — rows are updated (`occurrence_count`, `last_seen_at`), not append-only |

Do **not** convert live production tables to partitions without a maintenance window and a tested dump/restore. Until volume justifies it, use **retention deletes** (`POST /admin/retention/purge`).

Example (manual ops — not applied automatically):

```sql
-- After ensuring PK includes created_at and no conflicting UNIQUEs:
ALTER TABLE audit_logs
PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p202601 VALUES LESS THAN (TO_DAYS('2026-02-01')),
  PARTITION p202602 VALUES LESS THAN (TO_DAYS('2026-03-01')),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

Dropping an old partition is faster than row deletes once partitioned.

## Retention (application)

| Env | Default days |
|-----|--------------|
| `RETENTION_AUDIT_DAYS` | 365 |
| `RETENTION_API_REQUEST_LOG_DAYS` | 90 |
| `RETENTION_WEBHOOK_DELIVERY_DAYS` | 90 |
| `RETENTION_WEBHOOK_EVENT_DAYS` | 90 |
| `RETENTION_MESSAGE_DELIVERY_DAYS` | 180 |
| `RETENTION_AI_USAGE_DAYS` | 365 |
| `RETENTION_INTEGRATION_ERROR_DAYS` | 180 |
| `RETENTION_AUTOMATION_RUN_DAYS` | 180 |
| `RETENTION_CRON_ENABLED` | `true` (daily 03:00 UTC) |

Manual: `POST /admin/retention/purge?dryRun=true` then without `dryRun` (permission `retention.run`).

Append-only models normally block `deleteMany`; purge sets a CLS flag `appendOnlyPurge` for delete operations only.

## Index review checklist (under load)

1. Confirm tenant list endpoints hit `(company_id, created_at DESC)` / status composites — already mapped in Prisma.
2. After realistic volume, `EXPLAIN` hot paths: invoice list, stock movements, audit by company, webhook delivery by webhook id.
3. Watch slow query log (`long_query_time=1`) for missing filters on `company_id`.
4. Avoid extra indexes on JSON columns; project specific keys into typed columns if filtered often.

## Reports / BI (SRS 17)

- `GET /companies/:companyId/reports/executive`
- `GET /companies/:companyId/reports/modules/:module`  
  modules: `crm|sales|purchasing|inventory|hr|work|notebook|automation`

Permission: `reports.read`.
