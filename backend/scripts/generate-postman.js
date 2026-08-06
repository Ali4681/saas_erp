const fs = require('fs');
const path = require('path');

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'generated', 'dist'].includes(e.name)) walk(p, a);
    } else if (e.name.endsWith('.controller.ts')) a.push(p);
  }
  return a;
}

function sampleForKey(key, typeHint = '') {
  const k = key.toLowerCase();
  const t = (typeHint || '').toLowerCase();
  if (k === 'email') return 'admin@saas-erp.local';
  if (k.includes('password')) return 'Admin123!';
  if (k === 'from' || k === 'to') return '2026-01-01';
  if (k === 'currency' || k.endsWith('currency')) return 'SAR';
  if (k.includes('iban')) return 'SA0380000000608010167519';
  if (k.includes('phone') || k.includes('mobile') || k === 'recipient')
    return '+966500000000';
  if (k.includes('email')) return 'customer@example.com';
  if (k.endsWith('at') || k.endsWith('on') || k.includes('date'))
    return '2026-07-25T10:00:00.000Z';
  if (k.includes('amount') || k.includes('price') || k.includes('cost') || k.includes('salary') || k.includes('total'))
    return '100.00';
  if (k.includes('quantity') || k === 'qty') return '10';
  if (k.includes('rate') || k.includes('percent')) return '15';
  if (k.includes('token')) return 100;
  if (t.includes('number') || t.includes('int')) return 1;
  if (t.includes('boolean') || t.includes('bool')) return true;
  if (
    t.includes('json') ||
    t.includes('record') ||
    t.includes('object') ||
    t.includes('any') ||
    ['payload', 'config', 'scopes', 'events', 'conditions', 'actions', 'metadata', 'variables'].includes(k)
  ) {
    if (k === 'scopes') return ['read', 'write'];
    if (k === 'events') return ['order.created', 'order.updated'];
    if (k === 'conditions') return [];
    if (k === 'actions') return [{ type: 'NOTIFY', target: 'owner' }];
    if (k === 'variables') return { name: 'Ali' };
    if (k === 'config') return { host: 'smtp.example.com', port: 587 };
    if (k === 'payload') return { demo: true };
    return {};
  }
  if (t.includes('[]') || t.includes('array')) {
    if (k === 'lines' || k.includes('line')) {
      return [
        {
          itemId: '{{itemId}}',
          description: 'Line item',
          quantity: '1',
          unitPrice: '50.00',
        },
      ];
    }
    return [];
  }
  // enums / status-ish
  if (k === 'status') return 'ACTIVE';
  if (k === 'direction') return 'INFLOW';
  if (k === 'accounttype') return 'BANK';
  if (k === 'transactiontype') return 'ADJUSTMENT';
  if (k === 'contacttype') return 'CUSTOMER';
  if (k === 'activitytype' || k === 'type') {
    if (k === 'activitytype') return 'CALL';
  }
  if (k === 'channel') return 'WHATSAPP';
  if (k === 'provider') return 'SMTP';
  if (k === 'priority') return 'MEDIUM';
  if (k === 'environment') return 'SANDBOX';
  if (k === 'authtype') return 'API_KEY';
  if (k === 'movementtype') return 'MANUAL_ADJUSTMENT';
  if (k === 'leavetype') return 'ANNUAL';
  if (k === 'employmentstatus') return 'ACTIVE';
  if (k === 'decision' || k === 'approved') return 'APPROVED';
  if (k === 'method') return 'BANK_TRANSFER';
  if (k === 'module') return 'crm';
  if (k === 'startson' || k === 'endson' || k === 'workdate' || k === 'periodstart' || k === 'periodend')
    return '2026-07-25';
  if (t.includes('crmcontacttype')) return 'CUSTOMER';
  if (t.includes('crmactivitytype')) return 'CALL';
  if (t.includes('opportunitystatus')) return 'OPEN';
  if (t.includes('activitystatus')) return 'DONE';
  if (t.includes('contractstatus')) return 'ACTIVE';
  if (t.includes('expensestatus')) return 'APPROVED';
  if (t.includes('automationstatus')) return 'ACTIVE';
  if (t.includes('marketingchannel')) return 'INSTAGRAM';
  if (t.includes('messagingprovider')) return 'SMTP';
  if (t.includes('taskpriority') || t.includes('priority')) return 'MEDIUM';
  if (t.includes('taskstatus')) return 'TODO';
  if (t.includes('projectstatus') || t.includes('workproject')) return 'ACTIVE';
  if (t.includes('bankaccounttype')) return 'BANK';
  if (t.includes('financialdirection')) return 'INFLOW';
  if (t.includes('financialtransactiontype')) return 'ADJUSTMENT';
  if (t.includes('stockmovementtype')) return 'MANUAL_ADJUSTMENT';
  if (t.includes('recordstatus')) return 'ACTIVE';
  if (t.includes('projectenvironment')) return 'SANDBOX';
  if (t.includes('projectstatus')) return 'ACTIVE';
  if (t.includes('authtype')) return 'API_KEY';
  if (t.includes('leavestatus') || t.includes('decision')) return 'APPROVED';
  if (t.includes('payroll')) return 'DRAFT';
  if (t.includes('quotestatus') || t.includes('invoicestatus')) return 'DRAFT';
  if (t.includes('purchaseorderstatus')) return 'DRAFT';
  if (t.includes('notebook')) return 'OPEN';
  if (t.includes('companyapikeystatus') || t.includes('companywebhookstatus'))
    return 'ACTIVE';
  if (t.includes('enum') && k.includes('status')) return 'ACTIVE';
  if (k.includes('id')) return `{{${key}}}`;
  if (k === 'code' || k.endsWith('code')) return 'CODE1';
  if (k === 'sku') return 'SKU-001';
  if (k === 'slug') return 'demo-co';
  if (k.includes('cron')) return '0 9 * * *';
  if (k.includes('url')) return 'https://example.com/hook';
  if (k.includes('mime')) return 'application/pdf';
  if (k.includes('filename')) return 'document.pdf';
  if (k.includes('checksum')) return 'a'.repeat(64);
  if (k.includes('size')) return '1024';
  if (k.includes('content') || k === 'body' || k.includes('description') || k.includes('notes') || k.includes('message') || k.includes('title') || k.includes('name'))
    return `Sample ${key}`;
  if (k.includes('subject')) return 'Hello {{name}}';
  if (k.includes('template')) return 'Hello {{name}}, welcome.';
  return `sample-${key}`;
}

