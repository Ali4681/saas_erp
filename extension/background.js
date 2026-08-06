/**
 * Multi-channel delivery bridge for saas_erp.
 * Channels: hungerstation | ninja | toyou | mrsool
 * Default host: ws://127.0.0.1:3000/ws/<channel>
 */

const WS_BASE = 'ws://127.0.0.1:3000/ws';
const GRAPHQL_URL = 'https://vagw-api.eu.prd.portal.restaurant/query';
const NINJA_API_BASE = 'https://admin.ananinja.com';
const MRSOOL_BASE = 'https://business.mrsool.co';
const MRSOOL_API_BASE = 'https://pi.mrsool.co';
const MRSOOL_BIZ_API_BASE = 'https://business-api.mrsool.co';
const MRSOOL_AUTH_HINTS_KEY = 'mrsool_auth_hints';
const NINJA_AUTH_HINTS_KEY = 'ninja_auth_hints';
const TOYOU_AUTH_HINTS_KEY = 'toyou_auth_hints';

const channels = {
  hungerstation: { ws: null, timer: null },
  ninja: { ws: null, timer: null },
  toyou: { ws: null, timer: null },
  mrsool: { ws: null, timer: null },
};

let _ninjaToken = null;
let _toyouToken = null;

chrome.storage.local.get([NINJA_AUTH_HINTS_KEY, TOYOU_AUTH_HINTS_KEY], (stored) => {
  if (stored?.[NINJA_AUTH_HINTS_KEY]?.token) _ninjaToken = stored[NINJA_AUTH_HINTS_KEY].token;
  if (stored?.[TOYOU_AUTH_HINTS_KEY]?.token) _toyouToken = stored[TOYOU_AUTH_HINTS_KEY].token;
});

if (chrome.webRequest) {
  chrome.webRequest.onSendHeaders.addListener(
    (details) => {
      if (!details.tabId || details.tabId < 0) return;
      const auth = (details.requestHeaders || []).find(
        (h) => h.name.toLowerCase() === 'authorization',
      );
      if (!auth?.value?.toLowerCase().startsWith('bearer ')) return;
      const token = auth.value.slice(7).trim();
      if (token.length < 20) return;
      if (details.url.includes('ananinja.com')) {
        _ninjaToken = token;
        chrome.storage.local.set({ [NINJA_AUTH_HINTS_KEY]: { token } });
      }
      if (details.url.includes('toyou.delivery')) {
        _toyouToken = token;
        chrome.storage.local.set({ [TOYOU_AUTH_HINTS_KEY]: { token } });
      }
    },
    { urls: ['https://admin.ananinja.com/*', 'https://toyou.delivery/*'] },
    ['requestHeaders', 'extraHeaders'],
  );

  // Capture finance accounts + recent GraphQL ops from partner portal.
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      try {
        if (details.method !== 'POST') return;
        const bytes = details.requestBody?.raw?.[0]?.bytes;
        if (!bytes) return;
        const text = new TextDecoder('utf-8').decode(bytes);
        const body = JSON.parse(text);
        rememberHsGqlOp(body, details.url);
        const vars = body?.variables || {};
        const accounts =
          vars?.params?.accounts ||
          vars?.accounts ||
          vars?.params?.accountIds ||
          null;
        const normalized = normalizeHsAccounts(accounts);
        if (normalized.length) {
          chrome.storage.local.set({
            hs_finance_accounts: normalized,
            hs_finance_accounts_via: `webRequest:${body.operationName || 'gql'}`,
          });
          console.log(
            '[HS] Captured finance accounts from GraphQL request:',
            normalized.length,
            body.operationName || '',
          );
        }
      } catch {
        /* ignore */
      }
    },
    {
      urls: [
        'https://vagw-api.eu.prd.portal.restaurant/*',
        'https://bff-api.eu.prd.portal.restaurant/*',
        'https://vos-api.eu.prd.portal.restaurant/*',
      ],
    },
    ['requestBody'],
  );
}

