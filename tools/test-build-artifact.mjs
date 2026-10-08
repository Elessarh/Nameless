// Verify the actual publication artifact, including clean and legacy URLs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const origin = 'https://nameless-sao.fr';
const build = spawnSync(process.execPath, ['tools/build-site.mjs'], {
    cwd: root, encoding: 'utf8', env: process.env, timeout: 60000
});
assert.ifError(build.error);
assert.equal(build.status, 0, 'Publication build failed:\n' + build.stdout + build.stderr);

const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/page-registry.js'), 'utf8'), scope);
const routes = scope.window.NamelessPageRegistry.routes;
const nonPublic = new Set(['connexion', 'profil', 'espace-guilde', 'admin-dashboard', 'confidentialite', 'conditions', 'quetes']);
let htmlCount = 0;
let localReferences = 0;

function publicFile(url) {
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { assert.fail('Malformed local asset URL: ' + url.href); }
    let file = path.resolve(output, '.' + pathname);
    assert.ok(file === output || file.startsWith(output + path.sep), 'Asset escapes the artifact: ' + url.href);
    assert.ok(fs.existsSync(file), 'Missing published local resource: ' + url.href);
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), 'Missing published entry document: ' + url.href);
    return file;
}

function checkReference(raw, pageUrl) {
    if (!raw || raw.startsWith('#')) return;
    const url = new URL(raw, pageUrl);
    if (url.origin !== origin) return;
    publicFile(url);
    localReferences++;
}

function verifyHtml(file, pageUrl) {
    const dom = new JSDOM(fs.readFileSync(file, 'utf8'), { url: pageUrl });
    const doc = dom.window.document;
    try {
        assert.equal(doc.documentElement.lang, 'fr', pageUrl + ': missing document language');
        assert.ok(doc.head.querySelector('title')?.textContent.trim(), pageUrl + ': title escaped the head');
        assert.ok(doc.head.querySelector('meta[charset]'), pageUrl + ': charset escaped the head');
        assert.ok(doc.head.querySelector('meta[name="viewport"]'), pageUrl + ': viewport escaped the head');
        const policies = [...doc.querySelectorAll('meta[http-equiv]')]
            .filter((meta) => meta.httpEquiv.toLowerCase() === 'content-security-policy');
        assert.equal(policies.length, 1, pageUrl + ': CSP is missing or duplicated');
        assert.equal(policies[0].parentElement, doc.head, pageUrl + ': CSP escaped the head (BOM/parser regression)');
        assert.match(policies[0].content, /(?:^|;)\s*script-src\s+'self'\s*;/, pageUrl + ': executable scripts are no longer restricted to self');
        assert.equal(doc.body.querySelector('meta, title'), null, pageUrl + ': head metadata was parsed into the body');
        assert.equal(doc.querySelectorAll('main#main-content').length, 1, pageUrl + ': persistent SPA main is missing or duplicated');
        assert.ok(doc.querySelector('h1'), pageUrl + ': no page heading');
        for (const element of doc.querySelectorAll('[src], [href]')) {
            for (const attribute of ['src', 'href']) checkReference(element.getAttribute(attribute), pageUrl);
        }
        for (const element of doc.querySelectorAll('[srcset]')) {
            for (const candidate of element.getAttribute('srcset').split(',')) {
                checkReference(candidate.trim().split(/\s+/)[0], pageUrl);
            }
        }
        htmlCount++;
        return {
            title: doc.title,
            mainIds: [...doc.querySelectorAll('main [id]')].map((element) => element.id),
            robots: doc.head.querySelector('meta[name="robots"]')?.content || ''
        };
    } finally { dom.window.close(); }
}

for (const route of routes) {
    const cleanUrl = origin + (route.path === '/' ? '/' : route.path + '/');
    const clean = verifyHtml(publicFile(new URL(cleanUrl)), cleanUrl);
    const legacyUrl = origin + '/' + route.source;
    const legacyFile = publicFile(new URL(legacyUrl));
    assert.deepEqual(fs.readFileSync(legacyFile), fs.readFileSync(path.join(root, route.source)), route.source + ': legacy page was altered or omitted');
    if (route.path !== '/') {
        const legacy = verifyHtml(legacyFile, legacyUrl);
        assert.equal(clean.title, legacy.title, route.path + ': title differs between clean and legacy URLs');
        assert.deepEqual(clean.mainIds, legacy.mainIds, route.path + ': SPA controls differ between clean and legacy URLs');
    }
    if (nonPublic.has(route.id)) assert.match(clean.robots, /(?:^|,|\s)noindex(?:,|\s|$)/, route.path + ': member/auth page became indexable');
}
verifyHtml(path.join(output, '404.html'), origin + '/404.html');

