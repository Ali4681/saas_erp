# Backup and restore runbook

Local MySQL for this project typically listens on **3307** (see `.env`). Docker Compose defaults to **3306**.

## Logical backup (recommended for day-to-day)

```bash
mysqldump -h 127.0.0.1 -P 3307 -u saas_erp -p \
  --single-transaction --routines --triggers --hex-blob \
  saas_erp > saas_erp_$(date +%Y%m%d_%H%M%S).sql
```

PowerShell:

```powershell
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
mysqldump -h 127.0.0.1 -P 3307 -u saas_erp -psaas_erp `
  --single-transaction --routines --triggers --hex-blob `
  saas_erp | Set-Content -Encoding utf8 "saas_erp_$stamp.sql"
```

## Restore

```bash
mysql -h 127.0.0.1 -P 3307 -u saas_erp -p saas_erp < saas_erp_YYYYMMDD_HHMMSS.sql
```

After restore:

1. Confirm app `.env` points at the restored instance.
2. Run `npx prisma migrate status` (schema should already match; do not invent migrations).
3. Optional: `npm run prisma:seed` only on empty/dev databases — seed is idempotent for roles/permissions but may re-link demo data.

## What to exclude or handle carefully

| Object | Note |
|--------|------|
| `audit_logs`, `*_logs`, `*_deliveries` | High volume; retention jobs prune by TTL. Backups still include them unless you filter. |
| Encrypted credential columns | Restored with ciphertext; requires matching `ENCRYPTION_KEYS` / `ENCRYPTION_KEY_VERSION`. |
| JWT secrets | Not in DB; keep `.env` backups separate and secret. |

## Physical / volume backup (Docker)

If using Compose volumes:

```bash
docker compose stop mysql
docker run --rm -v saas_erp_mysql_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/mysql_data_$(date +%Y%m%d).tar.gz -C /data .
docker compose start mysql
```

Prefer logical dumps for portability across hosts.

## Smoke check after restore

```bash
curl -s http://127.0.0.1:3000/health
# login + GET /companies/:id/reports/executive
```