function rememberHsGqlOp(body, url) {
  try {
    const op = String(body?.operationName || '').trim();
    const query = String(body?.query || '');
    const vars = body?.variables && typeof body.variables === 'object'
      ? body.variables
      : {};
    const entry = {
      at: new Date().toISOString(),
      op: op || '(anonymous)',
      url: String(url || '').slice(0, 120),
      varKeys: Object.keys(vars).slice(0, 20),
      paramKeys:
        vars.params && typeof vars.params === 'object'
          ? Object.keys(vars.params).slice(0, 20)
          : [],
      mentionsFinance: /payout|finance|account|invoice|billing|earning/i.test(
        `${op} ${query.slice(0, 400)} ${JSON.stringify(vars).slice(0, 400)}`,
      ),
    };
    chrome.storage.local.get('hs_recent_gql_ops', (stored) => {
      const prev = Array.isArray(stored?.hs_recent_gql_ops)
        ? stored.hs_recent_gql_ops
        : [];
      const next = [entry, ...prev].slice(0, 80);
      chrome.storage.local.set({ hs_recent_gql_ops: next });
    });
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'hs_finance_accounts_captured' && Array.isArray(msg.accounts)) {
    const accounts = normalizeHsAccounts(msg.accounts);
    if (accounts.length) {
      chrome.storage.local.set({
        hs_finance_accounts: accounts,
        hs_finance_accounts_via: msg.via || 'content-script',
      });
      console.log('[HS] Captured finance accounts from page:', accounts.length, msg.via);
    }
    sendResponse?.({ ok: true, count: accounts.length });
    return true;
  }
  if (msg?.type === 'hs_gql_op_seen' && msg.op) {
    rememberHsGqlOp(
      {
        operationName: msg.op,
        query: msg.query || '',
        variables: msg.variables || {},
      },
      msg.url || '',
    );
    sendResponse?.({ ok: true });
    return true;
  }
  return false;
});

function connectChannel(name) {
  const state = channels[name];
  if (!state) return;
  if (
    state.ws &&
    (state.ws.readyState === WebSocket.OPEN ||
      state.ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  const socket = new WebSocket(`${WS_BASE}/${name}`);
  state.ws = socket;

  socket.onopen = () => {
    clearTimeout(state.timer);
    socket.send(JSON.stringify({ type: 'hello', client: `saas-erp-${name}` }));
  };

  socket.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === 'ping' && !msg.id) {
      socket.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    if (msg.type === 'hello' || msg.type === 'pong') return;
    if (!msg.id) return;
    try {
      const result = await dispatch(name, msg);
      socket.send(JSON.stringify({ type: 'result', id: msg.id, ok: true, data: result }));
    } catch (err) {
      socket.send(
        JSON.stringify({
          type: 'result',
          id: msg.id,
          ok: false,
          error: err?.message || String(err),
        }),
      );
    }
  };

  socket.onclose = () => {
    state.timer = setTimeout(() => connectChannel(name), 5000);
  };
  socket.onerror = () => {
    try {
      socket.close();
    } catch {
      // ignore
    }
  };
}

async function dispatch(channel, msg) {
  if (channel === 'hungerstation') return handleHs(msg);
  if (channel === 'ninja') return handleNinja(msg);
  if (channel === 'toyou') return handleToyou(msg);
  if (channel === 'mrsool') return handleMrsool(msg);
  throw new Error(`unknown_channel:${channel}`);
}

function extractApiError(text, fallback = 'request_failed') {
  if (!text || !text.trim()) return fallback;
  try {
    const data = JSON.parse(text);
    if (typeof data === 'string') return data;

    const parts = [];
    if (data?.message) parts.push(String(data.message));
    if (data?.detail && data.detail !== data.message) {
      parts.push(String(data.detail));
    }
    if (data?.error && data.error !== data.message) {
      parts.push(String(data.error));
    }

    const violations =
      data?.constraintViolations ||
      data?.violations ||
      data?.errors ||
      data?.cause?.constraintViolations ||
      null;
    if (Array.isArray(violations) && violations.length) {
      for (const v of violations) {
        if (typeof v === 'string') {
          parts.push(v);
          continue;
        }
        if (!v || typeof v !== 'object') continue;
        const field =
          v.field ||
          v.path ||
          v.property ||
          v.propertyPath ||
          v.fieldName ||
          '';
        const msg =
          v.message ||
          v.msg ||
          v.reason ||
          v.description ||
          v.interpolatedMessage ||
          '';
        if (field && msg) parts.push(`${field}: ${msg}`);
        else if (msg) parts.push(String(msg));
        else parts.push(JSON.stringify(v));
      }
    }

    if (parts.length) return [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))].join(' · ');

    // Last resort: compact body so UI is not stuck on generic text only.
    const compact = JSON.stringify(data);
    if (compact && compact !== '{}') return compact.slice(0, 500);
  } catch {
    return text.slice(0, 300);
  }
  return fallback;
}

// ── HungerStation ────────────────────────────────────────────────────────────

