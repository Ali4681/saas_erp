/**
 * Creates dist/i18n even when src/i18n was not uploaded.
 * Run on the server: node scripts/copy-i18n.js && pm2 restart erpwejha
 */
const fs = require('node:fs');
const path = require('node:path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'i18n');
const dest = path.join(root, 'dist', 'i18n');

if (fs.existsSync(src)) {
  copyDir(src, dest);
  console.log(`[copy-i18n] copied ${src} → ${dest}`);
} else {
  writeJson(path.join(dest, 'en', 'common.json'), {
    hello: 'Hello',
    localeUpdated: 'Language updated',
    themeUpdated: 'Theme updated',
  });
  writeJson(path.join(dest, 'en', 'errors.json'), {
    internal: 'Internal server error',
  });
  writeJson(path.join(dest, 'ar', 'common.json'), {
    hello: 'مرحباً',
    localeUpdated: 'تم تحديث اللغة',
    themeUpdated: 'تم تحديث المظهر',
  });
  writeJson(path.join(dest, 'ar', 'errors.json'), {
    internal: 'خطأ داخلي في الخادم',
  });
  console.log(`[copy-i18n] wrote fallback JSON → ${dest}`);
}
