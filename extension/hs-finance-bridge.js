/**
 * Isolated-world bridge: receives MAIN-world finance captures and stores them.
 */
(function hsFinanceBridge() {
  const SOURCE = 'saas-erp-hs-finance';

  function normalizeAccounts(raw) {
    const out = [];
    const seen = new Set();
    const list = Array.isArray(raw) ? raw : [];
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const id = String(row.id || row.accountId || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        currency: String(row.currency || 'SAR'),
        globalEntityId: String(row.globalEntityId || 'HS_SA'),
        ...(row.vendorId != null ? { vendorId: String(row.vendorId) } : {}),
      });
    }
    return out;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;

    if (data.kind === 'accounts') {
      const accounts = normalizeAccounts(data.accounts);
      if (!accounts.length) return;
      chrome.runtime.sendMessage({
        type: 'hs_finance_accounts_captured',
        accounts,
        via: data.via || 'hook',
      });
      return;
    }

    if (data.kind === 'gql_op') {
      chrome.runtime.sendMessage({
        type: 'hs_gql_op_seen',
        op: data.op,
        url: data.url,
        query: data.query,
        variables: data.variables,
      });
    }
  });
})();
