// SRI protects exact bytes: Git checkout must not change a protected asset's
// line endings between a Windows preview and the Linux publication build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {JSDOM} from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const origin = 'https://nameless-sao.fr';
const files = ['index.html', '404.html', ...fs.readdirSync(path.join(root, 'pages')).filter(name => name.endsWith('.html')).map(name => 'pages/' + name)];
const protectedAssets = new Set();
let references = 0;

for (const file of files) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {url: origin + '/' + file});
    try {
        for (const element of dom.window.document.querySelectorAll('[integrity]')) {
            const url = new URL(element.getAttribute('src') || element.getAttribute('href'), dom.window.location.href);
            if (url.origin !== origin) continue;
            const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
            const asset = path.resolve(root, relative);
            assert.ok(asset.startsWith(root + path.sep), 'Protected asset stays inside the source workspace: ' + url.pathname);
            const bytes = fs.readFileSync(asset);
            const linuxBytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
            const tokens = element.getAttribute('integrity').trim().split(/\s+/);
            assert.ok(tokens.length, file + ': empty SRI metadata');
            for (const token of tokens) {
                const match = /^sha(256|384|512)-([a-z0-9+/]+=*)$/i.exec(token);
                assert.ok(match, file + ': unsupported integrity token ' + token);
                const digest = content => createHash('sha' + match[1]).update(content).digest('base64');
                assert.equal(digest(bytes), match[2], file + ': SRI must match actual asset bytes ' + relative);
                assert.equal(digest(linuxBytes), match[2], file + ': SRI must also match normalized Linux checkout bytes ' + relative);
            }
            protectedAssets.add(relative);
            references++;
        }
    } finally { dom.window.close(); }
}

assert.equal(references, 4, 'Public and administrator maps both retain Leaflet stylesheet and script integrity checks');
assert.deepEqual([...protectedAssets].sort(), ['css/vendor/leaflet-1.9.4.css', 'js/vendor/leaflet-1.9.4.js']);
const attributes = spawnSync('git', ['check-attr', '-z', 'text', 'eol', '--', ...protectedAssets], {cwd: root, encoding: 'utf8'});
assert.ifError(attributes.error);
assert.equal(attributes.status, 0, 'Read effective Git checkout attributes: ' + attributes.stderr);
const parts = attributes.stdout.split('\0');
const effective = new Map();
for (let index = 0; index + 2 < parts.length; index += 3) effective.set(parts[index] + ':' + parts[index + 1], parts[index + 2]);
for (const asset of protectedAssets) {
    assert.equal(effective.get(asset + ':text'), 'set', asset + ': Git must explicitly normalize this protected text asset');
    assert.equal(effective.get(asset + ':eol'), 'lf', asset + ': Git must retain identical LF bytes on Linux and Windows checkouts');
}

console.log('Vendor integrity passed: 4 protected local HTML references, exact bytes, Linux normalization and effective portable LF checkout rules.');
