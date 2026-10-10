import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createSearchIndex} from './build-search-index.mjs';
import {buildBossPages} from './build-boss-pages.mjs';
import {writeMapGraph} from './build-map-graph.mjs';
import {verifyHistoricalArchive} from './public-content-policy.mjs';
const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(root, '_site');
verifyHistoricalArchive(root);
// The only directory removed by this build is this repository's generated artifact.
if (output !== path.join(root, '_site') || path.dirname(output) !== root) throw new Error('Unsafe build output');
fs.rmSync(output, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
fs.mkdirSync(output, {recursive: true});
const mapGraph = writeMapGraph({root});
// Region outlines are a separate, image-relative source document. Only the
// reviewed public seed is compiled; browser drafts never enter the build.
const regionDocument = JSON.parse(fs.readFileSync(path.join(root, 'data/map-regions.json'), 'utf8'));
const regionValidator = new JSDOM('', {url: 'https://nameless-sao.fr/carte', runScripts: 'outside-only'});
try {
    regionValidator.window.eval(fs.readFileSync(path.join(root, 'js/map-regions.js'), 'utf8'));
    const checkedRegions = regionValidator.window.NamelessMapRegions.validateDocument(
        regionValidator.window.JSON.parse(JSON.stringify(regionDocument)), mapGraph.catalog);
    fs.writeFileSync(path.join(root, 'assets/map/regions.json'), JSON.stringify(checkedRegions));
} finally { regionValidator.window.close(); }
for (const name of ['assets', 'css', 'js', 'pages']) fs.cpSync(path.join(root, name), path.join(output, name), {recursive: true});
for (const name of ['index.html', '404.html', 'CNAME', '.nojekyll']) fs.copyFileSync(path.join(root, name), path.join(output, name));
const registry = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/page-registry.js'), 'utf8'), registry);
const routes = registry.window.NamelessPageRegistry.routes;
for (const route of routes) {
    if (route.path === '/') continue;
    const source = fs.readFileSync(path.join(root, route.source), 'utf8').replace(/^\uFEFF/, '');
    const dom = new JSDOM(source, {url: 'https://nameless-sao.fr/' + route.source});
    const doc = dom.window.document;
    // Assets and legacy page URLs keep their meaning on /route/ directory URLs.
    doc.querySelectorAll('[href],[src]').forEach(element => {
        for (const attr of ['href','src']) {
            const value = element.getAttribute(attr);
            if (!value || value.startsWith('#') || /^[a-z][\w+.-]*:/i.test(value) || value.startsWith('//')) continue;
            const absolute = new URL(value, dom.window.location.href);
            element.setAttribute(attr, absolute.pathname + absolute.search + absolute.hash);
        }
    });
    const dir = path.join(output, route.path.slice(1));
    fs.mkdirSync(dir, {recursive:true});
    fs.writeFileSync(path.join(dir,'index.html'), dom.serialize());
    dom.window.close();
}
const index = createSearchIndex({mapGraph});
const bossPages = buildBossPages({root, output, mapGraph});
fs.writeFileSync(path.join(output,'assets/search-index.json'), JSON.stringify(index));
// Keep the committed preview index aligned with the same source of truth.
fs.writeFileSync(path.join(root,'assets/search-index.json'), JSON.stringify(index));
const publicRoutes = routes.filter(r => !['connexion','profil','espace-guilde','admin-dashboard','admin-carte','confidentialite','conditions','quetes'].includes(r.id));
const urls = publicRoutes.concat(bossPages).map(r => '  <url><loc>https://nameless-sao.fr' + (r.path === '/' ? '/' : r.path) + '</loc></url>').join('\n');
fs.writeFileSync(path.join(output,'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls+'\n</urlset>\n');
fs.writeFileSync(path.join(output,'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /profil\nDisallow: /espace-guilde\nDisallow: /admin-dashboard\nDisallow: /admin-carte\nDisallow: /pages/profil.html\nDisallow: /pages/espace-guilde.html\nDisallow: /pages/admin-dashboard.html\nDisallow: /pages/admin-carte.html\nSitemap: https://nameless-sao.fr/sitemap.xml\n');
console.log('Built ' + routes.length + ' routes, ' + bossPages.length + ' boss pages with HTTP 200 documents, ' + index.entries.length + ' search entries.');
