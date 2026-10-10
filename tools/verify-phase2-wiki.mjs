/** Focused Wiki phase browser evidence. Existing Playwright/Chromium only.
 * Before implementation: node tools/verify-phase2-wiki.mjs --before
 * After a build + stable :4173 preview: node tools/verify-phase2-wiki.mjs --after
 * No backend mutation, package installation, real account or deployment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const stage = process.argv.includes('--before') ? 'before' : 'after';
const base = process.env.NAMELESS_BASE_URL || 'http://127.0.0.1:4173';
const output = path.resolve('docs/phase2-wiki-2026-10-09');
const profile = process.env.USERPROFILE || 'C:/Users/julie';
const playwrightModule = process.env.NAMELESS_PLAYWRIGHT_MODULE || path.join(profile, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const chromiumFile = process.env.NAMELESS_CHROMIUM || path.join(profile, 'AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe');
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const browser = await chromium.launch({ executablePath: chromiumFile, headless: true });
fs.mkdirSync(output, { recursive: true });
const viewports = [
    { width: 360, height: 844 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
    { width: 1280, height: 1080 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }
];
// Existing native hash router in js/wiki.js; actual article has four sections.
const article = 'debuter';
const report = { stage, base, article: '/wiki/#' + article, browser: browser.version(), generatedAt: new Date().toISOString(), captures: [], layouts: [], checks: [], errors: [], cancelledRequests: [], external: [] };
function observe(page, name) {
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => report.errors.push({ page: name, message: error.message }));
    page.on('requestfailed', request => {
        const item = { page: name, url: request.url(), message: request.failure()?.errorText };
        if (item.message === 'net::ERR_ABORTED') report.cancelledRequests.push(item);
        else (request.url().startsWith(base) ? report.errors : report.external).push(item);
    });
    page.on('response', response => { if (response.status() >= 400) (response.url().startsWith(base) ? report.errors : report.external).push({ page: name, url: response.url(), status: response.status() }); });
}
async function context(viewport, options = {}) {
    const ctx = await browser.newContext({ viewport, locale: 'fr-FR', deviceScaleFactor: 1, ...options });
    await ctx.addInitScript(() => { if (!localStorage.getItem('nameless-language')) localStorage.setItem('nameless-language', 'fr'); });
    await ctx.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
            report.external.push({ url: url.href, method: request.method(), blockedNonGet: true });
            await route.abort();
        } else await route.continue();
    });
    return ctx;
}
async function visit(page, route = '/wiki/') {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.locator('.wiki-page.active').waitFor();
    await page.waitForFunction(() => !!window.NamelessWikiPage && document.fonts.status === 'loaded');
    await page.waitForTimeout(600);
}
async function screenshot(page, name, options = {}) {
    const file = stage + '-' + name + '.png';
    await page.screenshot({ path: path.join(output, file), ...options });
    report.captures.push({ file, url: page.url(), viewport: page.viewportSize(), language: await page.locator('html').getAttribute('lang') });
    console.log('Captured ' + file);
}
async function layout(page, name) {
    const data = await page.evaluate(() => {
        const active = document.querySelector('.wiki-page.active');
        const sidebar = document.querySelector('#wiki-sidebar'), content = document.querySelector('.wiki-content');
        const rect = node => { const r = node?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: r.width, height: r.height }; };
        return { viewportWidth: innerWidth, viewportHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth, activePage: active?.id, title: active?.querySelector('h1')?.textContent.trim(), headingCount: active?.querySelectorAll('h2,h3').length, articleCharacters: active?.textContent.trim().length, language: document.documentElement.lang, sidebar: rect(sidebar), content: rect(content), tocLinks: [...(active?.querySelectorAll('.wiki-toc a') || [])].map(link => ({ text: link.textContent, href: link.getAttribute('href') })), brokenImages: [...document.images].filter(img => img.checkVisibility() && img.complete && !img.naturalWidth).map(img => img.currentSrc || img.src) };
    });
    report.layouts.push({ name, url: page.url(), ...data });
    return data;
}
async function check(name, action) {
    console.log('Check ' + name);
    try { report.checks.push({ name, passed: true, detail: await action() }); }
    catch (error) { report.checks.push({ name, passed: false, message: error.message }); console.log('FAILED ' + error.message); }
}

try {
    // Capture every reference first, allowing early visual review before behavior QA.
    for (const viewport of viewports) {
        const ctx = await context(viewport);
        const page = await ctx.newPage(); observe(page, 'wiki-' + viewport.width);
        await visit(page);
        if (stage === 'before' && viewport.width === 360) {
            report.existingArticleIds = await page.locator('.wiki-page').evaluateAll(pages => pages.map(page => page.id));
            report.existingNavigationTargets = await page.locator('[data-page]').evaluateAll(links => links.map(link => link.dataset.page));
        }
        await screenshot(page, `home-${viewport.width}x${viewport.height}`);
        await layout(page, 'home-' + viewport.width);
        await visit(page, '/wiki/#' + article);
        await screenshot(page, `article-${viewport.width}x${viewport.height}`);
        await layout(page, 'article-' + viewport.width);
        if (viewport.width === 1920) {
            const clip = await page.evaluate(() => ({ x: 0, y: 0, width: innerWidth, height: document.documentElement.scrollHeight }));
            await screenshot(page, 'article-full-1920', { fullPage: true, clip });
            await page.locator('[data-language-option="en"]').click();
            await page.waitForTimeout(400);
            await screenshot(page, 'article-en-1920x1080');
            await layout(page, 'article-en-1920');
        }
        await ctx.close();
    }
    fs.writeFileSync(path.join(output, stage + '-capture-manifest.json'), JSON.stringify({ stage, captures: report.captures, layouts: report.layouts }, null, 2) + '\n');
    console.log('BASELINE IMAGES READY: ' + report.captures.length);
    if (stage === 'after') await behavioralChecks();
} finally {
    fs.writeFileSync(path.join(output, stage + '-verification.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
}
if (report.checks.some(item => !item.passed)) process.exitCode = 1;

async function behavioralChecks() {
    for (const item of report.layouts) await check(item.name + ': responsive bounds and visible images', async () => {
        assert.equal(item.scrollWidth, item.viewportWidth);
        assert.deepEqual(item.brokenImages, []);
        return { width: item.viewportWidth, activePage: item.activePage };
    });
    const ctx = await context({ width: 1920, height: 1080 });
    const page = await ctx.newPage(); observe(page, 'desktop-interactions');
    await check('All existing articles and native category destinations are retained', async () => {
        await visit(page);
        const baseline = JSON.parse(fs.readFileSync(path.join(output, 'before-verification.json'), 'utf8'));
        const ids = await page.locator('.wiki-page').evaluateAll(pages => pages.map(p => p.id));
        for (const id of baseline.existingArticleIds) assert.ok(ids.includes(id), 'Existing article retained: ' + id);
        const categories = await page.locator('a.wiki-portal[data-page],a.wiki-category[data-page]').evaluateAll(links => links.map(link => ({ page: link.dataset.page, href: link.getAttribute('href'), title: link.textContent.trim() })));
        assert.equal(categories.length, 12);
        assert.equal(await page.locator('a.wiki-portal').count(), 3);
        assert.equal(await page.locator('a.wiki-category').count(), 9);
        assert.ok(categories.every(link => ids.includes('page-' + link.page) && link.href.includes('#' + link.page)));
        const invalid = await page.locator('[data-page]').evaluateAll(links => links.filter(link => !document.getElementById('page-' + link.dataset.page)).map(link => link.dataset.page));
        assert.deepEqual(invalid, []);
        return { retainedArticles: baseline.existingArticleIds.length, priorities: 3, secondaryCategories: 9 };
    });
    await check('Category keyboard navigation and native modified-click work', async () => {
        await visit(page);
        const category = page.locator('a.wiki-portal').first();
        const target = await category.getAttribute('data-page');
        await category.focus();
        await page.keyboard.press('Enter');
        await activePage(page, target);
        assert.ok(await page.locator('.wiki-page.active h1').evaluate(h => h === document.activeElement));
        await visit(page);
        const newPage = ctx.waitForEvent('page');
        await page.locator('a.wiki-category').first().click({ modifiers: ['Control'] });
        const tab = await newPage;
        try {
            await tab.waitForLoadState('domcontentloaded');
            await tab.locator('.wiki-page.active').waitFor();
            assert.ok(new URL(tab.url()).hash.length > 1, 'Native article link opens a real hash URL');
        } finally { await tab.close(); }
        return { keyboard: true, nativeNewTab: true };
    });
    await check('Local search focuses once, finds a real article and supports keyboard/empty states', async () => {
        await visit(page);
        await page.locator('[data-wiki-search]').click();
        const input = page.locator('#wiki-search');
        assert.ok(await input.evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('#wiki-search').count(), 1);
        assert.equal(await page.locator('#nameless-global-search').evaluate(el => el.open), false);
        await input.fill('Débuter');
        await page.locator('#wiki-search-results button').first().waitFor();
        await page.keyboard.press('ArrowDown');
        assert.ok(await page.locator('#wiki-search-results button').first().evaluate(el => el === document.activeElement));
        // Broad queries can also match a parent guide's body. Select the actual
        // article through its visible result, rather than assuming rank one.
        const resultIds = await page.locator('#wiki-search-results button').evaluateAll(nodes => nodes.map(node => node.dataset.page));
        const selectedIndex = resultIds.indexOf(article);
        assert.ok(selectedIndex >= 0, 'The existing article is included in real search results');
        for (let index = 0; index < selectedIndex; index++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await activePage(page, article);
        assert.equal(await input.getAttribute('aria-expanded'), 'false');
        assert.ok(await page.locator('.wiki-page.active h1').evaluate(el => el === document.activeElement));
        await input.fill('nameless-no-result-qa-84721');
        await page.locator('#wiki-search-results .is-empty').waitFor();
        assert.equal(await page.locator('#wiki-search-results button').count(), 0);
        await input.fill('');
        await page.waitForFunction(() => document.querySelector('#wiki-search').getAttribute('aria-expanded') === 'false');
        return { uniqueLocalSearch: true, query: 'Débuter', realArticle: article, noMatch: true };
    });
    await check('Sidebar groups retain ARIA state; selected article remains accessible after scroll', async () => {
        await visit(page);
        const link = page.locator('#wiki-nav a[data-page="' + article + '"]');
        const group = link.locator('xpath=ancestor::li[contains(concat(" ",normalize-space(@class)," ")," wiki-nav-group ")][1]');
        const header = group.locator('.wiki-nav-group-header');
        const initial = await header.getAttribute('aria-expanded');
        await header.click();
        assert.equal(await header.getAttribute('aria-expanded'), initial === 'true' ? 'false' : 'true');
        assert.equal(await group.locator('.wiki-nav-group-children').evaluate(el => el.hidden), initial === 'true');
        if (await header.getAttribute('aria-expanded') === 'false') await header.click();
        assert.equal(await header.getAttribute('aria-expanded'), 'true');
        await link.click();
        await activePage(page, article);
        assert.equal(await link.getAttribute('aria-current'), 'page');
        // Sticky navigation is bounded by its Wiki layout and should scroll out
        // before the site footer. Exercise the actual available sticky range.
        const stickyRange = await page.evaluate(() => {
            const side = document.querySelector('#wiki-sidebar'), layout = document.querySelector('.wiki-layout');
            const boundary = layout.getBoundingClientRect().bottom - parseFloat(getComputedStyle(layout).paddingBottom);
            return Math.max(0, boundary - side.getBoundingClientRect().height - parseFloat(getComputedStyle(side).top) + scrollY);
        });
        const stickyScroll = Math.min(200, stickyRange / 2);
        assert.ok(stickyScroll > 0, 'The desktop article provides a real sticky range');
        await page.evaluate(y => scrollTo(0, y), stickyScroll);
        await page.waitForTimeout(450);
        const sticky = await page.evaluate(() => ({ sidebar: document.querySelector('#wiki-sidebar').getBoundingClientRect().top, header: document.querySelector('.header').getBoundingClientRect().bottom, pageY: scrollY }));
        assert.ok(sticky.sidebar >= sticky.header - 2 && sticky.sidebar <= sticky.header + 40, 'Sidebar stays directly below the persistent header');
        const previousY = await page.evaluate(() => scrollY);
        await page.locator('#wiki-nav').evaluate(nav => { nav.scrollTop = 650; });
        assert.equal(await page.evaluate(() => scrollY), previousY, 'Sidebar scroll does not move the article');
        await page.evaluate(() => scrollTo(0, 650));
        await page.waitForTimeout(450);
        const endBounds = await page.evaluate(() => ({ sidebarBottom: document.querySelector('#wiki-sidebar').getBoundingClientRect().bottom, wikiBottom: document.querySelector('.wiki-layout').getBoundingClientRect().bottom, scrollY }));
        assert.ok(endBounds.sidebarBottom <= endBounds.wikiBottom + 1, 'Sidebar remains inside its reading layout before the footer');
        return { ...sticky, availableStickyRange: stickyRange, endBounds };
    });
    await check('Article TOC targets stable headings, moves focus and respects header offset', async () => {
        await visit(page, '/wiki/#' + article);
        const toc = page.locator('.wiki-page.active .wiki-toc');
        assert.equal(await toc.count(), 1);
        const links = await toc.locator('a').evaluateAll(nodes => nodes.map(a => ({ text: a.textContent, href: a.getAttribute('href') })));
        assert.equal(links.length, 4);
        for (const item of links) {
            const section = new URL(item.href, page.url()).hash.slice(1).split('/')[1];
            assert.ok(section);
            assert.ok(await page.locator('.wiki-page.active').evaluate((el, id) => !!el.querySelector('#' + CSS.escape(id)), section));
        }
        await toc.locator('a').nth(1).click();
        const sectionId = new URL(page.url()).hash.slice(1).split('/')[1];
        await page.waitForFunction(id => document.activeElement?.id === id, sectionId);
        await page.waitForTimeout(650);
        const anchor = await page.evaluate(id => ({ heading: document.getElementById(id).getBoundingClientRect().top, header: document.querySelector('.header').getBoundingClientRect().bottom, id: document.activeElement.id, scrollY, viewportHeight: innerHeight }), sectionId);
        assert.ok(anchor.heading >= anchor.header - 2, 'Anchor is visible below the header');
        assert.ok(anchor.heading < anchor.viewportHeight - 64, 'Target heading is inside the visible reading area');
        const currentSection = await toc.locator('a[aria-current="location"]').getAttribute('data-section');
        assert.equal(currentSection, sectionId, 'The observed section is the active TOC link');
        const tocBounds = await toc.boundingBox();
        assert.ok(tocBounds.y >= anchor.header - 2 && tocBounds.y <= anchor.header + 40, 'Desktop TOC stays directly below the header');
        await screenshot(page, 'article-anchor-1920x1080');
        return { links, anchor, currentSection, tocTop: tocBounds.y };
    });
    await check('Real article subsections retain a nested TOC hierarchy', async () => {
        await visit(page);
        const candidate = await page.locator('.wiki-page').evaluateAll(pages => pages.find(p => p.id !== 'page-accueil' && p.querySelector('h2') && p.querySelector('h3') && p.querySelectorAll('h2,h3').length >= 3)?.id.replace('page-', ''));
        if (!candidate) return { applicable: false, reason: 'No existing article contains three headings including H3.' };
        await visit(page, '/wiki/#' + candidate);
        const count = await page.locator('.wiki-page.active h3').count();
        assert.equal(await page.locator('.wiki-page.active .wiki-toc-subsection').count(), count);
        return { realArticle: candidate, nestedSubsections: count };
    });
    await check('Related links and previous/next use real articles, with history restored', async () => {
        await visit(page, '/wiki/#' + article);
        const related = page.locator('.wiki-page.active .wiki-related-links a[data-page]');
        assert.ok(await related.count() >= 1);
        const relations = await related.evaluateAll(links => links.map(link => link.dataset.page));
        const next = page.locator('.wiki-page.active .wiki-article-next');
        assert.equal(await next.count(), 1);
        const nextId = await next.getAttribute('data-page');
        await next.click();
        await activePage(page, nextId);
        assert.ok(await page.locator('.wiki-page.active h1').evaluate(el => el === document.activeElement));
        await page.goBack();
        await activePage(page, article);
        const previous = page.locator('.wiki-page.active .wiki-article-prev');
        const prevId = await previous.getAttribute('data-page');
        await previous.click();
        await activePage(page, prevId);
        await page.goBack();
        await activePage(page, article);
        await page.goForward();
        await activePage(page, prevId);
        return { article, previous: prevId, next: nextId, related: relations };
    });
    await check('Direct article/anchor URLs and SPA search entry preserve the Wiki route', async () => {
        await visit(page, '/wiki/#' + article);
        const anchorHref = await page.locator('.wiki-page.active .wiki-toc a').last().getAttribute('href');
        await visit(page, new URL(anchorHref, page.url()).pathname + new URL(anchorHref, page.url()).hash);
        await activePage(page, article);
        assert.ok(await page.locator('.wiki-page.active .wiki-article-body h2').last().evaluate(el => el === document.activeElement));
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.NamelessGlobalSearch);
        await page.evaluate(() => { window.__qaHeader = document.querySelector('.header'); });
        await page.locator('.nm-search-trigger').click();
        await page.locator('#nm-global-query').fill('Débuter');
        const result = page.locator('.nm-search-entry-link[href$="#' + article + '"]').first();
        await result.waitFor();
        await result.click();
        await activePage(page, article);
        assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), '/wiki');
        assert.ok(await page.evaluate(() => window.__qaHeader === document.querySelector('.header')));
        assert.equal(await page.locator('.wiki-page.active .wiki-toc').count(), 1);
        return { directAnchor: anchorHref, spaEntry: '/wiki#' + article, persistentHeader: true };
    });
    await check('FR/EN rebuilds article UI/search coherently and survives reload and SPA', async () => {
        await visit(page, '/wiki/#' + article);
        const originalHash = new URL(page.url()).hash;
        const ids = await page.locator('.wiki-page.active h2').evaluateAll(headings => headings.map(h => h.id));
        await page.locator('#wiki-search').fill('Débuter');
        await page.locator('[data-language-option="en"]').click();
        await page.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('.wiki-page.active h1')?.textContent.includes('Start'));
        assert.equal(await page.locator('#wiki-search').inputValue(), 'Débuter');
        assert.equal(new URL(page.url()).hash, originalHash);
        assert.deepEqual(await page.locator('.wiki-page.active h2').evaluateAll(headings => headings.map(h => h.id)), ids);
        const chrome = await page.locator('.wiki-page.active .wiki-article-label,.wiki-page.active .wiki-toc,.wiki-page.active .wiki-article-pagination').allTextContents();
        assert.ok(chrome.every(text => !/Dans cet article|Précédent|Suivant|Guide de terrain/.test(text)), 'New article controls follow English');
        await page.locator('#wiki-search').fill('Start');
        await page.locator('#wiki-search-results button').first().waitFor();
        assert.match(await page.locator('#wiki-search-results').textContent(), /Start/);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await activePage(page, article);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await page.locator('.nav-logo-container a').click();
        await page.locator('.home-page').waitFor();
        await page.locator('.header .nav-menu a[href$="/wiki"],.header .nav-menu a[href$="/wiki/"]').first().click();
        await activePage(page, 'accueil');
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await page.locator('[data-language-option="fr"]').click();
        const arrivalGroup = page.locator('#wiki-nav a[data-page="' + article + '"]').locator('xpath=ancestor::li[contains(concat(" ",normalize-space(@class)," ")," wiki-nav-group ")][1]');
        if (await arrivalGroup.locator('.wiki-nav-group-header').getAttribute('aria-expanded') === 'false') await arrivalGroup.locator('.wiki-nav-group-header').click();
        await page.locator('#wiki-nav a[data-page="' + article + '"]').click();
        await activePage(page, article);
        assert.match(await page.locator('.wiki-page.active h1').textContent(), /Débuter/);
        return { stableHeadingIds: ids, queryPreserved: true, locales: ['fr', 'en'], persisted: true };
    });
    await ctx.close();
    await freshEnglishMountCheck();
    await mobileChecks();
    await reducedMotionChecks();
    await motionClip();
    await check('No JavaScript errors or local resource failures', async () => { assert.deepEqual(report.errors, []); return { errors: 0, cancelledRequests: report.cancelledRequests.length }; });
}

async function activePage(page, id) { await page.waitForFunction(id => document.querySelector('.wiki-page.active')?.id === 'page-' + id, id); }

async function freshEnglishMountCheck() {
    const ctx = await context({ width: 1920, height: 1080 });
    await ctx.addInitScript(() => localStorage.setItem('nameless-language', 'en'));
    const page = await ctx.newPage(); observe(page, 'fresh-english-spa-mount');
    await check('An English-first SPA Wiki mount translates the actual index, TOC and search content', async () => {
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.documentElement.lang === 'en' && !!window.NamelessSpaRouter);
        await page.locator('.header .nav-menu a[href$="/wiki"],.header .nav-menu a[href$="/wiki/"]').first().click();
        await activePage(page, 'accueil');
        assert.match(await page.locator('a.wiki-portal[data-page="systeme-classe"] strong').textContent(), /Classes & Skills/);
        assert.match(await page.locator('a.wiki-category[data-page="reglement-aincrad"] strong').textContent(), /Rules/);
        const warrior = page.locator('#wiki-nav a[data-page="guerrier"]');
        assert.match(await warrior.textContent(), /Warrior/);
        const group = warrior.locator('xpath=ancestor::li[contains(concat(" ",normalize-space(@class)," ")," wiki-nav-group ")][1]');
        if (await group.locator('.wiki-nav-group-header').getAttribute('aria-expanded') === 'false') await group.locator('.wiki-nav-group-header').click();
        await warrior.click();
        await activePage(page, 'guerrier');
        assert.match(await page.locator('.wiki-page.active h1').textContent(), /Warrior/);
        assert.match(await page.locator('.wiki-page.active .wiki-article-label').textContent(), /Classes & Skills/);
        assert.match(await page.locator('.wiki-page.active .wiki-toc').textContent(), /Key competencies/);
        assert.doesNotMatch(await page.locator('.wiki-page.active .wiki-toc').textContent(), /Compétences clés/);
        assert.match(await page.locator('.wiki-page.active .wiki-related h2').textContent(), /Continue reading/);
        assert.ok((await page.locator('.wiki-page.active .wiki-related-links small').allTextContents()).every(text => /Classes & Skills/.test(text)));
        await page.locator('#wiki-search').fill('key competencies');
        await page.locator('#wiki-search-results button[data-page="guerrier"]').waitFor();
        assert.match(await page.locator('#wiki-search-results button[data-page="guerrier"]').textContent(), /Warrior.*Classes & Skills/);
        return { freshLocale: 'en', spaMount: true, realArticle: 'guerrier', translatedSearchQuery: 'key competencies', generatedControls: ['TOC', 'category', 'related guides'] };
    });
    await ctx.close();
}

async function mobileChecks() {
    const ctx = await context({ width: 390, height: 844 });
    const page = await ctx.newPage(); observe(page, 'mobile-interactions');
    await check('Mobile sidebar opens with focus, traps keys, closes with Escape/overlay', async () => {
        await visit(page);
        const toggle = page.locator('#sidebar-toggle');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.ok(await page.locator('#wiki-search').evaluate(el => el === document.activeElement));
        assert.ok(await page.locator('.wiki-content').evaluate(el => el.inert));
        await page.waitForTimeout(400);
        await screenshot(page, 'sidebar-390x844');
        await page.evaluate(() => { const nodes = [...document.querySelectorAll('#wiki-sidebar a[href],#wiki-sidebar button:not([disabled]),#wiki-sidebar input:not([disabled])')].filter(el => el.checkVisibility() && !el.closest('[hidden]') && el.tabIndex >= 0); nodes[0].focus(); });
        await page.keyboard.press('Shift+Tab');
        assert.ok(await toggle.evaluate(el => el === document.activeElement));
        await page.keyboard.press('Tab');
        assert.ok(await page.locator('#wiki-sidebar').evaluate(el => el.contains(document.activeElement)));
        await page.keyboard.press('Escape');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.ok(await toggle.evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('.wiki-content').evaluate(el => el.inert), false);
        await toggle.click();
        const overlay = page.locator('#sidebar-overlay');
        const box = await overlay.boundingBox();
        await overlay.click({ position: { x: box.width - 6, y: Math.min(320, box.height - 10) } });
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.ok(await toggle.evaluate(el => el === document.activeElement));
        return { trappedFocus: true, escapeAndOverlayClose: true };
    });
    await check('Mobile local-search entry and article selection restore reading focus', async () => {
        await visit(page);
        await page.locator('[data-wiki-search]').click();
        assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'true');
        assert.ok(await page.locator('#wiki-search').evaluate(el => el === document.activeElement));
        await page.locator('#wiki-search').fill('Débuter');
        await page.locator('#wiki-search-results button').first().waitFor();
        await selectLocalArticleWithKeyboard(page, article);
        assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('.wiki-content').evaluate(el => el.inert), false);
        assert.ok(await page.locator('.wiki-page.active h1').evaluate(el => el === document.activeElement));
        assert.notEqual(await page.locator('body').evaluate(el => el.style.overflow), 'hidden');
        return { article, readingFocus: true };
    });
    await check('Mobile global and Wiki menus stay usable without two open navigation layers', async () => {
        await visit(page);
        await page.locator('#sidebar-toggle').click();
        await page.locator('#hamburger').click();
        assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'false', 'Opening the global menu closes the Wiki drawer');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('.wiki-content').evaluate(el => el.inert), false);
        await page.locator('#sidebar-toggle').click();
        assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        return { globalAndWikiMenus: 'exclusive' };
    });
    await check('Mobile article TOC, pagination and search controls meet touch target minimums', async () => {
        await visit(page, '/wiki/#' + article);
        const targets = await page.locator('#sidebar-toggle,.wiki-page.active .wiki-toc a,.wiki-page.active .wiki-article-pagination a').evaluateAll(nodes => nodes.filter(node => node.checkVisibility()).map(node => ({ class: node.className, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
        assert.ok(targets.length >= 7);
        assert.ok(targets.every(target => target.width >= 24 && target.height >= 24), 'WCAG 2.2 target-size minimum');
        await page.locator('.wiki-page.active .wiki-toc a').nth(1).click();
        await page.waitForTimeout(650);
        assert.ok(await page.locator('.wiki-page.active h2').nth(1).evaluate(el => el === document.activeElement));
        const headerBottom = await page.locator('.header').evaluate(el => el.getBoundingClientRect().bottom);
        assert.ok((await page.locator('.wiki-page.active h2').nth(1).boundingBox()).y >= headerBottom - 2);
        await screenshot(page, 'article-anchor-390x844');
        return targets;
    });
    await ctx.close();
}

async function reducedMotionChecks() {
    const ctx = await context({ width: 390, height: 844 }, { reducedMotion: 'reduce' });
    const page = await ctx.newPage(); observe(page, 'reduced-motion');
    await check('Reduced motion removes Wiki transitions and smooth anchor scrolling', async () => {
        await visit(page, '/wiki/#' + article);
        const styles = await page.locator('html,#wiki-sidebar,#sidebar-toggle,.wiki-page.active .wiki-toc a,.wiki-page.active .wiki-article-pagination a').evaluateAll(nodes => nodes.map(el => { const s = getComputedStyle(el); return { class: el.className, tag: el.tagName, scrollBehavior: s.scrollBehavior, animationName: s.animationName, animationDuration: s.animationDuration, transitionDuration: s.transitionDuration }; }));
        assert.equal(styles[0].scrollBehavior, 'auto');
        assert.ok(styles.every(s => s.animationName === 'none' || s.animationDuration.split(',').every(value => parseFloat(value) <= 0.01)));
        assert.ok(styles.every(s => s.transitionDuration.split(',').every(value => parseFloat(value) <= 0.01)));
        await page.locator('.wiki-page.active .wiki-toc a').nth(1).click();
        const section = new URL(page.url()).hash.slice(1).split('/')[1];
        assert.ok(await page.evaluate(id => document.activeElement.id === id, section));
        await screenshot(page, 'article-reduced-motion-390x844');
        return styles;
    });
    await ctx.close();
}

async function motionClip() {
    await check('Actual Wiki interactions are recorded in a short demonstration', async () => {
        const videoDir = path.join(output, 'video'); fs.mkdirSync(videoDir, { recursive: true });
        const ctx = await context({ width: 1280, height: 720 }, { recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } });
        const page = await ctx.newPage(); observe(page, 'motion-demo'); const started = Date.now();
        try {
            await visit(page);
            await page.locator('a.wiki-portal').first().hover(); await page.waitForTimeout(450);
            await page.locator('a.wiki-category').nth(1).hover(); await page.waitForTimeout(450);
            await page.locator('[data-wiki-search]').click();
            await page.locator('#wiki-search').pressSequentially('Débuter', { delay: 90 });
            await page.locator('#wiki-search-results button').first().waitFor();
            await selectLocalArticleWithKeyboard(page, article, 450); await page.waitForTimeout(500);
            await page.locator('.wiki-page.active .wiki-toc a').nth(1).click(); await page.waitForTimeout(650);
            await page.locator('.wiki-page.active .wiki-article-next').click(); await page.waitForTimeout(600);
            await page.locator('[data-language-option="en"]').click(); await page.waitForTimeout(600);
            await page.locator('[data-language-option="fr"]').click(); await page.waitForTimeout(500);
            await page.locator('.wiki-page.active .wiki-breadcrumb a[data-page="accueil"]').click(); await page.waitForTimeout(500);
            const remaining = 18000 - (Date.now() - started);
            if (remaining > 0) await page.waitForTimeout(remaining);
            const video = page.video(); await ctx.close();
            const destination = path.join(output, 'phase2-wiki-motion.webm');
            if (fs.existsSync(destination)) fs.unlinkSync(destination);
            fs.renameSync(await video.path(), destination);
            const probe = await browser.newContext(); let duration;
            try {
                await probe.route('http://127.0.0.1/qa-wiki-motion.webm', route => route.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(destination) }));
                const metadata = await probe.newPage();
                await metadata.setContent('<video preload="metadata" src="http://127.0.0.1/qa-wiki-motion.webm"></video>');
                duration = await metadata.evaluate(() => new Promise((resolve, reject) => { const video = document.querySelector('video'); if (video.readyState >= 1) resolve(video.duration); else { video.addEventListener('loadedmetadata', () => resolve(video.duration), { once: true }); video.addEventListener('error', () => reject(new Error('Video metadata unreadable')), { once: true }); setTimeout(() => reject(new Error('Video metadata timeout')), 7000); } }));
            } finally { await probe.close(); }
            assert.ok(duration >= 16 && duration <= 20, 'Demonstration duration: ' + duration);
            return { file: path.basename(destination), durationSeconds: duration, actualInteractions: ['category hover', 'local search', 'keyboard selection', 'article TOC', 'next article', 'FR/EN', 'breadcrumb return'] };
        } finally { await ctx.close(); }
    });
}

async function selectLocalArticleWithKeyboard(page, id, pauseBeforeSelection = 0) {
    const results = page.locator('#wiki-search-results button');
    await results.first().waitFor();
    const ids = await results.evaluateAll(nodes => nodes.map(node => node.dataset.page));
    const index = ids.indexOf(id);
    assert.ok(index >= 0, 'Real local-search result: ' + id);
    await page.locator('#wiki-search').focus();
    for (let step = 0; step <= index; step++) await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.page), id);
    if (pauseBeforeSelection) await page.waitForTimeout(pauseBeforeSelection);
    await page.keyboard.press('Enter');
    await activePage(page, id);
}