async function handleHs(msg) {
  switch (msg.type) {
    case 'gql':
      return hsGql(msg.operation, msg.query, msg.variables);
    case 'rest':
      return hsRest(msg.url, msg.method || 'GET', msg.body);
    case 'rest_multipart':
      return hsRestMultipart(msg);
    case 'partner_rest':
      return hsPartnerRest(msg.url, msg.method || 'GET', msg.accessToken, msg.body);
    case 'get_cookies':
      return hsCookies();
    case 'save_session':
      return hsSaveSession();
    case 'finance_accounts':
      return hsFinanceAccounts(msg.vendorId);
    case 'ping':
      return { pong: true };
    default:
      throw new Error(`Unknown HS command: ${msg.type}`);
  }
}

async function hsCookies() {
  const result = {};
  const getAllSafe = async (details) => {
    try {
      return await chrome.cookies.getAll(details);
    } catch {
      return [];
    }
  };
  for (const domain of [
    'hungerstation.com',
    '.hungerstation.com',
    'partner-app.hungerstation.com',
    'vagw-api.eu.prd.portal.restaurant',
  ]) {
    for (const c of await getAllSafe({ domain })) result[c.name] = c.value;
  }
  for (const url of [
    'https://partner-app.hungerstation.com/',
    'https://hungerstation.com/',
  ]) {
    for (const c of await getAllSafe({ url })) result[c.name] = c.value;
  }
  return result;
}

async function hsSaveSession() {
  const cookies = await hsCookies();
  if (!cookies.accessToken) throw new Error('no_access_token');
  try {
    const result = await hsFinanceAccounts();
    const accounts = normalizeHsAccounts(result?.accounts ?? result);
    if (accounts.length) {
      cookies.__accounts = JSON.stringify(accounts);
      await chrome.storage.local.set({ hs_finance_accounts: accounts });
    }
  } catch (e) {
    console.warn('[HS] finance accounts on save_session:', e?.message || e);
  }
  return { ok: true, cookies };
}

function normalizeHsAccounts(raw) {
  const out = [];
  const seen = new Set();
  const push = (row) => {
    if (!row || typeof row !== 'object') return;
    const id = String(row.id || row.accountId || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      currency: String(row.currency || 'SAR'),
      globalEntityId: String(row.globalEntityId || 'HS_SA'),
      ...(row.vendorId != null ? { vendorId: String(row.vendorId) } : {}),
    });
  };
  const walk = (node, depth = 0) => {
    if (node == null || depth > 6) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && typeof item === 'object' && (item.id || item.accountId)) push(item);
        else walk(item, depth + 1);
      }
      return;
    }
    if (typeof node !== 'object') return;
    if (node.id && (node.currency != null || node.globalEntityId != null)) push(node);
    for (const key of ['accounts', 'financeAccounts', 'listAccounts', 'data']) {
      if (node[key] != null) walk(node[key], depth + 1);
    }
  };
  walk(raw);
  return out;
}

async function hsAccountsFromPartnerTab() {
  const tabs = await chrome.tabs.query({
    url: ['https://partner-app.hungerstation.com/*'],
  });
  if (!tabs.length || tabs[0].id == null) return [];
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const found = [];
        const push = (row) => {
          if (!row || typeof row !== 'object') return;
          if (row.id || row.accountId) found.push(row);
        };
        const walk = (node, depth = 0) => {
          if (!node || depth > 7) return;
          if (Array.isArray(node)) {
            for (const item of node) {
              if (item && typeof item === 'object' && (item.id || item.accountId) && (item.currency || item.globalEntityId)) {
                push(item);
              } else walk(item, depth + 1);
            }
            return;
          }
          if (typeof node !== 'object') return;
          if (node.id && (node.currency || node.globalEntityId)) push(node);
          for (const [k, v] of Object.entries(node)) {
            if (/account/i.test(k)) walk(v, depth + 1);
          }
        };
        try {
          for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            const val = localStorage.getItem(key);
            if (!val || val.length > 2_000_000) continue;
            if (!/account|finance|payout/i.test(key + val.slice(0, 120))) continue;
            try {
              walk(JSON.parse(val));
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
        return found;
      },
    });
    return normalizeHsAccounts(result || []);
  } catch (e) {
    console.warn('[HS] tab accounts scrape failed:', e?.message || e);
    return [];
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hsInjectFinanceHooks(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['hs-finance-hook.js'],
      world: 'MAIN',
    });
  } catch (e) {
    console.warn('[HS] inject MAIN hook failed:', e?.message || e);
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['hs-finance-bridge.js'],
    });
  } catch (e) {
    console.warn('[HS] inject bridge failed:', e?.message || e);
  }
}