const sitemapText = fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8');
const sitemap = new JSDOM(sitemapText, { contentType: 'application/xml' });
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const sitemapRoot = sitemap.window.document.documentElement;
assert.equal(sitemapRoot.localName, 'urlset', 'Sitemap must be a valid urlset XML document');
assert.equal(sitemapRoot.namespaceURI, namespace, 'Sitemap namespace is invalid');
const locations = [...sitemapRoot.getElementsByTagNameNS(namespace, 'loc')].map((element) => element.textContent.trim());
sitemap.window.close();
assert.equal(new Set(locations).size, locations.length, 'Sitemap contains duplicate URLs');
for (const route of routes.filter((route) => !nonPublic.has(route.id))) {
    assert.ok(locations.includes(origin + route.path), 'Public route missing from sitemap: ' + route.path);
}
for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, origin, 'Sitemap points to another host');
    assert.equal(url.search + url.hash, '', 'Sitemap includes a query/hash alias');
    assert.ok(!url.pathname.startsWith('/pages/'), 'Legacy aliases create duplicate sitemap entries');
    assert.ok(!routes.some((route) => nonPublic.has(route.id) && (url.pathname === route.path || url.pathname === route.path + '/')), 'Private route leaked into sitemap');
    const file = publicFile(url);
    if (url.pathname.startsWith('/boss/')) verifyHtml(file, url.href + '/');
}

const directives = fs.readFileSync(path.join(output, 'robots.txt'), 'utf8').split(/\r?\n/)
    .map((line) => line.replace(/\s*#.*$/, '').trim()).filter(Boolean).map((line) => {
        const separator = line.indexOf(':');
        assert.ok(separator > 0, 'Malformed robots.txt line: ' + line);
        return { name: line.slice(0, separator).toLowerCase(), value: line.slice(separator + 1).trim() };
    });
assert.ok(directives.some((entry) => entry.name === 'user-agent' && entry.value === '*'), 'Robots file lacks a general crawler group');
assert.ok(directives.some((entry) => entry.name === 'allow' && entry.value === '/'), 'Public site is blocked for crawlers');
assert.deepEqual(directives.filter((entry) => entry.name === 'sitemap').map((entry) => entry.value), [origin + '/sitemap.xml']);
for (const id of ['profil', 'espace-guilde', 'admin-dashboard']) {
    const route = routes.find((route) => route.id === id);
    for (const blocked of [route.path, '/' + route.source]) {
        assert.ok(directives.some((entry) => entry.name === 'disallow' && entry.value === blocked), 'Missing private robots exclusion: ' + blocked);
    }
}

const allowedTop = new Set(['assets', 'css', 'js', 'pages', 'boss', 'index.html', '404.html', 'CNAME', '.nojekyll', 'sitemap.xml', 'robots.txt',
    ...routes.map((route) => route.path.split('/')[1]).filter(Boolean)]);
for (const name of fs.readdirSync(output)) assert.ok(allowedTop.has(name), 'Unexpected publication file/directory: ' + name);
const forbidden = new Set(['supabase', 'docs', 'tools', 'node_modules', '.git', '.github', 'package.json', 'package-lock.json']);
function inspectTree(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        assert.ok(!entry.isSymbolicLink(), 'Publication contains an unsafe symbolic link: ' + path.join(dir, entry.name));
        assert.ok(!forbidden.has(entry.name) && !/^\.env(?:\.|$)/.test(entry.name), 'Private/server/build content leaked into publication: ' + path.join(dir, entry.name));
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) inspectTree(file);
        else if (entry.name.endsWith('.css')) {
            const cssUrl = origin + '/' + path.relative(output, file).split(path.sep).join('/');
            const css = fs.readFileSync(file, 'utf8');
            for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) checkReference(match[1], cssUrl);
        }
    }
}
inspectTree(output);
console.log(`PASS: publication build, ${htmlCount} HTML documents, ${localReferences} local references, CSP/head placement, legacy URLs, public sitemap, robots exclusions and artifact allowlist.`);
