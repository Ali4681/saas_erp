/**
 * MAIN-world fetch/XHR hook for partner-app.
 * Captures GraphQL finance accounts from vagw-api responses/requests.
 */
(function installHsFinanceHook() {
  if (window.__saasErpHsFinanceHook) return;
  window.__saasErpHsFinanceHook = true;

  const SOURCE = 'saas-erp-hs-finance';

  function publish(payload) {
    try {
      window.postMessage({ source: SOURCE, ...payload }, '*');
    } catch {
      /* ignore */
    }
  }

  function inspectJson(json, requestBody, url) {
    try {
      let body = null;
      if (typeof requestBody === 'string') {
        try {
          body = JSON.parse(requestBody);
        } catch {
          body = null;
        }
      } else if (requestBody && typeof requestBody === 'object') {
        body = requestBody;
      }

      const op = String(body?.operationName || '');
      const vars = body?.variables || {};
      if (op || (body && body.query)) {
        publish({
          kind: 'gql_op',
          op: op || '(anonymous)',
          url: String(url || ''),
          query: String(body?.query || '').slice(0, 500),
          variables: vars,
        });
      }
      const reqAccounts =
        vars?.params?.accounts || vars?.accounts || vars?.params?.accountIds;
      if (Array.isArray(reqAccounts) && reqAccounts.length) {
        publish({ kind: 'accounts', accounts: reqAccounts, via: `request:${op || 'gql'}` });
      }

      const data = json?.data || json;
      if (!data || typeof data !== 'object') return;

      const candidates = [];
      const walk = (node, depth = 0) => {
        if (!node || depth > 8) return;
        if (Array.isArray(node)) {
          if (
            node.length &&
            node[0] &&
            typeof node[0] === 'object' &&
            (node[0].id || node[0].accountId) &&
            (node[0].currency || node[0].globalEntityId || node[0].vendorId)
          ) {
            candidates.push(...node);
            return;
          }
          for (const item of node) walk(item, depth + 1);
          return;
        }
        if (typeof node !== 'object') return;
        if (
          (node.id || node.accountId) &&
          (node.currency || node.globalEntityId) &&
          (node.vendorId || node.globalEntityId)
        ) {
          candidates.push(node);
        }
        for (const [k, v] of Object.entries(node)) {
          if (/account|payout|finance|invoice/i.test(k)) {
            walk(v, depth + 1);
          }
        }
      };
      walk(data);
      if (candidates.length) {
        publish({ kind: 'accounts', accounts: candidates, via: `response:${op || 'gql'}` });
      }
    } catch {
      /* ignore */
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function saasErpFetch(...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const input = args[0];
      const url = String(
        typeof input === 'string' ? input : input?.url || '',
      );
      if (
        (url.includes('vagw-api') || url.includes('bff-api') || url.includes('vos-api')) &&
        (url.includes('/query') || url.includes('graphql') || url.includes('/v1/'))
      ) {
        const init = args[1] || {};
        const clone = response.clone();
        clone
          .json()
          .then((json) => inspectJson(json, init.body, url))
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__saasErpUrl = String(url || '');
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (
        this.__saasErpUrl &&
        (this.__saasErpUrl.includes('vagw-api') ||
          this.__saasErpUrl.includes('bff-api') ||
          this.__saasErpUrl.includes('vos-api'))
      ) {
        this.addEventListener('load', () => {
          try {
            inspectJson(
              JSON.parse(this.responseText || '{}'),
              body,
              this.__saasErpUrl,
            );
          } catch {
            /* ignore */
          }
        });
      }
    } catch {
      /* ignore */
    }
    return originalSend.call(this, body);
  };
})();