async function hsProbeSchema() {
  const debug = { introspection: {}, queriesTried: [] };
  const probes = [
    {
      name: 'ListPayoutsRequest',
      query: `query IntrospectListPayoutsRequest {
        __type(name: "ListPayoutsRequest") {
          name
          inputFields { name type { kind name ofType { kind name ofType { name } } } }
        }
      }`,
    },
    {
      name: 'AccountInput',
      query: `query IntrospectAccountInput {
        __type(name: "AccountInput") {
          name
          inputFields { name type { kind name ofType { kind name } } }
        }
      }`,
    },
    {
      name: 'Account',
      query: `query IntrospectAccount {
        __type(name: "Account") {
          name
          fields { name type { kind name ofType { name } } }
        }
      }`,
    },
    {
      name: 'QueryFields',
      query: `query IntrospectQuery {
        __type(name: "Query") {
          fields { name }
        }
      }`,
    },
  ];

  for (const probe of probes) {
    try {
      const data = await hsGql(probe.name, probe.query, {});
      debug.introspection[probe.name] = data;
    } catch (e) {
      debug.introspection[probe.name] = {
        error: e?.message || String(e),
      };
    }
  }
  return debug;
}

async function hsOpenFinanceAndCapture(vendorId) {
  const urls = [
    'https://partner-app.hungerstation.com/finance',
    'https://partner-app.hungerstation.com/finances',
    'https://partner-app.hungerstation.com/finance/payouts',
    'https://partner-app.hungerstation.com/billing',
    'https://partner-app.hungerstation.com/payouts',
    'https://partner-app.hungerstation.com/financials',
    'https://partner-app.hungerstation.com/reports/finance',
    'https://partner-app.hungerstation.com/sa/finance',
    'https://partner-app.hungerstation.com/HS_SA/finance',
  ];

  const existing = await chrome.tabs.query({
    url: ['https://partner-app.hungerstation.com/*'],
  });
  for (const tab of existing) {
    if (tab.id != null) await hsInjectFinanceHooks(tab.id);
  }

  let tabId = existing[0]?.id ?? null;
  let created = false;
  if (tabId == null) {
    const tab = await chrome.tabs.create({
      url: urls[0],
      active: false,
    });
    tabId = tab.id;
    created = true;
    await sleep(1500);
    if (tabId != null) await hsInjectFinanceHooks(tabId);
  }

  const visited = [];
  for (const url of urls) {
    try {
      await chrome.tabs.update(tabId, { url });
      visited.push(url);
      await sleep(2500);
      if (tabId != null) await hsInjectFinanceHooks(tabId);
      const stored = await chrome.storage.local.get([
        'hs_finance_accounts',
        'hs_finance_accounts_via',
      ]);
      const accounts = normalizeHsAccounts(stored?.hs_finance_accounts);
      if (accounts.length) {
        if (created && tabId != null) {
          try {
            await chrome.tabs.remove(tabId);
          } catch {
            /* ignore */
          }
        }
        return {
          accounts,
          debug: {
            via: stored.hs_finance_accounts_via || 'finance-crawl',
            visited,
            vendorId: vendorId || null,
          },
        };
      }
    } catch (e) {
      visited.push(`${url} (err:${e?.message || e})`);
    }
  }

  // Final wait in case a late GraphQL request lands.
  for (let i = 0; i < 10; i += 1) {
    await sleep(500);
    const stored = await chrome.storage.local.get('hs_finance_accounts');
    const accounts = normalizeHsAccounts(stored?.hs_finance_accounts);
    if (accounts.length) {
      if (created && tabId != null) {
        try {
          await chrome.tabs.remove(tabId);
        } catch {
          /* ignore */
        }
      }
      return {
        accounts,
        debug: { via: 'finance-crawl-late', visited, vendorId: vendorId || null },
      };
    }
  }

  if (created && tabId != null) {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      /* ignore */
    }
  }
  return { accounts: [], debug: { via: 'finance-crawl-empty', visited, vendorId: vendorId || null } };
}