function parseDtoClasses(src) {
  const map = {};
  // match class Foo { ... } at top level-ish
  const re = /class\s+(\w+)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (!/(Body|Dto|Query|Request)$/i.test(name) && !/Body|Dto|Query/.test(name))
      continue;
    let i = m.index + m[0].length;
    let depth = 1;
    let body = '';
    while (i < src.length && depth > 0) {
      const ch = src[i++];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth > 0) body += ch;
    }
    const fields = {};
    // strip decorators roughly then find prop!: type;
    const cleaned = body.replace(/@[A-Za-z][\w.]*(?:\([^)]*\))?/g, '');
    const fieldRe = /(\w+)\s*!\s*:\s*([^;=\n]+)/g;
    let f;
    while ((f = fieldRe.exec(cleaned))) {
      const key = f[1];
      if (['constructor', 'if', 'return'].includes(key)) continue;
      fields[key] = sampleForKey(key, f[2].trim());
    }
    // optional props with ? — skip foreign-key style optionals (avoid 500s from missing_* ids)
    const optRe = /(\w+)\?\s*:\s*([^;=\n]+)/g;
    while ((f = optRe.exec(cleaned))) {
      const key = f[1];
      if (fields[key] !== undefined) continue;
      if (/Id$/.test(key) || key === 'q' || key === 'take') continue;
      fields[key] = sampleForKey(key, f[2].trim());
    }
    if (Object.keys(fields).length) map[name] = fields;
  }
  return map;
}

function joinUrl(a, b) {
  const left = (a || '').replace(/^\/+|\/+$/g, '');
  const right = (b || '').replace(/^\/+|\/+$/g, '');
  if (!left && !right) return '/';
  if (!left) return '/' + right;
  if (!right) return '/' + left;
  return '/' + left + '/' + right;
}

function folderFromPath(full, file) {
  if (full.startsWith('/auth')) return 'Auth';
  if (full.startsWith('/health')) return 'Health';
  if (full.startsWith('/sandbox')) return 'Sandbox';
  if (full.startsWith('/plans')) return 'Plans';
  if (full.startsWith('/admin/retention')) return 'Admin / Retention';
  if (full.startsWith('/webhooks')) return 'Integrations / Webhooks';
  if (full.startsWith('/integrations')) return 'Integrations / Catalog';
  if (full.includes('/integration-center')) return 'Integration Center';
  if (full.includes('/finance')) return 'Finance';
  if (full.includes('/crm')) return 'CRM';
  if (full.includes('/sales')) return 'Sales';
  if (full.includes('/purchasing')) return 'Purchasing';
  if (full.includes('/inventory')) return 'Inventory';
  if (full.includes('/hr')) return 'HR';
  if (full.includes('/work')) return 'Work';
  if (full.includes('/automation')) return 'Automation';
  if (full.includes('/marketing')) return 'Marketing';
  if (full.includes('/attachments')) return 'Attachments';
  if (full.includes('/ai-usage')) return 'AI Usage';
  if (full.includes('/notebook')) return 'Notebook';
  if (full.includes('/messaging')) return 'Messaging';
  if (full.includes('/reports')) return 'Reports';
  if (full.includes('/projects') && full.includes('/mirrors'))
    return 'Integrations / Mirrors';
  if (full.includes('/projects') && full.includes('/operations'))
    return 'Integrations / Operations';
  if (full.includes('/projects') && (full.includes('/jobs') || full.includes('/sync')))
    return 'Integrations / Jobs';
  if (full.includes('/projects')) return 'Integrations / Projects';
  if (full.startsWith('/payment-gateways')) return 'Payment Gateways';
  if (full.includes('/payment-methods')) return 'Payment Methods';
  if (full.match(/^\/companies\/:companyId\/users/)) return 'Users';
  if (full.match(/^\/companies\/:companyId$/) || full.match(/^\/companies$/))
    return 'Companies';
  if (full === '/' || file.includes('app.controller')) return 'App';
  return 'Other';
}

