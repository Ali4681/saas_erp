/**
 * Ensures translation JSON lands in dist/ even when nest asset copy is skipped
 * (some host deploy pipelines run tsc-only or strip non-JS from dist).
 */
const fs = require('node:fs');
const path = require('node:path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'i18n');
const dest = path.join(root, 'dist', 'i18n');

if (!fs.existsSync(src)) {
  console.error(`[copy-i18n] missing source: ${src}`);
  process.exit(1);
}

copyDir(src, dest);
console.log(`[copy-i18n] copied ${src} → ${dest}`);