async function hsFinanceAccounts(vendorId) {
  const debug = {
    steps: [],
    vendorId: vendorId || null,
  };

  const stored = await chrome.storage.local.get([
    'hs_finance_accounts',
    'hs_finance_accounts_via',
    'hs_recent_gql_ops',
  ]);
  const cached = normalizeHsAccounts(stored?.hs_finance_accounts);
  if (cached.length) {
    debug.steps.push(`cache:${cached.length}:${stored.hs_finance_accounts_via || ''}`);
    return { accounts: cached, debug };
  }
  debug.steps.push('cache:empty');

  const fromTab = await hsAccountsFromPartnerTab();
  if (fromTab.length) {
    await chrome.storage.local.set({ hs_finance_accounts: fromTab });
    debug.steps.push(`localStorage:${fromTab.length}`);
    return { accounts: fromTab, debug };
  }
  debug.steps.push('localStorage:empty');

  // Inject hooks into open partner-app tabs and wait briefly for any finance GraphQL.
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://partner-app.hungerstation.com/*'],
    });
    for (const tab of tabs) {
      if (tab.id != null) await hsInjectFinanceHooks(tab.id);
    }
    debug.openTabs = tabs.length;
    for (let i = 0; i < 8; i += 1) {
      await sleep(500);
      const again = await chrome.storage.local.get('hs_finance_accounts');
      const found = normalizeHsAccounts(again?.hs_finance_accounts);
      if (found.length) {
        debug.steps.push(`live-capture:${found.length}`);
        return { accounts: found, debug };
      }
    }
    debug.steps.push('live-capture:empty');
  } catch (e) {
    debug.steps.push(`live-capture:err:${e?.message || e}`);
  }

  const recent = Array.isArray(stored?.hs_recent_gql_ops)
    ? stored.hs_recent_gql_ops
    : [];
  debug.recentGqlOps = recent.slice(0, 25).map((row) => ({
    op: row.op,
    mentionsFinance: !!row.mentionsFinance,
    paramKeys: row.paramKeys || [],
    at: row.at,
  }));
  debug.financeMentionOps = debug.recentGqlOps.filter((r) => r.mentionsFinance);

  return { accounts: [], debug };
}

async function hsRest(url, method = 'GET', body = null) {
  const cookies = await hsCookies();
  const accessToken = cookies.accessToken;
  if (!accessToken) throw new Error('session_expired');
  const pxCookie = cookies._px3 ? `_px3=${cookies._px3}` : '';
  // Match working OneWeb portal headers (Ecommerce-workflow). Extra partner
  // headers on catalog writes have caused schema/validation mismatches.
  const opts = {
    method,
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${accessToken}`,
      Origin: 'https://partner-app.hungerstation.com',
      Referer: 'https://partner-app.hungerstation.com/',
      'Client-Name': 'OneWeb',
      'Client-Version': 'menuManagementV2_1.9.14',
      'Client-Wrapper-Type': 'Web',
      'x-rps-client-app-name': 'OneWeb',
      ...(pxCookie && { 'x-px-cookies': pxCookie }),
    },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (resp.status === 401) throw new Error('session_expired');
  if (resp.status === 403) throw new Error('perimeter_x_blocked');
  if (!resp.ok) throw new Error(extractApiError(text, `http_${resp.status}`));
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
  }
}

/**
 * Multipart upload (product images). Payload from Nest:
 * { url, method?, fileBase64, fileName?, contentType?, fieldName?, fields? }
 */
async function hsRestMultipart(msg) {
  const url = String(msg.url || '').trim();
  if (!url) throw new Error('rest_multipart_url_required');
  const fileBase64 = String(msg.fileBase64 || '')
    .replace(/^data:[^;]+;base64,/, '')
    .trim();
  if (!fileBase64) throw new Error('rest_multipart_file_required');

  const cookies = await hsCookies();
  const accessToken = cookies.accessToken;
  if (!accessToken) throw new Error('session_expired');
  const pxCookie = cookies._px3 ? `_px3=${cookies._px3}` : '';

  const fileName = String(msg.fileName || 'product.jpg').trim() || 'product.jpg';
  const contentType = String(msg.contentType || 'image/jpeg').trim() || 'image/jpeg';
  const fieldName = String(msg.fieldName || 'file').trim() || 'file';

  const binary = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append(fieldName, new Blob([binary], { type: contentType }), fileName);

  const extraFields =
    msg.fields && typeof msg.fields === 'object' && !Array.isArray(msg.fields)
      ? msg.fields
      : null;
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      if (v == null) continue;
      form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }

  const resp = await fetch(url, {
    method: msg.method || 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${accessToken}`,
      Origin: 'https://partner-app.hungerstation.com',
      Referer: 'https://partner-app.hungerstation.com/',
      'Client-Name': 'OneWeb',
      'Client-Version': 'menuManagementV2_1.9.14',
      'Client-Wrapper-Type': 'Web',
      'x-rps-client-app-name': 'OneWeb',
      ...(pxCookie && { 'x-px-cookies': pxCookie }),
      // Do not set Content-Type — browser sets multipart boundary.
    },
    body: form,
  });

  const text = await resp.text();
  if (resp.status === 401) throw new Error('session_expired');
  if (resp.status === 403) throw new Error('perimeter_x_blocked');
  if (!resp.ok) throw new Error(extractApiError(text, `http_${resp.status}`));
  if (!text.trim()) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, raw: text.slice(0, 500) };
  }
}

