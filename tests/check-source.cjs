'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const file of [...fs.readdirSync(path.join(root, 'js')).map(name => path.join('js', name)), 'sw.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
for (const file of fs.readdirSync(path.join(root, 'data')).map(name => path.join('data', name)).concat('manifest.webmanifest')) JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
console.log('All JavaScript and JSON files parse successfully.');
