/**
 * Full API audit runner:
 * - happy-path collection requests
 * - negative cases (auth, validation, invalid id, duplicate)
 * Writes postman/API_AUDIT_REPORT.md + postman/api-audit-raw.json
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const COMPANY_ID =
  process.env.COMPANY_ID || '019f989b-6d98-7429-80ae-32d0c1cbf7f9';

function classify(status, preview) {
  if (status === 0) return 'NETWORK';
  if (status >= 200 && status < 300) return 'PASS';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 422) return 'BAD_REQUEST';
  if (status >= 500) return 'SERVER_ERROR';
  return 'OTHER';
}

function guessFile(method, urlPath) {
  const diffPath = path.join(__dirname, '..', 'postman', '_route_diff.json');
  if (!fs.existsSync(diffPath)) return '';
  const diff = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
  const norm = (p) =>
    p
      .replace(/https?:\/\/[^/]+/, '')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':param')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/';
  const target = norm(urlPath);
  const hit = (diff.codeRoutes || []).find(
    (r) => r.method === method && norm(r.path) === target,
  );
  return hit?.file || '';
}

function rootCause(row) {
  const msg = row.errorMessage || row.preview || '';
  if (row.class === 'PASS') return { cause: 'OK', fix: '' };
  if (row.class === 'AUTH') {
    if (/Tenant context missing/i.test(msg))
      return {
        cause: 'Missing x-company-id / tenant CLS for refresh or sandbox',
        fix: 'Pass x-company-id or bind tenant from JWT company membership',
      };
    if (/Forbidden|limit|Capability|permission/i.test(msg))
      return {
        cause: 'Expected authorization / plan limit / capability gate',
        fix: 'Use ACTIVE project, upgrade plan, or role with permission',
      };
    return {
      cause: 'Unauthenticated or unauthorized',
      fix: 'Provide valid Bearer token and permissions',
    };
  }
  if (row.class === 'CONFLICT')
    return {
      cause: 'Unique constraint / duplicate seed data',
      fix: 'Use unique codes in samples or treat 409 as expected for retests',
    };
  if (row.class === 'NOT_FOUND')
    return {
      cause: 'Missing path var / seed record / wrong provider code',
      fix: 'Harvest IDs from list endpoints; use real provider codes',
    };
  if (row.class === 'BAD_REQUEST')
    return {
      cause: 'Validation / business rule / FK / length',
      fix: 'Align sample body with DTO and entity state',
    };
  if (row.class === 'SERVER_ERROR')
    return {
      cause: 'Unhandled exception (should be rare after Prisma filter)',
      fix: 'Inspect server logs; map error in service or filter',
    };
  return { cause: msg || 'Unknown', fix: 'Investigate response body' };
}

async function main() {
  // Refresh route diff + collection
  spawnSync('node', ['scripts/generate-postman.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  spawnSync('node', ['scripts/audit-routes.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });

  // Run existing happy-path suite
  spawnSync('node', ['scripts/run-endpoint-tests.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  const endpointReport = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'postman', 'endpoint-test-report.json'),
      'utf8',
    ),
  );

  // Login for negative cases
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@saas-erp.local',
      password: 'Admin123!',
    }),
  });
  const login = await loginRes.json();
  const token = login.accessToken;
  const hdr = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-company-id': COMPANY_ID,
  };

  const negatives = [];

  async function neg(name, method, url, opts = {}) {
    const started = Date.now();
    let status = 0;
    let preview = '';
    try {
      const res = await fetch(url, {
        method,
        headers: opts.headers || hdr,
        body: opts.body,
      });
      status = res.status;
      preview = (await res.text()).slice(0, 300);
    } catch (e) {
      preview = e.message;
    }
    const row = {
      folder: 'Negative',
      name,
      method,
      status,
      class: classify(status),
      expected: opts.expected,
      expectedOk: opts.expected
        ? opts.expected.includes(status)
        : status >= 400,
      url,
      preview,
      errorMessage: (() => {
        try {
          return JSON.parse(preview).message;
        } catch {
          return preview;
        }
      })(),
      ms: Date.now() - started,
      file: guessFile(method, url),
    };
    const rc = rootCause(row);
    row.rootCause = rc.cause;
    row.fixSuggestion = rc.fix;
    negatives.push(row);
  }

  // Missing auth
  await neg(
    'GET /companies without auth',
    'GET',
    `${BASE}/companies`,
    { headers: { 'Content-Type': 'application/json' }, expected: [401] },
  );

  // Missing body fields
  await neg(
    'POST /auth/login missing password',
    'POST',
    `${BASE}/auth/login`,
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@saas-erp.local' }),
      expected: [400],
    },
  );

  // Invalid ID
  await neg(
    'GET company invalid id',
    'GET',
    `${BASE}/companies/00000000-0000-0000-0000-000000000000`,
    { expected: [404] },
  );

  // Duplicate company slug (valid lengths)
  await neg(
    'POST /companies duplicate slug',
    'POST',
    `${BASE}/companies`,
    {
      body: JSON.stringify({
        legalName: 'Duplicate Co LLC',
        displayName: 'Duplicate Co',
        slug: 'demo-co',
        defaultCurrency: 'SAR',
        timezone: 'Asia/Riyadh',
      }),
      expected: [400, 409],
    },
  );

  // Wrong permission — viewer lacks finance.write
  const viewerLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'viewer@demo-co.local',
      password: 'Admin123!',
      companyId: COMPANY_ID,
    }),
  });
  const viewer = await viewerLogin.json();
  await neg(
    'POST payment-methods with viewer (wrong permissions)',
    'POST',
    `${BASE}/companies/${COMPANY_ID}/payment-methods`,
    {
      headers: {
        Authorization: `Bearer ${viewer.accessToken || 'invalid'}`,
        'Content-Type': 'application/json',
        'x-company-id': COMPANY_ID,
      },
      body: JSON.stringify({ code: 'STRIPE', name: 'Viewer Stripe' }),
      expected: [403],
    },
  );

  // Invalid gateway code
  await neg(
    'POST payment-methods invalid code',
    'POST',
    `${BASE}/companies/${COMPANY_ID}/payment-methods`,
    {
      body: JSON.stringify({ code: 'NOT_A_GATEWAY', name: 'Bad' }),
      expected: [404, 400],
    },
  );

  // Duplicate payment method
  await neg(
    'POST payment-methods duplicate Stripe Sandbox',
    'POST',
    `${BASE}/companies/${COMPANY_ID}/payment-methods`,
    {
      body: JSON.stringify({ code: 'STRIPE', name: 'Stripe Sandbox' }),
      expected: [400, 409],
    },
  );

  const happy = (endpointReport.results || []).map((r) => {
    const rc = rootCause({
      class: r.class,
      preview: r.preview,
      errorMessage: r.preview,
    });
    return {
      ...r,
      errorMessage: (() => {
        try {
          return JSON.parse(r.preview || '{}').message;
        } catch {
          return r.preview;
        }
      })(),
      file: guessFile(r.method, r.url || ''),
      rootCause: rc.cause,
      fixSuggestion: rc.fix,
      caseType: 'happy',
    };
  });

  const all = [
    ...happy,
    ...negatives.map((n) => ({ ...n, caseType: 'negative' })),
  ];

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    companyId: COMPANY_ID,
    routeDiff: JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'postman', '_route_diff.json'),
        'utf8',
      ),
    ),
    happy: endpointReport.summary,
    negatives: {
      total: negatives.length,
      expectedPass: negatives.filter((n) => n.expectedOk).length,
      unexpected: negatives.filter((n) => !n.expectedOk).length,
    },
    serverErrors: all.filter((r) => r.class === 'SERVER_ERROR'),
  };

  fs.writeFileSync(
    path.join(__dirname, '..', 'postman', 'api-audit-raw.json'),
    JSON.stringify({ summary, results: all, negatives }, null, 2),
  );

  const lines = [];
  lines.push('# API Audit Report');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Base URL: \`${BASE}\``);
  lines.push(`Company: \`${COMPANY_ID}\``);
  lines.push('');
  lines.push('## Route coverage');
  lines.push('');
  lines.push(`- Code routes: **${summary.routeDiff.codeRouteCount}**`);
  lines.push(`- Postman routes: **${summary.routeDiff.postmanRouteCount}**`);
  lines.push(
    `- Missing in Postman: **${summary.routeDiff.missingInPostman.length}**`,
  );
  lines.push(
    `- Extra in Postman: **${summary.routeDiff.extraInPostman.length}**`,
  );
  if (summary.routeDiff.missingInPostman.length) {
    lines.push('');
    lines.push('### Missing endpoints');
    for (const m of summary.routeDiff.missingInPostman) {
      lines.push(`- \`${m.method} ${m.path}\` — \`${m.file}\``);
    }
  }
  lines.push('');
  lines.push('## Happy-path summary');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(summary.happy, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Negative-case summary');
  lines.push('');
  lines.push(
    `- Total: ${summary.negatives.total}, expected outcomes: ${summary.negatives.expectedPass}, unexpected: ${summary.negatives.unexpected}`,
  );
  lines.push('');
  lines.push('## Server errors (priority fixes)');
  lines.push('');
  if (!summary.serverErrors.length) {
    lines.push('_None_');
  } else {
    for (const r of summary.serverErrors) {
      lines.push(
        `- \`${r.method} ${r.name || r.url}\` → ${r.status}: ${r.errorMessage || r.preview}`,
      );
    }
  }
  lines.push('');
  lines.push('## Detailed results');
  lines.push('');
  lines.push(
    '| Endpoint | Method | Status | Result | Error | Root cause | File | Fix |',
  );
  lines.push('|---|---|---:|---|---|---|---|---|');

  const detailRows = [
    ...all.filter((r) => r.class === 'SERVER_ERROR'),
    ...negatives,
    ...all.filter(
      (r) =>
        r.caseType === 'happy' &&
        r.class !== 'PASS' &&
        r.class !== 'SERVER_ERROR',
    ),
  ];

  for (const r of detailRows) {
    const endpoint = (r.name || r.url || '').replace(/\|/g, '/');
    const err = String(r.errorMessage || '')
      .replace(/\|/g, '/')
      .replace(/\n/g, ' ')
      .slice(0, 120);
    const cause = String(r.rootCause || '')
      .replace(/\|/g, '/')
      .slice(0, 100);
    const fix = String(r.fixSuggestion || '')
      .replace(/\|/g, '/')
      .slice(0, 100);
    const file = String(r.file || '').replace(/\|/g, '/');
    lines.push(
      `| ${endpoint} | ${r.method} | ${r.status} | ${r.class}${r.expectedOk === false ? ' (unexpected)' : r.expectedOk ? ' (expected)' : ''} | ${err} | ${cause} | ${file} | ${fix} |`,
    );
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- Postman MCP has no local `runCollection`; discovery used MCP `getWorkspaces`; execution used `scripts/run-endpoint-tests.js` + negative probes.',
  );
  lines.push(
    '- Route coverage: Nest controllers vs regenerated `postman/SaaS_ERP_Backend_API.postman_collection.json`.',
  );
  lines.push(
    '- Happy-path CONFLICT/BAD_REQUEST on POST against a fully seeded Demo Co are expected retest noise, not SERVER_ERRORs.',
  );
  lines.push(
    '- Product fixes from this audit: auth membership via `prisma.withoutTenant()`, JWT `TenantInterceptor`, sandbox `SandboxCompany` upsert, collection sample bodies/headers.',
  );
  lines.push(
    '- Collection regenerated via `scripts/generate-postman.js` (multi-`@Controller` per file supported).',
  );

  fs.writeFileSync(
    path.join(__dirname, '..', 'postman', 'API_AUDIT_REPORT.md'),
    lines.join('\n'),
  );
  console.log('Wrote postman/API_AUDIT_REPORT.md');
  console.log(
    'Server errors:',
    summary.serverErrors.length,
    'Neg unexpected:',
    summary.negatives.unexpected,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
