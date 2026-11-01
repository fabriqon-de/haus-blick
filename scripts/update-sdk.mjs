import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const [input, commit] = process.argv.slice(2);
if (!input || !/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Usage: node scripts/update-sdk.mjs /path/to/clean/sdk COMMIT_SHA');
const source = resolve(input), destination = resolve('vendor/fabriqon-sdk');
if (source === destination) throw new Error('Use a separate SDK checkout.');
const run = (command, args) => execFileSync(command, args, { cwd: source, encoding: 'utf8' }).trim();
if (run('git', ['rev-parse', 'HEAD']) !== commit) throw new Error('SDK checkout does not match the requested commit.');
run('git', ['diff', '--exit-code', 'HEAD', '--', 'src', 'package.json', 'package-lock.json', 'LICENSE']);
if (run('git', ['ls-files', '--others', '--exclude-standard', '--', 'src'])) throw new Error('SDK contains untracked source inputs.');
run('npm', ['run', 'build']);
rmSync(destination, { recursive: true, force: true }); mkdirSync(destination, { recursive: true });
for (const name of ['dist', 'LICENSE']) cpSync(resolve(source, name), resolve(destination, name), { recursive: true });
const upstream = JSON.parse(readFileSync(resolve(source, 'package.json'), 'utf8'));
const pkg = { name: upstream.name, version: upstream.version, private: true, type: 'module', license: upstream.license,
  exports: { '.': upstream.exports['.'], './viewer': upstream.exports['./viewer'] },
  peerDependencies: upstream.peerDependencies, peerDependenciesMeta: upstream.peerDependenciesMeta };
writeFileSync(resolve(destination, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
const files = {};
function collect(directory = '') {
  for (const entry of readdirSync(resolve(destination, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collect(name);
    else files[name] = createHash('sha256').update(readFileSync(resolve(destination, name))).digest('hex');
  }
}
collect();
writeFileSync(resolve(destination, 'provenance.json'), JSON.stringify({ repository: 'https://github.com/fabriqon-de/sdk', commit, version: pkg.version, files }, null, 2) + '\n');
console.log('Public SDK runtime snapshot generated; update the package lock and third-party notices before building.');