/** Official Partner API calls (OAuth bearer from Nest — not portal cookies). */
async function hsPartnerRest(url, method = 'GET', accessToken, body = null) {
  if (!accessToken) throw new Error('partner_token_missing');
  const opts = {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  };
  if (body != null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (!resp.ok) throw new Error(extractApiError(text, `partner_http_${resp.status}`));
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
  }
}

async function hsGql(operation, query, variables) {
  const cookies = await hsCookies();
  const accessToken = cookies.accessToken;
  if (!accessToken) throw new Error('session_expired');
  const resp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'Accept-Language': 'ar',
      Authorization: `Bearer ${accessToken}`,
      Origin: 'https://partner-app.hungerstation.com',
      Referer: 'https://partner-app.hungerstation.com/',
      'x-global-entity-id': 'HS_SA',
      'x-fp-api-key': 'partner',
    },
    body: JSON.stringify({ operationName: operation, variables, query }),
  });
  const text = await resp.text();
  if (resp.status === 403) throw new Error('perimeter_x_blocked');
  if (resp.status === 401) throw new Error('session_expired');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
  }
  if (data.errors?.length) {
    const first = data.errors[0] || {};
    let detail = '';
    try {
      detail = JSON.stringify(first).slice(0, 500);
    } catch {
      detail = '';
    }
    const m =
      first.message ||
      first.extensions?.message ||
      detail ||
      'GraphQL error';
    if (/unauthorized|unauthenticated|forbidden/i.test(m)) throw new Error('session_expired');
    // Prefer rich detail when gateway returns opaque "GraphQL error" / code 0
    if ((m === 'GraphQL error' || first.extensions?.code === 0) && detail) {
      throw new Error(detail);
    }
    const parts = [m];
    if (first.extensions?.code != null && first.extensions.code !== '') {
      parts.push(`[${first.extensions.code}]`);
    }
    if (Array.isArray(first.path) && first.path.length) {
      parts.push(`@ ${first.path.join('.')}`);
    }
    throw new Error(parts.join(' '));
  }
  return data.data;
}

// ── Ninja ────────────────────────────────────────────────────────────────────

async function handleNinja(msg) {
  switch (msg.type) {
    case 'save_ninja_session':
      return saveNinjaSession();
    case 'get_ninja_cookies':
      return getNinjaCookies();
    case 'ninja_rest':
      return ninjaFetch(msg.path, msg.method || 'GET', msg.body, msg.params);
    case 'ping':
      return { pong: true };
    default:
      throw new Error(`Unknown Ninja command: ${msg.type}`);
  }
}

async function getNinjaCookies() {
  const all = {};
  const getAllSafe = async (details) => {
    try {
      return await chrome.cookies.getAll(details);
    } catch {
      return [];
    }
  };
  for (const domain of [
    'restaurant-portal.ananinja.com',
    '.ananinja.com',
    'ananinja.com',
  ]) {
    for (const c of await getAllSafe({ domain })) all[c.name] = c.value;
  }
  return all;
}

async function saveNinjaSession() {
  if (!_ninjaToken) {
    const stored = await chrome.storage.local.get(NINJA_AUTH_HINTS_KEY);
    _ninjaToken = stored?.[NINJA_AUTH_HINTS_KEY]?.token || null;
  }
  const tabs = await chrome.tabs.query({
    url: 'https://restaurant-portal.ananinja.com/*',
  });
  let restaurantId = '';
  let branchId = '';
  let menuId = '';
  if (tabs.length) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const url = window.location.href;
          const rMatch = url.match(/restaurants?[\/=](\d+)/);
          const bMatch = url.match(/branches?[\/=](\d+)/);
          const mMatch = url.match(/menus?[\/=](\d+)/);
          let token =
            localStorage.getItem('token') ||
            localStorage.getItem('access_token') ||
            '';
          return {
            restaurantId: rMatch?.[1] || '',
            branchId: bMatch?.[1] || '',
            menuId: mMatch?.[1] || '',
            token,
          };
        },
      });
      const r = results?.[0]?.result || {};
      restaurantId = r.restaurantId || '';
      branchId = r.branchId || '';
      menuId = r.menuId || '';
      if (r.token && r.token.length > 20) {
        _ninjaToken = r.token;
        chrome.storage.local.set({ [NINJA_AUTH_HINTS_KEY]: { token: r.token } });
      }
    } catch (e) {
      console.warn('[Ninja] tab scan failed', e.message);
    }
  }
  if (!_ninjaToken || _ninjaToken.length < 20) {
    throw new Error('ninja_no_token — open restaurant-portal.ananinja.com and log in');
  }
  return {
    ok: true,
    accessToken: _ninjaToken,
    vendorId: restaurantId,
    restaurantId,
    branchId,
    menuId,
    message: 'Paste these fields into ERP project credentials',
  };
}

