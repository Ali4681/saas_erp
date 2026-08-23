/**
 * Production entry: copy i18n assets then boot Nest.
 * Used by PM2 so missing dist/i18n cannot take the process down.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const copy = spawnSync(process.execPath, [path.join(root, 'copy-i18n.js')], {
  cwd: path.join(root, '..'),
  stdio: 'inherit',
});
if (copy.status !== 0) {
  process.exit(copy.status ?? 1);
}

require(path.join(root, '..', 'dist', 'main.js'));
