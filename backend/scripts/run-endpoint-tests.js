/**
 * Runs every request in the Postman collection against the local API.
 * Fills path variables from login + list responses when possible.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const COMPANY_ID =
  process.env.COMPANY_ID || '019f989b-6d98-7429-80ae-32d0c1cbf7f9';

const vars = {
  baseUrl: BASE,
  companyId: COMPANY_ID,
  accessToken: '',
  refreshToken: '',
  module: 'sales',
  entity: 'orders',
  code: 'ENTERPRISE',
  planCode: 'ENTERPRISE',
  providerCode: 'HUNGERSTATION',
  countItemId: '',
  id: COMPANY_ID,
};

function substitute(str) {
  if (!str) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined && vars[k] !== '' ? String(vars[k]) : `missing_${k}`,
  );
}

function flatten(items, folder = '') {
  const out = [];
  for (const it of items) {
    if (it.item) out.push(...flatten(it.item, it.name));
    else out.push({ folder, ...it });
  }
  return out;
}

async function req(method, urlPath, { headers = {}, body, query } = {}) {
  let url = substitute(urlPath || '');
  if (url.includes('{{baseUrl}}')) {
    url = substitute(url);
  }
  if (!/^https?:\/\//i.test(url)) {
    const pathPart = url.startsWith('/') ? url : `/${url}`;
    url = `${BASE}${pathPart}`;
  }
  url = url.replace(`${BASE}${BASE}`, BASE);

  if (query && query.length) {
    // If raw URL already has a query string, don't append again (duplicates become arrays)
    if (!url.includes('?')) {
      const qs = new URLSearchParams();
      for (const q of query) {
        if (q.disabled) continue;
        qs.set(q.key, substitute(String(q.value ?? '')));
      }
      const s = qs.toString();
      if (s) url += '?' + s;
    }
  }

  const hdrs = {};
  for (const h of headers) {
    if (h.disabled) continue;
    hdrs[h.key] = substitute(h.value);
  }
  if (vars.accessToken && !hdrs.Authorization) {
    hdrs.Authorization = `Bearer ${vars.accessToken}`;
  }
  if (
    url.includes('/companies/') ||
    url.includes('/sandbox/') ||
    (hdrs['x-company-id'] !== undefined && hdrs['x-company-id'] !== '')
  ) {
    hdrs['x-company-id'] = hdrs['x-company-id'] || vars.companyId;
  }

  const init = { method, headers: hdrs };
  if (body && body.mode === 'raw' && body.raw != null && method !== 'GET') {
    hdrs['Content-Type'] = hdrs['Content-Type'] || 'application/json';
    let raw = substitute(body.raw);
    const stamp = Date.now().toString(36);
    // Unique codes for re-runnable create samples
    if (url.match(/\/companies\/?(\?|$)/) && method === 'POST') {
      raw = raw.replace(/"slug"\s*:\s*"[^"]+"/, `"slug":"audit-co-${stamp}"`);
    }
    if (url.includes('/users') && method === 'POST') {
      raw = raw.replace(
        /"email"\s*:\s*"[^"]+"/,
        `"email":"audit.user.${stamp}@example.com"`,
      );
    }
    if (method === 'POST') {
      raw = raw
        .replace(/"billNumber"\s*:\s*"[^"]+"/, `"billNumber":"BILL-${stamp}"`)
        .replace(/"quoteNumber"\s*:\s*"[^"]+"/, `"quoteNumber":"Q-${stamp}"`)
        .replace(/"paymentNumber"\s*:\s*"[^"]+"/, `"paymentNumber":"PAY-${stamp}"`)
        .replace(/"poNumber"\s*:\s*"[^"]+"/, `"poNumber":"PO-${stamp}"`)
        .replace(/"employeeNumber"\s*:\s*"[^"]+"/, `"employeeNumber":"EMP-${stamp}"`)
        .replace(/"sku"\s*:\s*"[^"]+"/, `"sku":"SKU-${stamp}"`)
        .replace(/"contractNumber"\s*:\s*"[^"]+"/, `"contractNumber":"CTR-${stamp}"`)
        .replace(/"idempotencyKey"\s*:\s*"[^"]+"/, `"idempotencyKey":"idem-${stamp}"`);
      if (url.includes('/branches')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"BR-${stamp}"`);
      }
      if (url.includes('/inventory/categories') || url.includes('/inventory/units')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"C-${stamp}"`);
      }
      if (url.includes('/inventory/warehouses')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"WH-${stamp}"`);
      }
      if (url.includes('/work/projects') && !url.includes('/phases') && !url.includes('/members')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"WP-${stamp}"`);
      }
      if (url.includes('/purchasing/suppliers')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"SUP-${stamp}"`);
      }
      if (url.includes('/finance/expense-categories') || url.includes('/notebook/categories')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"X-${stamp}"`);
      }
      if (url.includes('/messaging/channels')) {
        raw = raw.replace(/"name"\s*:\s*"[^"]+"/, `"name":"Channel ${stamp}"`);
      }
      if (url.includes('/messaging/templates')) {
        raw = raw.replace(/"code"\s*:\s*"[^"]+"/, `"code":"TPL-${stamp}"`);
      }
      if (url.includes('/projects') && !url.includes('/jobs') && !url.includes('/operations') && !url.includes('/mirrors') && !url.includes('/credentials') && url.match(/\/projects\/?$/)) {
        raw = raw.replace(/"name"\s*:\s*"[^"]+"/, `"name":"HS Audit ${stamp}"`);
      }
      if (url.includes('/inventory/items')) {
        raw = raw
          .replace(/"sku"\s*:\s*"[^"]+"/, `"sku":"SKU-${stamp}"`)
          .replace(/"name"\s*:\s*"[^"]+"/, `"name":"Item ${stamp}"`);
      }
      if (url.includes('/crm/contracts')) {
        raw = raw.replace(/"title"\s*:\s*"[^"]+"/, `"title":"Contract ${stamp}"`);
      }
      if (url.includes('/sales/quotes') && !url.includes('/convert')) {
        raw = raw.replace(
          /"issuedOn"\s*:\s*"[^"]+"/,
          `"issuedOn":"2026-07-${String((Date.now() % 27) + 1).padStart(2, '0')}"`,
        );
      }
      if (url.includes('/payment-methods') && !url.includes('/payment-methods/')) {
        raw = raw.replace(/"name"\s*:\s*"[^"]+"/, `"name":"Gateway ${stamp}"`);
      }
      if (url.includes('/hr/payroll-runs')) {
        const start = new Date(Date.UTC(2030, Date.now() % 12, 1 + (Date.now() % 20)));
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 10);
        const fmt = (d) => d.toISOString().slice(0, 10);
        raw = raw.replace(/"periodStart"\s*:\s*"[^"]+"/, `"periodStart":"${fmt(start)}"`);
        raw = raw.replace(/"periodEnd"\s*:\s*"[^"]+"/, `"periodEnd":"${fmt(end)}"`);
      }
      if (url.includes('/work/projects') && url.includes('/phases')) {
        raw = raw.replace(/"name"\s*:\s*"[^"]+"/, `"name":"Phase ${stamp}"`);
        raw = raw.replace(/"position"\s*:\s*\d+/, `"position":${Date.now() % 10000}`);
      }
      if (url.includes('/sandbox/items')) {
        raw = raw.replace(
          /"name"\s*:\s*"[^"]+"/,
          `"name":"Probe ${stamp}-${Math.random().toString(36).slice(2, 8)}"`,
        );
      }
    }
    init.body = raw;
  }

  const started = Date.now();
  let status = 0;
  let text = '';
  let json = null;
  try {
    const res = await fetch(url, init);
    status = res.status;
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: e.message,
      url,
      bodyPreview: '',
    };
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    ms: Date.now() - started,
    url,
    json,
    bodyPreview: text.slice(0, 240).replace(/\s+/g, ' '),
  };
}

function harvestIds(json, hint = '') {
  if (!json) return;
  const take = (obj, keys, varName) => {
    if (!obj || vars[varName]) return;
    for (const k of keys) {
      if (obj[k]) {
        vars[varName] = obj[k];
        return;
      }
    }
  };
  const first = Array.isArray(json) ? json[0] : json?.data?.[0] || json;
  if (!first || typeof first !== 'object') return;

  // generic id harvest by shape / hint
  if (hint.includes('contact') || first.contactType)
    take(first, ['id'], 'contactId');
  if (hint.includes('invoice') || first.invoiceNumber)
    take(first, ['id'], 'salesInvoiceId');
  if (hint.includes('quote') || first.quoteNumber)
    take(first, ['id'], 'quoteId');
  if (hint.includes('supplier') && !hint.includes('bill'))
    take(first, ['id'], 'supplierId');
  if (hint.includes('bill') || first.billNumber)
    take(first, ['id'], 'supplierBillId');
  if (hint.includes('purchase-order') || first.poNumber)
    take(first, ['id'], 'purchaseOrderId');
  if (hint.includes('item') && first.sku) take(first, ['id'], 'itemId');
  if (hint.includes('warehouse')) take(first, ['id'], 'warehouseId');
  if (hint.includes('employee')) take(first, ['id'], 'employeeId');
  if (hint.includes('project') && hint.includes('work'))
    take(first, ['id'], 'workProjectId');
  // integration projectId is set only in bootstrapLists (ACTIVE + mirrors)
  if (hint.includes('note')) take(first, ['id'], 'noteId');
  if (hint.includes('rule')) take(first, ['id'], 'ruleId');
  if (hint.includes('webhook') && !hint.includes('deliver'))
    take(first, ['id'], 'webhookId');
  if (hint.includes('api-key')) take(first, ['id'], 'apiKeyId');
  if (hint.includes('expense') && !hint.includes('categor'))
    take(first, ['id'], 'expenseId');
  if (hint.includes('channel')) take(first, ['id'], 'messagingChannelId');
  if (hint.includes('template')) take(first, ['id'], 'messageTemplateId');
  if (hint.includes('task')) take(first, ['id'], 'taskId');
  if (hint.includes('phase')) take(first, ['id'], 'phaseId');
  if (hint.includes('leave')) take(first, ['id'], 'leaveId');
  if (hint.includes('payroll')) take(first, ['id'], 'payrollRunId');
  if (hint.includes('post') && !hint.includes('media'))
    take(first, ['id'], 'postId');
  if (hint.includes('media')) take(first, ['id'], 'mediaId');
  if (hint.includes('connection')) take(first, ['id'], 'connectionId');
  if (hint.includes('opportunit')) take(first, ['id'], 'opportunityId');
  if (hint.includes('pipeline')) take(first, ['id'], 'pipelineId');
  if (hint.includes('activit')) take(first, ['id'], 'activityId');
  if (hint.includes('contract')) take(first, ['id'], 'contractId');
  if (hint.includes('count')) take(first, ['id'], 'stockCountId');
  if (hint.includes('order') && hint.includes('mirror'))
    take(first, ['id'], 'orderId');
  if (hint.includes('payment-method') || first.paymentGateway)
    take(first, ['id'], 'paymentMethodId');
  if (hint.includes('users') || first.userId)
    take(first, ['id'], 'companyUserId');
  if (hint === 'phases' || hint.includes('/phases'))
    take(first, ['id'], 'phaseId');

  // also harvest from create responses (single object with id)
  if (!Array.isArray(json) && json.id) {
    if (hint.includes('POST') && hint.includes('contacts'))
      vars.contactId = json.id;
    if (hint.includes('POST') && hint.includes('invoices'))
      vars.salesInvoiceId = json.id;
    if (hint.includes('POST') && hint.includes('quotes')) vars.quoteId = json.id;
    if (hint.includes('POST') && hint.includes('items')) vars.itemId = json.id;
    if (hint.includes('POST') && hint.includes('warehouses'))
      vars.warehouseId = json.id;
    if (hint.includes('POST') && hint.includes('suppliers'))
      vars.supplierId = json.id;
    if (hint.includes('POST') && hint.includes('employees'))
      vars.employeeId = json.id;
    if (hint.includes('POST') && hint.includes('notes')) vars.noteId = json.id;
    if (hint.includes('POST') && hint.includes('rules')) vars.ruleId = json.id;
    if (hint.includes('POST') && hint.includes('channels'))
      vars.messagingChannelId = json.id;
    if (hint.includes('POST') && hint.includes('templates'))
      vars.messageTemplateId = json.id;
    if (hint.includes('POST') && hint.includes('webhooks'))
      vars.webhookId = json.id;
    if (hint.includes('POST') && hint.includes('api-keys'))
      vars.apiKeyId = json.id;
    if (hint.includes('POST') && hint.includes('work/projects'))
      vars.workProjectId = json.id;
    if (hint.includes('POST') && hint.includes('marketing/posts') && !hint.includes('media'))
      vars.postId = json.id;
    if (hint.includes('POST') && hint.includes('marketing/posts') && hint.includes('media'))
      vars.mediaId = json.id;
    if (hint.includes('POST') && hint.includes('marketing/connections'))
      vars.connectionId = json.id;
    // Do not overwrite integration projectId/orderId from POST /projects creates
  }

  if (json.accessToken || json.access_token) {
    vars.accessToken = json.accessToken || json.access_token;
  }
  if (json.refreshToken || json.refresh_token) {
    vars.refreshToken = json.refreshToken || json.refresh_token;
  }
  if (json.companyId) vars.companyId = json.companyId;
  if (json.user?.companyId) vars.companyId = json.user.companyId;
  // login may return companies array
  if (Array.isArray(json.companies) && json.companies[0]?.id) {
    vars.companyId = json.companies[0].id;
  }
}

function classify(r, result) {
  const name = r.name || '';
  if (result.error) return 'ERROR';
  if (result.ok) return 'PASS';
  // missing path vars
  if (result.url.includes('missing_')) return 'SKIP_MISSING_VAR';
  if (result.status === 401 || result.status === 403) return 'AUTH';
  if (result.status === 404) return 'NOT_FOUND';
  if (result.status === 400 || result.status === 422) return 'BAD_REQUEST';
  if (result.status === 409) return 'CONFLICT';
  if (result.status >= 500) return 'SERVER_ERROR';
  return 'FAIL';
}

function expectShapeOk(name, json, status) {
  if (status < 200 || status >= 300) return null;
  if (name.includes('/health') && !name.includes('/db')) {
    return json && (json.status === 'ok' || json.ok === true || json.status)
      ? 'shape_ok'
      : 'shape_warn';
  }
  if (name.includes('/auth/login')) {
    return json && (json.accessToken || json.access_token)
      ? 'shape_ok'
      : 'shape_bad';
  }
  if (name.includes('/reports/executive')) {
    return json && json.sales && json.finance ? 'shape_ok' : 'shape_bad';
  }
  if (Array.isArray(json)) return 'shape_ok_array';
  if (json && typeof json === 'object') return 'shape_ok_object';
  return 'shape_empty';
}

async function bootstrapLists() {
  const lists = [
    ['GET', `/companies/${vars.companyId}/crm/contacts`, 'contacts'],
    ['GET', `/companies/${vars.companyId}/sales/invoices`, 'invoices'],
    ['GET', `/companies/${vars.companyId}/sales/quotes`, 'quotes'],
    ['GET', `/companies/${vars.companyId}/inventory/items`, 'items'],
    ['GET', `/companies/${vars.companyId}/inventory/warehouses`, 'warehouses'],
    ['GET', `/companies/${vars.companyId}/purchasing/suppliers`, 'suppliers'],
    ['GET', `/companies/${vars.companyId}/purchasing/bills`, 'bills'],
    [
      'GET',
      `/companies/${vars.companyId}/purchasing/purchase-orders`,
      'purchase-orders',
    ],
    ['GET', `/companies/${vars.companyId}/hr/employees`, 'employees'],
    ['GET', `/companies/${vars.companyId}/work/projects`, 'work-projects'],
    ['GET', `/companies/${vars.companyId}/projects`, 'integration-projects'],
    ['GET', `/companies/${vars.companyId}/notebook/notes`, 'notes'],
    ['GET', `/companies/${vars.companyId}/automation/rules`, 'rules'],
    ['GET', `/companies/${vars.companyId}/messaging/channels`, 'channels'],
    ['GET', `/companies/${vars.companyId}/messaging/templates`, 'templates'],
    [
      'GET',
      `/companies/${vars.companyId}/integration-center/webhooks`,
      'webhooks',
    ],
    [
      'GET',
      `/companies/${vars.companyId}/integration-center/api-keys`,
      'api-keys',
    ],
    ['GET', `/companies/${vars.companyId}/finance/expenses`, 'expenses'],
    ['GET', `/companies/${vars.companyId}/marketing/posts`, 'posts'],
    ['GET', `/companies/${vars.companyId}/marketing/connections`, 'connections'],
    ['GET', `/companies/${vars.companyId}/crm/opportunities`, 'opportunities'],
    ['GET', `/companies/${vars.companyId}/crm/pipelines`, 'pipelines'],
    ['GET', `/companies/${vars.companyId}/inventory/counts`, 'counts'],
    ['GET', `/companies/${vars.companyId}/hr/leaves`, 'leaves'],
    ['GET', `/companies/${vars.companyId}/hr/payroll-runs`, 'payroll'],
    ['GET', `/companies/${vars.companyId}/finance/expense-categories`, 'expense-categories'],
    ['GET', `/companies/${vars.companyId}/inventory/units`, 'units'],
    ['GET', `/companies/${vars.companyId}/payment-methods`, 'payment-methods'],
    ['GET', `/companies/${vars.companyId}/users`, 'users'],
    ['GET', `/companies/${vars.companyId}/crm/activities`, 'activities'],
  ];
  for (const [method, p, hint] of lists) {
    const res = await req(method, p, {
      headers: [
        { key: 'Authorization', value: `Bearer ${vars.accessToken}` },
        { key: 'x-company-id', value: vars.companyId },
      ],
    });
    if (hint === 'integration-projects' && Array.isArray(res.json) && res.json.length) {
      // Prefer ACTIVE project that actually has mirrored orders (HungerStation Riyadh)
      let chosen =
        res.json.find(
          (row) =>
            row.status === 'ACTIVE' &&
            String(row.name || '').toLowerCase().includes('hungerstation riyadh'),
        ) ||
        res.json.find(
          (row) =>
            row.status === 'ACTIVE' &&
            String(row.name || '').toLowerCase().includes('hungerstation'),
        ) ||
        res.json.find((row) => row.status === 'ACTIVE') ||
        res.json[0];
      vars.integrationProjectId = chosen.id;
      vars.projectId = chosen.id;

      const candidates = [];
      for (const row of res.json) {
        if (row.status === 'ACTIVE') candidates.push(row.id);
      }
      if (!candidates.includes(chosen.id)) candidates.unshift(chosen.id);

      for (const pid of candidates) {
        const mirrors = await req(
          'GET',
          `/companies/${vars.companyId}/projects/${pid}/mirrors/orders`,
          {
            headers: [
              { key: 'Authorization', value: `Bearer ${vars.accessToken}` },
              { key: 'x-company-id', value: vars.companyId },
            ],
          },
        );
        const rows = Array.isArray(mirrors.json)
          ? mirrors.json
          : mirrors.json?.data || [];
        if (rows[0]?.id) {
          vars.integrationProjectId = pid;
          vars.projectId = pid;
          vars.orderId = rows[0].id;
          vars.externalOrderId = rows[0].id;
          break;
        }
      }
    } else if (hint === 'work-projects' && Array.isArray(res.json) && res.json[0]?.id) {
      vars.workProjectId = res.json[0].id;
      if (Array.isArray(res.json[0].phases) && res.json[0].phases[0]?.id) {
        vars.phaseId = res.json[0].phases[0].id;
      }
    } else if (hint === 'counts' && Array.isArray(res.json)) {
      const open = res.json.find((row) =>
        ['DRAFT', 'IN_PROGRESS', 'SUBMITTED'].includes(row.status),
      );
      const chosen = open || res.json[0];
      vars.stockCountId = chosen?.id;
      const lineItemId =
        chosen?.items?.[0]?.itemId ||
        chosen?.items?.[0]?.item?.id;
      if (lineItemId) vars.countItemId = lineItemId;
    } else if (hint === 'bills' && Array.isArray(res.json)) {
      const payable = res.json.find(
        (row) =>
          ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(row.status) &&
          Number(row.balanceDue) > 0,
      );
      vars.supplierBillId = (payable || res.json[0])?.id;
    } else if (hint === 'posts' && Array.isArray(res.json)) {
      const draft = res.json.find((row) =>
        ['DRAFT', 'READY', 'SCHEDULED', 'FAILED'].includes(row.status),
      );
      const chosen = draft || res.json[0];
      vars.postId = chosen?.id;
      const mediaId = chosen?.media?.[0]?.id;
      if (mediaId) vars.mediaId = mediaId;
    } else if (hint === 'warehouses' && Array.isArray(res.json)) {
      const main = res.json.find((row) => row.code === 'MAIN') || res.json[0];
      vars.warehouseId = main?.id;
    } else {
      harvestIds(res.json, hint);
    }
    if (hint === 'expense-categories' && Array.isArray(res.json) && res.json[0]?.id) {
      vars.expenseCategoryId = res.json[0].id;
    }
    if (hint === 'units' && Array.isArray(res.json) && res.json[0]?.id) {
      vars.unitId = res.json[0].id;
    }
    if (hint === 'payment-methods' && Array.isArray(res.json) && res.json[0]?.id) {
      vars.paymentMethodId = res.json[0].id;
    }
    if (hint === 'users' && Array.isArray(res.json) && res.json[0]?.id) {
      vars.companyUserId = res.json[0].id;
    }
  }
}

async function main() {
  const collection = JSON.parse(
    fs.readFileSync(
      path.join('postman', 'SaaS_ERP_Backend_API.postman_collection.json'),
      'utf8',
    ),
  );

  // login first
  const login = await req('POST', '/auth/login', {
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        email: 'admin@saas-erp.local',
        password: 'Admin123!',
        companyId: COMPANY_ID,
      }),
    },
  });
  harvestIds(login.json, 'POST /auth/login');
  if (!vars.accessToken) {
    console.error('LOGIN FAILED', login.status, login.bodyPreview);
    process.exit(1);
  }
  console.log('Logged in. companyId=', vars.companyId);

  await bootstrapLists();
  console.log('Harvested vars:', {
    contactId: vars.contactId,
    itemId: vars.itemId,
    warehouseId: vars.warehouseId,
    salesInvoiceId: vars.salesInvoiceId,
    supplierId: vars.supplierId,
    supplierBillId: vars.supplierBillId,
    stockCountId: vars.stockCountId,
    countItemId: vars.countItemId,
    projectId: vars.projectId,
    integrationProjectId: vars.integrationProjectId,
    workProjectId: vars.workProjectId,
    orderId: vars.orderId,
    externalOrderId: vars.externalOrderId,
    employeeId: vars.employeeId,
    noteId: vars.noteId,
  });

  const requests = flatten(collection.item);
  // Prefer safe order: GET before mutating where same path — keep collection order but run login-like first already done
  const results = [];

  for (const r of requests) {
    const method = r.request.method;
    const rawUrl = r.request.url?.raw || '';
    const isWork = String(r.name).includes('/work/');
    const isIntegration =
      !isWork &&
      (String(r.name).includes('/projects') ||
        String(r.name).includes('/webhooks/'));

    const projectForRequest = isWork
      ? vars.workProjectId || vars.projectId
      : isIntegration
        ? vars.integrationProjectId || vars.projectId
        : vars.projectId;

    const previousProjectId = vars.projectId;
    vars.projectId = projectForRequest;

    const frozen = {
      integrationProjectId: vars.integrationProjectId,
      workProjectId: vars.workProjectId,
      orderId: vars.orderId,
      externalOrderId: vars.externalOrderId,
      countItemId: vars.countItemId,
      stockCountId: vars.stockCountId,
    };

    const result = await req(method, rawUrl, {
      headers: r.request.header || [],
      body: r.request.body,
      query: r.request.url?.query,
    });

    harvestIds(result.json, `${method} ${r.name}`);

    // Keep bootstrap integration/work IDs stable across the suite
    vars.integrationProjectId = frozen.integrationProjectId;
    vars.workProjectId = frozen.workProjectId || vars.workProjectId;
    vars.orderId = frozen.orderId;
    vars.externalOrderId = frozen.externalOrderId;
    vars.countItemId = frozen.countItemId || vars.countItemId;
    vars.stockCountId = frozen.stockCountId || vars.stockCountId;
    vars.projectId = previousProjectId;

    const cls = classify(r, result);
    const shape = expectShapeOk(r.name, result.json, result.status);
    results.push({
      folder: r.folder,
      name: r.name,
      method,
      status: result.status,
      class: cls,
      shape,
      ms: result.ms,
      url: result.url,
      preview: result.bodyPreview,
      error: result.error,
    });
  }

  const summary = results.reduce((acc, row) => {
    acc[row.class] = (acc[row.class] || 0) + 1;
    return acc;
  }, {});

  const out = {
    ranAt: new Date().toISOString(),
    baseUrl: BASE,
    companyId: vars.companyId,
    total: results.length,
    summary,
    varsUsed: Object.fromEntries(
      Object.entries(vars).filter(([k]) => k !== 'accessToken' && k !== 'refreshToken'),
    ),
    failures: results.filter((r) =>
      ['FAIL', 'SERVER_ERROR', 'ERROR', 'AUTH', 'shape_bad'].includes(r.class) ||
      r.shape === 'shape_bad',
    ),
    results,
  };

  fs.mkdirSync('postman', { recursive: true });
  const outPath = path.join('postman', 'endpoint-test-report.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(summary);
  console.log('Report:', outPath);
  console.log(
    'PASS rate:',
    (((summary.PASS || 0) / results.length) * 100).toFixed(1) + '%',
  );

  // print non-pass briefly
  const interesting = results.filter((r) => r.class !== 'PASS');
  console.log('\n=== NON-PASS (' + interesting.length + ') ===');
  for (const r of interesting.slice(0, 80)) {
    console.log(
      `${r.class.padEnd(18)} ${String(r.status).padEnd(4)} ${r.method} ${r.name} :: ${r.preview.slice(0, 100)}`,
    );
  }
  if (interesting.length > 80) console.log(`... +${interesting.length - 80} more`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
