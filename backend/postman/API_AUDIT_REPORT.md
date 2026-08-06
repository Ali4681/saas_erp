# API Audit Report

Generated: 2026-07-25T12:57:35.311Z
Base URL: `http://127.0.0.1:3000`
Company: `019f989b-6d98-7429-80ae-32d0c1cbf7f9`

## Route coverage

- Code routes: **158**
- Postman routes: **158**
- Missing in Postman: **0**
- Extra in Postman: **0**

## Happy-path summary

```json
{
  "PASS": 158
}
```

## Negative-case summary

- Total: 7, expected outcomes: 7, unexpected: 0

## Server errors (priority fixes)

_None_

## Detailed results

| Endpoint | Method | Status | Result | Error | Root cause | File | Fix |
|---|---|---:|---|---|---|---|---|
| GET /companies without auth | GET | 401 | AUTH (expected) | Unauthorized | Unauthenticated or unauthorized | src/modules/companies/companies.controller.ts | Provide valid Bearer token and permissions |
| POST /auth/login missing password | POST | 400 | BAD_REQUEST (expected) | password must be longer than or equal to 6 characters,password must be a string | Validation / business rule / FK / length | src/modules/auth/auth.controller.ts | Align sample body with DTO and entity state |
| GET company invalid id | GET | 404 | NOT_FOUND (expected) | Company not found | Missing path var / seed record / wrong provider code |  | Harvest IDs from list endpoints; use real provider codes |
| POST /companies duplicate slug | POST | 400 | BAD_REQUEST (expected) | Company slug already exists | Validation / business rule / FK / length | src/modules/companies/companies.controller.ts | Align sample body with DTO and entity state |
| POST payment-methods with viewer (wrong permissions) | POST | 403 | AUTH (expected) | Forbidden resource | Expected authorization / plan limit / capability gate |  | Use ACTIVE project, upgrade plan, or role with permission |
| POST payment-methods invalid code | POST | 404 | NOT_FOUND (expected) | Payment gateway not found | Missing path var / seed record / wrong provider code |  | Harvest IDs from list endpoints; use real provider codes |
| POST payment-methods duplicate Stripe Sandbox | POST | 400 | BAD_REQUEST (expected) | This payment method is already enabled for the company | Validation / business rule / FK / length |  | Align sample body with DTO and entity state |

## Notes

- Postman MCP has no local `runCollection`; discovery used MCP `getWorkspaces`; execution used `scripts/run-endpoint-tests.js` + negative probes.
- Route coverage: Nest controllers vs regenerated `postman/SaaS_ERP_Backend_API.postman_collection.json`.
- Happy-path CONFLICT/BAD_REQUEST on POST against a fully seeded Demo Co are expected retest noise, not SERVER_ERRORs.
- Product fixes from this audit: auth membership via `prisma.withoutTenant()`, JWT `TenantInterceptor`, sandbox `SandboxCompany` upsert, collection sample bodies/headers.
- Collection regenerated via `scripts/generate-postman.js` (multi-`@Controller` per file supported).