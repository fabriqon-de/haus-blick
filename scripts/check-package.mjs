import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const hacs = JSON.parse(readFileSync('hacs.json', 'utf8'));
assert.equal(hacs.filename, 'haus-blick.js');
assert.equal(hacs.render_readme, true);
assert(!hacs.content_in_root, 'The installable file belongs in dist/');
assert.deepEqual(readdirSync('dist').sort(), ['haus-blick.js'], 'HACS needs one self-contained card file');
const bundle = readFileSync('dist/haus-blick.js', 'utf8');
assert(bundle.length > 1000 && Buffer.byteLength(bundle) < 1000000, 'Unexpected distribution size');
for (const term of ['haus-blick-card', 'hass-more-info', 'config-changed', 'Fabriqon', 'MIT License', 'Copyright (c) 2026 PlantFrame contributors', 'three.js']) assert(bundle.includes(term), `Distribution missing ${term}`);
assert(!/\bimport\s*\(/.test(bundle), 'No extra runtime chunks may be downloaded');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert(bundle.includes(`Haus Blick ${pkg.version}`), 'Bundle version differs from package');
const directory = 'vendor/fabriqon-sdk/';
const provenance = JSON.parse(readFileSync(directory + 'provenance.json', 'utf8'));
assert.equal(provenance.repository, 'https://github.com/fabriqon-de/sdk');
assert.match(provenance.commit, /^[a-f0-9]{40}$/);
const seen = [];
function check(path = '') {
  for (const entry of readdirSync(directory + path, { withFileTypes: true })) {
    const name = path + entry.name;
    if (entry.isDirectory()) check(name + '/');
    else if (name !== 'provenance.json') {
      seen.push(name);
      assert.equal(createHash('sha256').update(readFileSync(directory + name)).digest('hex'), provenance.files[name], `SDK snapshot changed: ${name}`);
    }
  }
}
check(); assert.deepEqual(seen.sort(), Object.keys(provenance.files).sort());
for (const path of ['README.md', 'LICENSE', 'AGENTS.md', 'CLAUDE.md', 'docs/installation.md', 'docs/configuration.md', 'docs/testing.md']) assert(existsSync(path), `Missing project file: ${path}`);
console.log(`HACS package, MIT notices and public SDK provenance passed (${Buffer.byteLength(bundle)} bytes).`);