async function ninjaFetch(path, method = 'GET', body = null, params = null) {
  if (!_ninjaToken) {
    const stored = await chrome.storage.local.get(NINJA_AUTH_HINTS_KEY);
    _ninjaToken = stored?.[NINJA_AUTH_HINTS_KEY]?.token || null;
  }
  if (!_ninjaToken) throw new Error('ninja_no_token');
  let url = path && /^https?:\/\//.test(path) ? path : `${NINJA_API_BASE}${path || ''}`;
  if (params && typeof params === 'object') {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) for (const val of v) sp.append(k, String(val));
      else sp.append(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`;
  }
  const opts = {
    method,
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_ninjaToken}`,
      Origin: 'https://restaurant-portal.ananinja.com',
      Referer: 'https://restaurant-portal.ananinja.com/',
    },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (resp.status === 401) throw new Error('session_expired');
  if (!resp.ok) throw new Error(extractApiError(text, `ninja_http_${resp.status}`));
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── ToYou ────────────────────────────────────────────────────────────────────

async function handleToyou(msg) {
  switch (msg.type) {
    case 'get_toyou_token':
      return { token: _toyouToken || '' };
    case 'save_toyou_session':
      if (!_toyouToken) {
        const stored = await chrome.storage.local.get(TOYOU_AUTH_HINTS_KEY);
        _toyouToken = stored?.[TOYOU_AUTH_HINTS_KEY]?.token || null;
      }
      if (!_toyouToken) throw new Error('toyou_no_token — open merchant.toyou.io / use portal');
      return {
        ok: true,
        accessToken: _toyouToken,
        message: 'Paste accessToken into ERP project credentials',
      };
    case 'ping':
      return { pong: true };
    default:
      throw new Error(`Unknown ToYou command: ${msg.type}`);
  }
}

// ── Mrsool ───────────────────────────────────────────────────────────────────

async function handleMrsool(msg) {
  switch (msg.type) {
    case 'save_mrsool_session':
      return saveMrsoolSession();
    case 'get_mrsool_cookies':
      return getMrsoolCookies();
    case 'mrsool_rest':
      return mrsoolFetch(msg.path, msg.method || 'GET', msg.body, msg.params);
    case 'ping':
      return { pong: true };
    default:
      throw new Error(`Unknown Mrsool command: ${msg.type}`);
  }
}

function buildBearerToken(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return /^bearer\s+/i.test(v) ? v : `Bearer ${v}`;
}

async function loadCachedMrsoolAuthHints() {
  try {
    const data = await chrome.storage.local.get([MRSOOL_AUTH_HINTS_KEY]);
    return data?.[MRSOOL_AUTH_HINTS_KEY] && typeof data[MRSOOL_AUTH_HINTS_KEY] === 'object'
      ? data[MRSOOL_AUTH_HINTS_KEY]
      : {};
  } catch {
    return {};
  }
}

async function saveCachedMrsoolAuthHints(hints) {
  const payload = {
    authorization: String(hints.authorization || '').trim(),
    csrfToken: String(hints.csrfToken || '').trim(),
    updatedAt: Date.now(),
  };
  if (!payload.authorization && !payload.csrfToken) return;
  await chrome.storage.local.set({ [MRSOOL_AUTH_HINTS_KEY]: payload });
}

async function getMrsoolAuthHintsFromOpenTab() {
  const tabs = await chrome.tabs.query({ url: 'https://business.mrsool.co/*' });
  if (!tabs.length) return {};
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      const dump = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) dump[`ls:${k}`] = localStorage.getItem(k) || '';
        }
      } catch {
        // ignore
      }
      const csrfMeta =
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
        '';
      if (csrfMeta) dump['meta:csrf-token'] = csrfMeta;
      return dump;
    },
  });
  const dump = results?.[0]?.result;
  if (!dump || typeof dump !== 'object') return {};
  const found = { authorization: '', csrfToken: '' };
  for (const [rawKey, rawVal] of Object.entries(dump)) {
    const key = String(rawKey || '').toLowerCase();
    const value = String(rawVal || '').trim();
    if (!value) continue;
    if (!found.csrfToken && (key.includes('csrf') || key.includes('xsrf'))) {
      found.csrfToken = value;
    }
    if (
      !found.authorization &&
      /(access.?token|id.?token|jwt|bearer|authorization|auth.?token|token)/i.test(
        key,
      ) &&
      value.length > 16
    ) {
      found.authorization = buildBearerToken(value);
    }
  }
  return found;
}