function parseControllers() {
  const routes = [];
  for (const file of walk('src')) {
    const src = fs.readFileSync(file, 'utf8');
    const dtos = parseDtoClasses(src);
    const isPublicFile =
      /auth\.controller|health\.controller|sandbox\.controller|webhooks\.controller|app\.controller/.test(
        file,
      );

    const lines = src.split(/\n/);
    let pending = null;
    let ctrl = '';
    for (let i = 0; i < lines.length; i++) {
      const ctrlDec = lines[i].match(
        /@Controller\(\s*(['"`])([^'"`]*)\1\s*\)/,
      );
      if (ctrlDec) {
        ctrl = ctrlDec[2];
        continue;
      }
      const dec = lines[i].match(/@(Get|Post|Put|Patch|Delete)\((.*)\)\s*$/);
      if (dec) {
        let routePath = '';
        const arg = dec[2].trim();
        if (arg) {
          const q = arg.match(/['`]([^'`]*)['`]/);
          routePath = q ? q[1] : '';
        }
        pending = { method: dec[1].toUpperCase(), routePath, perm: null };
        continue;
      }
      if (pending) {
        const pm = lines[i].match(/@RequirePermissions\(\s*['`]([^'`]+)['`]/);
        if (pm) {
          pending.perm = pm[1];
          continue;
        }
        if (/^@(Get|Post|Put|Patch|Delete|Controller|Injectable)/.test(lines[i].trim())) {
          // another decorator unrelated - keep waiting unless new http verb handled above
        }
        const fn = lines[i].match(/^\s*(?:async\s+)?(\w+)\s*\(/);
        if (fn && !['if', 'for', 'while', 'switch'].includes(fn[1])) {
          // collect full parameter list until the method's closing ')'
          // (ignore ')' inside @Param('x') / @Body() etc.)
          let params = '';
          let j = i;
          let depth = 0;
          let started = false;
          scan: for (; j < Math.min(i + 40, lines.length); j++) {
            const line = j === i ? lines[j].slice(lines[j].indexOf('(')) : lines[j];
            for (let c = 0; c < line.length; c++) {
              const ch = line[c];
              if (ch === '(') {
                depth++;
                started = true;
                if (depth === 1) continue; // skip the method '(' itself
              } else if (ch === ')') {
                depth--;
                if (started && depth === 0) break scan;
              }
              if (started && depth >= 1) params += ch;
            }
            if (started) params += '\n';
          }
          const name = fn[1];
          if (
            [
              'constructor',
              'catch',
              'then',
              'map',
              'filter',
              'forEach',
            ].includes(name)
          ) {
            continue;
          }

          const bodyType = (
            params.match(/@Body\(\)\s*\w+\s*:\s*(\w+)/) ||
            params.match(/@Body\(\)\s*(\w+)/) ||
            []
          )[1];
          const queryType = (
            params.match(/@Query\(\)\s*\w+\s*:\s*(\w+)/) ||
            params.match(/@Query\(\)\s*(\w+)/) ||
            []
          )[1];
          const hasBody = /@Body\(/.test(params);
          const resolvedBodyType =
            bodyType && !['body', 'query', 'string'].includes(bodyType)
              ? bodyType
              : null;
          const resolvedQueryType =
            queryType && !['body', 'query', 'string'].includes(queryType)
              ? queryType
              : null;
          const queryKeys = [
            ...params.matchAll(/@Query\(['`](\w+)['`]\)/g),
          ].map((x) => x[1]);

          let body = null;
          if (hasBody) {
            const key = `${pending.method} ${joinUrl(ctrl, pending.routePath)}`;
            if (Object.prototype.hasOwnProperty.call(OVERRIDE_BODIES, key)) {
              body = OVERRIDE_BODIES[key];
            } else if (
              resolvedBodyType &&
              dtos[resolvedBodyType] &&
              Object.keys(dtos[resolvedBodyType]).length > 0
            ) {
              body = { ...dtos[resolvedBodyType] };
            } else {
              body = { note: 'Provide body per DTO' };
            }
          }

          let query = null;
          // Optional query DTOs are omitted from the collection by default so
          // list/dashboard GETs work without forcing from/to/q filters.
          if (queryKeys.length) {
            query = Object.fromEntries(
              queryKeys.map((k) => [k, sampleForKey(k)]),
            );
          }

          // dryRun query on retention
          if (
            pending.routePath.includes('purge') ||
            joinUrl(ctrl, pending.routePath).includes('purge')
          ) {
            query = { dryRun: 'true' };
          }

          const full = joinUrl(ctrl, pending.routePath);
          routes.push({
            file: path.relative('src', file),
            name,
            method: pending.method,
            full,
            perm: pending.perm,
            body,
            query,
            public: isPublicFile || full.startsWith('/webhooks'),
          });
          pending = null;
          i = j;
        }
      }
    }
  }
  return routes;
}

// Hand overrides for nested / complex bodies the DTO parser misses
const OVERRIDE_BODIES = {
  'POST /companies/:companyId/payment-methods': {
    code: 'PAYPAL',
    name: 'PayPal Audit Enable',
    config: { mode: 'sandbox' },
    credentials: { clientId: 'audit_client', clientSecret: 'audit_secret' },
  },
  'POST /companies/:companyId/finance/transactions/from-order': {
    externalOrderId: '{{externalOrderId}}',
  },
  'PATCH /companies/:companyId/payment-methods/:paymentMethodId': {
    status: 'ACTIVE',
  },
  'POST /auth/login': {
    email: 'admin@saas-erp.local',
    password: 'Admin123!',
  },
  'POST /auth/refresh': { refreshToken: '{{refreshToken}}' },
  'POST /auth/logout': { refreshToken: '{{refreshToken}}' },
  'POST /companies': {
    legalName: 'Audit Company LLC',
    displayName: 'Audit Company',
    slug: 'audit-co-fresh',
    defaultCurrency: 'SAR',
    timezone: 'Asia/Riyadh',
    countryCode: 'SA',
  },
  'POST /companies/:id/branches': {
    code: 'BR-AUDIT-2',
    name: 'Audit Branch 2',
    phone: '+966500000001',
    city: 'Jeddah',
    addressLine: 'Corniche Rd',
  },
  'POST /companies/:companyId/users': {
    fullName: 'Audit User 2',
    email: 'audit.user2.postman@example.com',
    password: 'User123!@',
    roleCode: 'EMPLOYEE_VIEWER',
  },
  'POST /companies/:companyId/integration-center/api-request-logs': {
    method: 'GET',
    path: '/v1/orders',
    statusCode: 200,
    durationMs: 12,
  },
  'POST /companies/:companyId/work/projects/:projectId/members': {
    companyUserId: '{{companyUserId}}',
    projectRole: 'MEMBER',
  },
  'POST /companies/:companyId/projects': {
    providerCode: 'HUNGERSTATION',
    name: 'HungerStation Audit Project',
    environment: 'SANDBOX',
    defaultCurrency: 'SAR',
    credentials: {
      authType: 'API_KEY',
      payload: {
        apiKey: 'demo-key',
        grantedScopes: ['orders:read', 'orders:write', 'catalog:read'],
      },
    },
  },
  'PUT /companies/:companyId/projects/:projectId/credentials': {
    authType: 'API_KEY',
    payload: {
      apiKey: 'rotated-key',
      grantedScopes: ['orders:read', 'orders:write', 'catalog:read'],
    },
  },
  'POST /companies/:companyId/projects/:projectId/operations': {
    capabilityCode: 'ORDER_READ',
    operationType: 'SYNC',
    idempotencyKey: 'idem-audit-001',
    payload: {},
  },
  'POST /companies/:companyId/projects/:projectId/jobs/sync': {
    entityType: 'order',
    fullSync: false,
  },
  'POST /webhooks/:projectId': {
    eventType: 'order.created',
    payload: { id: 'ord_1', total: '50.00', currency: 'SAR' },
    providerEventId: 'evt_1',
  },
  'POST /companies/:companyId/sales/quotes': {
    contactId: '{{contactId}}',
    currency: 'SAR',
    issuedOn: '2026-07-25',
    items: [
      {
        description: 'Service',
        quantity: '1',
        unitPrice: '100.00',
        itemId: '{{itemId}}',
      },
    ],
  },
  'POST /companies/:companyId/sales/invoices': {
    contactId: '{{contactId}}',
    currency: 'SAR',
    issuedOn: '2026-07-25',
    dueOn: '2026-08-25',
    status: 'ISSUED',
    items: [
      {
        description: 'Service',
        quantity: '1',
        unitPrice: '100.00',
        itemId: '{{itemId}}',
      },
    ],
  },
  'POST /companies/:companyId/sales/payments': {
    salesInvoiceId: '{{salesInvoiceId}}',
    amount: '10.00',
    method: 'BANK_TRANSFER',
    paidAt: '2026-07-25T10:00:00.000Z',
  },
  'POST /companies/:companyId/sales/credit-notes': {
    salesInvoiceId: '{{salesInvoiceId}}',
    reason: 'Partial refund',
  },
  'POST /companies/:companyId/payment-methods/:paymentMethodId/charge': {
    amount: '25.00',
    currency: 'SAR',
    description: 'Postman charge stub',
  },
  'PATCH /companies/:id/settings': {
    taxNumber: '300000000000003',
    invoicePrefix: 'INV',
    defaultTaxRate: '15',
    emailFromName: 'Demo Co',
    emailFromAddress: 'billing@demo.local',
    settings: { logoUrl: null },
  },
  'POST /companies/:id/departments': {
    code: 'OPS',
    name: 'Operations',
  },
  'POST /companies/:companyId/subscriptions/change-plan': {
    planCode: 'ENTERPRISE',
  },
  'POST /roles': {
    code: 'CUSTOM_AUDITOR',
    name: 'Custom Auditor',
    permissionCodes: ['audit.read', 'reports.read'],
  },
  'PATCH /roles/:roleId/permissions': {
    permissionCodes: ['audit.read', 'reports.read', 'sales.read'],
  },
  'PATCH /companies/:companyId/sales/quotes/:quoteId/status': {
    status: 'APPROVED',
  },
  'POST /companies/:companyId/purchasing/purchase-orders': {
    supplierId: '{{supplierId}}',
    warehouseId: '{{warehouseId}}',
    currency: 'SAR',
    orderedOn: '2026-07-25',
    items: [
      {
        itemId: '{{itemId}}',
        description: 'Stock',
        quantity: '10',
        unitCost: '5.00',
      },
    ],
  },
  'POST /companies/:companyId/purchasing/purchase-orders/:purchaseOrderId/receive': {
    warehouseId: '{{warehouseId}}',
  },
  'PATCH /companies/:companyId/purchasing/purchase-orders/:purchaseOrderId/status': {
    status: 'APPROVED',
  },
  'POST /companies/:companyId/purchasing/bills': {
    supplierId: '{{supplierId}}',
    billNumber: 'BILL-POSTMAN-TMP',
    currency: 'SAR',
    issuedOn: '2026-07-25',
    status: 'ISSUED',
    items: [
      {
        description: 'Bill line',
        quantity: '1',
        unitCost: '50.00',
        itemId: '{{itemId}}',
      },
    ],
  },
  'POST /companies/:companyId/purchasing/payments': {
    supplierBillId: '{{supplierBillId}}',
    amount: '10.00',
    method: 'BANK_TRANSFER',
    paidAt: '2026-07-25T10:00:00.000Z',
  },
  'POST /companies/:companyId/inventory/movements': {
    warehouseId: '{{warehouseId}}',
    itemId: '{{itemId}}',
    movementType: 'MANUAL_ADJUSTMENT',
    quantity: '10',
    occurredAt: '2026-07-25T10:00:00.000Z',
  },
  'POST /companies/:companyId/inventory/counts': {
    warehouseId: '{{warehouseId}}',
    itemIds: ['{{itemId}}'],
  },
  'PATCH /companies/:companyId/inventory/counts/:stockCountId/lines': {
    itemId: '{{countItemId}}',
    countedQuantity: '12',
  },
  'POST /companies/:companyId/crm/opportunities': {
    contactId: '{{contactId}}',
    title: 'Demo opportunity',
    estimatedValue: '5000.00',
    currency: 'SAR',
  },
  'POST /companies/:companyId/crm/contracts': {
    contactId: '{{contactId}}',
    title: 'Demo contract',
    value: '1000.00',
    currency: 'SAR',
  },
  'POST /companies/:companyId/crm/activities': {
    activityType: 'CALL',
    subject: 'Follow up call',
    contactId: '{{contactId}}',
  },
  'PATCH /companies/:companyId/crm/opportunities/:opportunityId/status': {
    status: 'OPEN',
  },
  'PATCH /companies/:companyId/crm/activities/:activityId/status': {
    status: 'COMPLETED',
  },
  'PATCH /companies/:companyId/crm/contracts/:contractId/status': {
    status: 'ACTIVE',
  },
  'POST /companies/:companyId/finance/bank-accounts': {
    name: 'Main Bank',
    accountType: 'BANK',
    bankName: 'Demo Bank',
    currency: 'SAR',
  },
  'POST /companies/:companyId/finance/transactions': {
    transactionType: 'ADJUSTMENT',
    direction: 'INFLOW',
    amount: '100.00',
    currency: 'SAR',
    description: 'Manual top-up',
  },
  'POST /companies/:companyId/finance/expenses': {
    expenseCategoryId: '{{expenseCategoryId}}',
    description: 'Office supplies',
    amount: '50.00',
    expenseDate: '2026-07-25',
    currency: 'SAR',
    status: 'DRAFT',
  },
  'PATCH /companies/:companyId/finance/expenses/:expenseId/status': {
    status: 'APPROVED',
  },
  'POST /companies/:companyId/hr/leaves': {
    employeeId: '{{employeeId}}',
    leaveType: 'ANNUAL',
    startsOn: '2026-08-01',
    endsOn: '2026-08-05',
    requestedDays: '5',
  },
  'PATCH /companies/:companyId/hr/leaves/:leaveId/decision': {
    status: 'APPROVED',
  },
  'POST /companies/:companyId/hr/attendance': {
    employeeId: '{{employeeId}}',
    attendanceDate: '2026-07-25',
    status: 'PRESENT',
  },
  'PATCH /companies/:companyId/hr/payroll-runs/:payrollRunId/status': {
    status: 'DRAFT',
  },
  'POST /companies/:companyId/hr/payroll-runs': {
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
  },
  'POST /companies/:companyId/inventory/items': {
    name: 'Demo Item',
    sku: 'SKU-DEMO-2',
    unitId: '{{unitId}}',
    minStock: '5',
  },
  'POST /companies/:companyId/work/projects': {
    name: 'Postman Work Project',
    code: 'WP-POSTMAN',
    budget: '10000.00',
    currency: 'SAR',
  },
  'PATCH /companies/:companyId/work/projects/:projectId/status': {
    status: 'ACTIVE',
    progressPercent: 10,
  },
  'POST /companies/:companyId/work/projects/:projectId/phases': {
    name: 'Postman Phase',
    position: 99,
  },
  'PATCH /companies/:companyId/work/tasks/:taskId/status': {
    status: 'TODO',
  },
  'POST /companies/:companyId/notebook/notes': {
    title: 'Demo note',
    body: 'Note body',
    status: 'OPEN',
    priority: 'MEDIUM',
  },
  'PATCH /companies/:companyId/notebook/notes/:noteId': {
    title: 'Updated note',
    status: 'IN_PROGRESS',
  },
  'POST /companies/:companyId/marketing/posts': {
    content: 'Hello market',
    channel: 'INSTAGRAM',
    title: 'Launch',
    status: 'DRAFT',
    media: [
      {
        mediaType: 'IMAGE',
        fileName: 'launch.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: '2048',
        checksumSha256: 'b'.repeat(64),
      },
    ],
  },
  'PATCH /companies/:companyId/marketing/posts/:postId': {
    title: 'Launch updated',
    content: 'Updated market copy',
  },
  'POST /companies/:companyId/marketing/posts/:postId/schedule': {
    scheduledAt: '2030-01-15T10:00:00.000Z',
  },
  'PATCH /companies/:companyId/marketing/posts/:postId/reschedule': {
    scheduledAt: '2030-01-16T14:30:00.000Z',
  },
  'POST /companies/:companyId/marketing/posts/:postId/media': {
    mediaType: 'VIDEO',
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    sizeBytes: '4096',
    checksumSha256: 'c'.repeat(64),
  },
  'POST /companies/:companyId/marketing/connections': {
    channel: 'FACEBOOK',
    displayName: 'Audit FB Page',
    externalAccountId: 'fb-audit-1',
    status: 'DISCONNECTED',
  },
  'PATCH /companies/:companyId/marketing/connections/:connectionId/status': {
    status: 'DISCONNECTED',
  },
  'POST /companies/:companyId/ai/products/generate': {
    prompt: 'حذاء رياضي رجالي أسود',
    language: 'ar',
    targetCurrency: 'SAR',
  },
  'POST /companies/:companyId/ai/products/improve-text': {
    text: 'حذاء جيد للرياضة',
    goal: 'marketing',
    language: 'ar',
  },
  'POST /companies/:companyId/ai/assistant/ask': {
    question: 'ما أكثر المنتجات مبيعا هذا الشهر؟',
  },
  'POST /companies/:companyId/ai/reports/analyze': {
    scope: 'executive',
  },
  'POST /companies/:companyId/ai/notes/analyze': {
    text: 'قررنا اعتماد عرض جديد. يجب متابعة المخزون وتواصل مع المورد خلال أسبوع.',
  },
  'POST /companies/:companyId/ai/notes/search': {
    query: 'مخزون',
    limit: 10,
  },
  'POST /companies/:companyId/ai/marketing/generate': {
    topic: 'إطلاق مجموعة الأحذية الرياضية',
    channel: 'INSTAGRAM',
    variants: 3,
  },
  'POST /companies/:companyId/automation/rules': {
    name: 'Notify on invoice',
    module: 'sales',
    triggerEvent: 'invoice.created',
    conditions: [],
    actions: [{ type: 'NOTIFY', title: 'New invoice' }],
  },
  'PATCH /companies/:companyId/automation/rules/:ruleId/status': {
    status: 'ACTIVE',
  },
  'PATCH /companies/:companyId/integration-center/api-keys/:apiKeyId/status': {
    status: 'ACTIVE',
  },
  'PATCH /companies/:companyId/integration-center/webhooks/:webhookId/status': {
    status: 'ACTIVE',
  },
  'POST /companies/:companyId/automation/rules/:ruleId/execute': {
    entityType: 'sales_invoice',
    entityId: '{{salesInvoiceId}}',
  },
  'POST /companies/:companyId/crm/pipelines/default': {},
  'POST /companies/:companyId/inventory/counts/:stockCountId/approve': {},
  'POST /companies/:companyId/marketing/posts/:postId/publish': {},
  'POST /admin/retention/purge': null,
  'POST /companies/:companyId/work/projects/:projectId/tasks': {
    title: 'First task',
    description: 'Do something',
    priority: 'MEDIUM',
  },
  'POST /companies/:companyId/messaging/send': {
    messagingChannelId: '{{messagingChannelId}}',
    recipient: 'audit@example.com',
    subject: 'Audit ping',
    body: 'Hello from API audit',
  },
  'POST /companies/:companyId/integration-center/api-keys': {
    name: 'Partner Key',
    scopes: ['read', 'write'],
    rateLimitPerMin: 60,
  },
  'POST /companies/:companyId/integration-center/webhooks': {
    name: 'Orders Hook',
    targetUrl: 'https://example.com/hooks/orders',
    events: ['order.created'],
  },
  'POST /companies/:companyId/integration-center/webhooks/:webhookId/deliver': {
    eventType: 'order.created',
    payload: { id: '1' },
  },
  'POST /companies/:companyId/attachments': {
    entityType: 'sales_invoice',
    entityId: '{{salesInvoiceId}}',
    fileName: 'note.txt',
    mimeType: 'text/plain',
    sizeBytes: '11',
    contentBase64: Buffer.from('hello world').toString('base64'),
  },
  'POST /companies/:companyId/notifications/devices': {
    token: 'fcm_demo_token_xxxxxxxxxxxxxxxxxxxx',
    platform: 'WEB',
    deviceName: 'Postman',
  },
  'POST /companies/:companyId/notifications/send': {
    userId: '{{userId}}',
    type: 'system',
    title: 'Hello',
    body: 'Firebase notification test',
    data: { source: 'postman' },
    sendPush: true,
  },
  'POST /companies/:companyId/ai-usage': {
    module: 'notebook',
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputTokens: 100,
    outputTokens: 50,
    estimatedCost: '0.002',
  },
  'POST /sandbox/items': {
    name: 'Audit Probe Item',
    unitPrice: '10.00',
  },
  'POST /sandbox/encrypt-roundtrip': {
    value: 'secret-value',
  },
};

function toPostmanUrl(full) {
  const parts = full.replace(/^\//, '').split('/').filter(Boolean);
  const variables = [];
  const path = parts.map((p) => {
    if (p.startsWith(':')) {
      const key = p.slice(1);
      let varName = key;
      if (key === 'code' && full.startsWith('/plans/')) varName = 'planCode';
      if (key === 'code' && full.includes('/providers/')) varName = 'providerCode';
      variables.push({ key, value: `{{${varName}}}` });
      return `{{${varName}}}`;
    }
    return p;
  });
  let rawPath = full;
  if (full.startsWith('/plans/')) {
    rawPath = full.replace(':code', '{{planCode}}');
  } else if (full.includes('/providers/')) {
    rawPath = full.replace(':code', '{{providerCode}}');
  } else {
    rawPath = full.replace(/:([A-Za-z_]+)/g, '{{$1}}');
  }
  return {
    raw: `{{baseUrl}}${rawPath}`,
    host: ['{{baseUrl}}'],
    path,
  };
}

function buildCollection(routes) {
  const folders = new Map();
  for (const r of routes) {
    const folder = folderFromPath(r.full, r.file);
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(r);
  }

  const item = [...folders.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, rs]) => ({
      name,
      item: rs.map((r) => {
        const headers = [];
        if (!r.public) {
          headers.push({
            key: 'Authorization',
            value: 'Bearer {{accessToken}}',
            type: 'text',
          });
        }
        if (
          r.full.includes(':companyId') ||
          r.full.includes('/companies/') ||
          r.full.startsWith('/sandbox')
        ) {
          headers.push({
            key: 'x-company-id',
            value: '{{companyId}}',
            type: 'text',
          });
        }
        if (r.body != null) {
          headers.push({
            key: 'Content-Type',
            value: 'application/json',
            type: 'text',
          });
        }

        const request = {
          method: r.method,
          header: headers,
          url: toPostmanUrl(r.full),
          description:
            (r.perm ? `Permission: \`${r.perm}\`\n\n` : '') +
            `Handler: \`${r.name}\` · ${r.file}`,
        };

        if (r.body != null) {
          request.body = {
            mode: 'raw',
            raw: JSON.stringify(r.body, null, 2),
            options: { raw: { language: 'json' } },
          };
        } else if (
          ['POST', 'PUT', 'PATCH'].includes(r.method) &&
          r.body === null
        ) {
          // explicitly no body
        } else if (['POST', 'PUT', 'PATCH'].includes(r.method)) {
          // keep without body for endpoints that don't use @Body
        }

        if (r.query && Object.keys(r.query).length) {
          // Prefer query array only (avoid duplicating into raw which breaks IsString via arrays)
          request.url.query = Object.entries(r.query).map(([key, value]) => ({
            key,
            value: String(value),
          }));
        }

        // login test script to save tokens
        const events = [];
        if (r.full === '/auth/login' && r.method === 'POST') {
          events.push({
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'if (pm.response.code === 200 || pm.response.code === 201) {',
                '  const j = pm.response.json();',
                '  const token = j.accessToken || j.access_token;',
                '  const refresh = j.refreshToken || j.refresh_token;',
                '  if (token) pm.collectionVariables.set("accessToken", token);',
                '  if (refresh) pm.collectionVariables.set("refreshToken", refresh);',
                '  if (j.user && j.user.companyId) pm.collectionVariables.set("companyId", j.user.companyId);',
                '  if (j.companyId) pm.collectionVariables.set("companyId", j.companyId);',
                '}',
              ],
            },
          });
        }

        return {
          name: `${r.method} ${r.full}`,
          request,
          event: events.length ? events : undefined,
          response: [],
        };
      }),
    }));

  return {
    info: {
      _postman_id: 'saas-erp-backend-api',
      name: 'SaaS ERP Backend API',
      description:
        'Full NestJS backend collection.\n\n1. Set `baseUrl` (default http://127.0.0.1:3000)\n2. Run **Auth → POST /auth/login** (saves accessToken)\n3. Set `companyId` (seed demo: 019f989b-6d98-7429-80ae-32d0c1cbf7f9)\n4. Replace other `{{...Id}}` vars as you create records.\n\nDemo login: admin@saas-erp.local / Admin123!',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: 'http://127.0.0.1:3000' },
      { key: 'accessToken', value: '' },
      { key: 'refreshToken', value: '' },
      {
        key: 'companyId',
        value: '019f989b-6d98-7429-80ae-32d0c1cbf7f9',
      },
      { key: 'projectId', value: '' },
      { key: 'contactId', value: '' },
      { key: 'itemId', value: '' },
      { key: 'warehouseId', value: '' },
      { key: 'supplierId', value: '' },
      { key: 'salesInvoiceId', value: '' },
      { key: 'supplierBillId', value: '' },
      { key: 'quoteId', value: '' },
      { key: 'purchaseOrderId', value: '' },
      { key: 'employeeId', value: '' },
      { key: 'messagingChannelId', value: '' },
      { key: 'messageTemplateId', value: '' },
      { key: 'noteId', value: '' },
      { key: 'ruleId', value: '' },
      { key: 'webhookId', value: '' },
      { key: 'apiKeyId', value: '' },
      { key: 'expenseId', value: '' },
      { key: 'stockCountId', value: '' },
      { key: 'countItemId', value: '' },
      { key: 'phaseId', value: '' },
      { key: 'taskId', value: '' },
      { key: 'leaveId', value: '' },
      { key: 'payrollRunId', value: '' },
      { key: 'postId', value: '' },
      { key: 'mediaId', value: '' },
      { key: 'connectionId', value: '' },
      { key: 'orderId', value: '' },
      { key: 'externalOrderId', value: '' },
      { key: 'activityId', value: '' },
      { key: 'contractId', value: '' },
      { key: 'opportunityId', value: '' },
      { key: 'pipelineId', value: '' },
      { key: 'sampleId', value: '' },
      { key: 'module', value: 'sales' },
      { key: 'entity', value: 'orders' },
      { key: 'code', value: 'ENTERPRISE' },
      { key: 'planCode', value: 'ENTERPRISE' },
      { key: 'providerCode', value: 'HUNGERSTATION' },
      { key: 'paymentMethodId', value: '' },
      { key: 'companyUserId', value: '' },
      { key: 'id', value: '019f989b-6d98-7429-80ae-32d0c1cbf7f9' },
    ],
    item,
  };
}

const routes = parseControllers();
// dedupe by method+full
const seen = new Set();
const unique = [];
for (const r of routes) {
  const k = `${r.method} ${r.full}`;
  if (seen.has(k)) continue;
  seen.add(k);
  if (Object.prototype.hasOwnProperty.call(OVERRIDE_BODIES, k)) {
    r.body = OVERRIDE_BODIES[k];
  }
  unique.push(r);
}

const collection = buildCollection(unique);
const outDir = path.join('postman');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'SaaS_ERP_Backend_API.postman_collection.json');
fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));
console.log('Wrote', outFile);
console.log('Endpoints:', unique.length);
console.log('Folders:', collection.item.length);
