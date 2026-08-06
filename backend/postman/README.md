# Postman collections

## Import

1. Open Postman → **Import**
2. Import:
   - `SaaS_ERP_Backend_API.postman_collection.json`
   - `SaaS_ERP_Local.postman_environment.json`
3. Select environment **SaaS ERP Local**

## Quick start

1. Run **Auth → POST /auth/login** (body already filled: `admin@saas-erp.local` / `Admin123!`)
   - Test script saves `accessToken` (+ refresh token when present)
2. `companyId` is prefilled with the demo company from seed
3. Call any company-scoped request — headers include `Authorization` + `x-company-id`

## Regenerate from controllers

```bash
node scripts/generate-postman.js
```

## Notes

- **154** endpoints across **30** folders
- Path params use collection variables (`{{itemId}}`, `{{projectId}}`, …) — set them after create calls
- Public routes (no JWT): `/auth/*`, `/health/*`, `/sandbox/*`, `/webhooks/:projectId`
- Provider marketplace credentials are **not** in `.env`; create via **Integrations / Projects**
