/**
 * Audit NestJS routes vs Postman collection (supports multiple @Controller per file).
 */
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

function extractRoutes(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\n/);
  const routes = [];
  let ctrl = '';
  let pending = null;
  for (let i = 0; i < lines.length; i++) {
    const ctrlDec = lines[i].match(/@Controller\(\s*(['"`])([^'"`]*)\1\s*\)/);
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
      pending = { method: dec[1].toUpperCase(), routePath };
      continue;
    }
    if (!pending) continue;
    const fn = lines[i].match(/^\s*(?:async\s+)?(\w+)\s*\(/);
    if (fn && !['if', 'for', 'while', 'switch', 'constructor'].includes(fn[1])) {
      const full =
        ('/' + [ctrl, pending.routePath].filter(Boolean).join('/'))
          .replace(/\/+/g, '/')
          .replace(/\/$/, '') || '/';
      routes.push({
        method: pending.method,
        path: full,
        file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
        handler: fn[1],
      });
      pending = null;
    }
  }
  return routes;
}

function flattenCollection(items, out = []) {
  for (const it of items) {
    if (it.item) flattenCollection(it.item, out);
    else if (it.request) {
      const method = it.request.method;
      const segs = it.request.url?.path || [];
      out.push({ method, path: '/' + segs.join('/'), name: it.name });
    }
  }
  return out;
}

function normalize(p) {
  return (
    p
      .replace(/\{\{(\w+)\}\}/g, ':$1')
      .replace(/:([A-Za-z_][\w]*)/g, ':param')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'
  );
}

const codeRoutes = walk(path.join(process.cwd(), 'src'))
  .flatMap(extractRoutes)
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const col = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'postman', 'SaaS_ERP_Backend_API.postman_collection.json'),
    'utf8',
  ),
);
const pmRoutes = flattenCollection(col.item);

const missingInPostman = codeRoutes.filter(
  (r) =>
    !pmRoutes.some(
      (p) => p.method === r.method && normalize(p.path) === normalize(r.path),
    ),
);
const extraInPostman = pmRoutes.filter(
  (p) =>
    !codeRoutes.some(
      (r) => r.method === p.method && normalize(r.path) === normalize(p.path),
    ),
);

const report = {
  generatedAt: new Date().toISOString(),
  codeRouteCount: codeRoutes.length,
  postmanRouteCount: pmRoutes.length,
  missingInPostman,
  extraInPostman,
};

fs.writeFileSync(
  path.join(process.cwd(), 'postman', '_route_diff.json'),
  JSON.stringify({ ...report, codeRoutes, pmRoutes }, null, 2),
);

console.log(
  JSON.stringify(
    {
      codeRouteCount: report.codeRouteCount,
      postmanRouteCount: report.postmanRouteCount,
      missingInPostman: missingInPostman.length,
      extraInPostman: extraInPostman.length,
      missingSample: missingInPostman,
    },
    null,
    2,
  ),
);