async function getMrsoolCookies() {
  const all = {};
  const getAllSafe = async (details) => {
    try {
      return await chrome.cookies.getAll(details);
    } catch {
      return [];
    }
  };
  for (const url of [
    'https://business.mrsool.co/',
    'https://mrsool.co/',
    'https://pi.mrsool.co/',
  ]) {
    for (const c of await getAllSafe({ url })) all[c.name] = c.value;
  }
  const MAX_AGE = 24 * 60 * 60 * 1000;
  try {
    let hints = await getMrsoolAuthHintsFromOpenTab();
    if (hints.authorization || hints.csrfToken) {
      await saveCachedMrsoolAuthHints(hints);
    } else {
      const cached = await loadCachedMrsoolAuthHints();
      const age = Date.now() - (cached.updatedAt || 0);
      hints = age < MAX_AGE ? cached : {};
    }
    if (hints.authorization) all.__mrsool_authorization = hints.authorization;
    if (hints.csrfToken) all.__mrsool_csrf = hints.csrfToken;
  } catch {
    // ignore
  }
  return all;
}

async function saveMrsoolSession() {
  const cookies = await getMrsoolCookies();
  if (!cookies.__mrsool_authorization && !Object.keys(cookies).length) {
    throw new Error('no_mrsool_cookies — open business.mrsool.co and log in');
  }
  return {
    ok: true,
    cookies,
    message: 'Paste cookies JSON into ERP project credentials (optional cache)',
  };
}

async function mrsoolBizApiFetch(url, method, headers, bodyStr) {
  const tabs = await chrome.tabs.query({ url: 'https://business.mrsool.co/*' });
  if (!tabs.length) throw new Error('mrsool_no_tab — open business.mrsool.co first');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: async (fetchUrl, fetchMethod, fetchHeaders, fetchBody) => {
      try {
        const opts = {
          method: fetchMethod,
          headers: fetchHeaders,
          credentials: 'include',
        };
        if (fetchBody) opts.body = fetchBody;
        const resp = await fetch(fetchUrl, opts);
        const text = await resp.text();
        return { ok: resp.ok, status: resp.status, text };
      } catch (e) {
        return { ok: false, status: 0, text: e.message };
      }
    },
    args: [url, method, headers, bodyStr],
  });
  const result = results?.[0]?.result;
  if (!result) throw new Error('mrsool_tab_script_failed');
  return result;
}

async function mrsoolFetch(path, method = 'GET', body = null, params = null) {
  const cookies = await getMrsoolCookies();
  const authToken = String(cookies.__mrsool_authorization || '').trim();
  const csrfToken = String(cookies.__mrsool_csrf || '').trim();
  const isBizApiPath = /^\/v1\//.test(path);
  const isApiPath = /^\/(branches|orders|accounts|oauth)\b/.test(path);
  const base = isBizApiPath
    ? MRSOOL_BIZ_API_BASE
    : isApiPath
      ? MRSOOL_API_BASE
      : MRSOOL_BASE;
  let url = `${base}${path}`;
  if (params && typeof params === 'object') {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) for (const val of v) sp.append(k, String(val));
      else sp.append(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`;
  }
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ar,en;q=0.9',
    ...(authToken && { Authorization: authToken }),
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(isBizApiPath && { usingnewmodel: 'true' }),
  };
  if (isBizApiPath) {
    const bodyStr = body && method !== 'GET' ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Type'] = 'application/json';
    const result = await mrsoolBizApiFetch(url, method, headers, bodyStr);
    if (result.status === 401 || result.status === 403) {
      throw new Error('mrsool_unauthorized');
    }
    if (!result.ok) {
      throw new Error(extractApiError(result.text, `mrsool_http_${result.status}`));
    }
    if (!result.text?.trim()) return { ok: true, status: result.status };
    try {
      return JSON.parse(result.text);
    } catch {
      return result.text;
    }
  }
  const opts = { method, credentials: 'include', headers };
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (resp.status === 401 || resp.status === 403) throw new Error('mrsool_unauthorized');
  if (!resp.ok) throw new Error(extractApiError(text, `mrsool_http_${resp.status}`));
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {
  for (const name of Object.keys(channels)) {
    const state = channels[name];
    if (!state.ws || state.ws.readyState === WebSocket.CLOSED) connectChannel(name);
    else if (state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'get_status') {
    const status = {};
    for (const [name, state] of Object.entries(channels)) {
      status[name] = Boolean(state.ws && state.ws.readyState === WebSocket.OPEN);
    }
    sendResponse({ channels: status, wsBase: WS_BASE });
    return true;
  }
  return false;
});

chrome.storage.local.get(['hs_ws_url'], () => {
  for (const name of Object.keys(channels)) connectChannel(name);
});
