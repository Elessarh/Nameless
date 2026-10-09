/** Phase 1 identity/navigation browser evidence. No package install or production writes.
 * npm run build; npm start; node tools/verify-phase1-navigation.mjs --before|--after
 * Uses the installed Playwright runtime and Chromium; overrides are optional.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const stage = process.argv.includes('--before') ? 'before' : 'after';
const checksOnly = process.argv.includes('--checks-only');
const modalCapturesOnly = process.argv.includes('--modal-captures-only');
const base = process.env.NAMELESS_BASE_URL || 'http://127.0.0.1:4173';
const output = path.resolve('docs/phase1-navigation-2026-10-09');
const profile = process.env.USERPROFILE || 'C:/Users/julie';
const moduleFile = process.env.NAMELESS_PLAYWRIGHT_MODULE || path.join(profile, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const chromium = process.env.NAMELESS_CHROMIUM || path.join(profile, 'AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe');
const { chromium: engine } = await import(pathToFileURL(moduleFile).href);
fs.mkdirSync(output, { recursive: true });
const browser = await engine.launch({ executablePath: chromium, headless: true });
const viewports = [
    { width: 360, height: 844 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
    { width: 1280, height: 1080 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }
];
const report = { stage, base, browser: browser.version(), createdAt: new Date().toISOString(), captures: [], layouts: [], checks: [], errors: [], cancelledRequests: [], external: [] };
function observe(page, label) {
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => report.errors.push({ page: label, message: error.message }));
    page.on('requestfailed', request => {
        const entry = { page: label, url: request.url(), message: request.failure()?.errorText };
        if (entry.message === 'net::ERR_ABORTED') report.cancelledRequests.push(entry);
        else (request.url().startsWith(base) ? report.errors : report.external).push(entry);
    });
    page.on('response', response => {
        if (response.status() >= 400) (response.url().startsWith(base) ? report.errors : report.external).push({ page: label, url: response.url(), status: response.status() });
    });
}
async function context(viewport, options = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...options });
    // Browser QA never sends mutating HTTP requests to external services.
    await ctx.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
        if (!local && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
            report.external.push({ url: url.href, method: request.method(), blockedNonGet: true });
            await route.abort();
        } else await route.continue();
    });
    return ctx;
}
async function visit(page, route = '/') {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.locator('.header').waitFor();
    await page.waitForFunction(() => document.fonts.status === 'loaded' && !!window.NamelessGlobalSearch, { timeout: 20000 });
    await page.waitForTimeout(600);
}
async function capture(page, name, options = {}) {
    const filename = `${stage}-${name}.png`;
    const exists = fs.existsSync(path.join(output, filename));
    const retain = checksOnly && exists && !/(settings|account|mobile-settings)/.test(name);
    if (!retain) await page.screenshot({ path: path.join(output, filename), ...options });
    report.captures.push({ file: filename, url: page.url(), viewport: page.viewportSize() });
    console.log((retain ? 'Retained ' : 'Captured ') + filename);
}
async function metrics(page, name) {
    const data = await page.evaluate(() => {
        const logo = document.querySelector('.nav-logo-safe');
        const rect = logo?.getBoundingClientRect();
        const hamburger = document.querySelector('#hamburger');
        return {
            width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
            brokenImages: [...document.images].filter(image => image.checkVisibility() && image.complete && !image.naturalWidth).map(image => image.currentSrc || image.src),
            logo: logo && { src: logo.currentSrc || logo.src, naturalWidth: logo.naturalWidth, naturalHeight: logo.naturalHeight, width: rect.width, height: rect.height, objectFit: getComputedStyle(logo).objectFit },
            language: document.documentElement.lang,
            favicon: document.querySelector('link[rel="icon"]')?.href,
            hamburgerVisible: !!hamburger && hamburger.checkVisibility(),
            currentLinks: [...document.querySelectorAll('.header .nav-menu a[aria-current="page"]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() }))
        };
    });
    report.layouts.push({ name, url: page.url(), ...data });
    return data;
}
async function check(name, work) {
    console.log('Check ' + name);
    try { report.checks.push({ name, passed: true, detail: await work() }); }
    catch (error) { report.checks.push({ name, passed: false, message: error.message }); console.log('FAILED ' + error.message); }
}
function routeLink(page, route) { return page.locator(`.header .nav-menu a:is([href="${route}"],[href="${route}/"],[href$="${route}"],[href$="${route}/"])`).first(); }

try {
    if (modalCapturesOnly) {
        for (const viewport of viewports) {
            const ctx = await context(viewport);
            const page = await ctx.newPage();
            await visit(page);
            await page.keyboard.press('Control+k');
            await page.locator('#nm-global-query').fill('Illfang');
            await page.locator('.nm-search-results a[href="/boss/illfang"]').waitFor();
            await page.waitForTimeout(400);
            await check('Search modal layout at ' + viewport.width + 'px', async () => {
                const layout = await page.locator('#nameless-global-search').evaluate(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: s.overflowX, opacity: s.opacity, clippedControls: [...el.querySelectorAll('button,input,a,h2,label')].filter(node => node.checkVisibility()).filter(node => { const c = node.getBoundingClientRect(); return c.left < r.left + 1 || c.right > r.right - 1; }).map(node => node.className || node.tagName), brokenImages: [...el.querySelectorAll('img')].filter(img => img.checkVisibility() && img.complete && !img.naturalWidth).map(img => img.src) }; });
                assert.ok(layout.x >= 0 && layout.y >= 0 && layout.x + layout.width <= viewport.width + 1 && layout.y + layout.height <= viewport.height + 1, 'Dialog fits the viewport');
                assert.ok(Math.abs(layout.x + layout.width / 2 - viewport.width / 2) < 2, 'Dialog centers horizontally');
                assert.ok(Math.abs(layout.y + layout.height / 2 - viewport.height / 2) < 2, 'Dialog centers vertically');
                assert.equal(Number(layout.opacity), 1);
                // The shared decorative frame uses ::before inset:-1px. Its clipped
                // border contributes one pixel to Chromium's scrollWidth, while
                // all functional content must remain fully inside the dialog.
                assert.ok(layout.scrollWidth <= layout.clientWidth + 1 && layout.overflowX === 'hidden', 'Only the clipped one-pixel decorative frame can extend');
                assert.deepEqual(layout.clippedControls, [], 'No functional control is clipped');
                assert.deepEqual(layout.brokenImages, []);
                return layout;
            });
            await capture(page, `search-${viewport.width}x${viewport.height}`);
            await ctx.close();
        }
    } else {
    // All images are captured before behavioral checks, enabling an early visual review.
    for (const viewport of viewports) {
        const ctx = await context(viewport);
        const page = await ctx.newPage(); observe(page, 'home-' + viewport.width);
        await visit(page);
        await capture(page, `home-${viewport.width}x${viewport.height}`);
        await metrics(page, 'home-' + viewport.width);
        if ([390, 1920].includes(viewport.width)) {
            await page.keyboard.press('Control+k');
            await page.locator('#nameless-global-search[open]').waitFor();
            await page.locator('#nm-global-query').fill('Illfang');
            await page.locator('.nm-search-results a[href="/boss/illfang"]').waitFor();
            await page.waitForTimeout(250);
            await capture(page, `search-${viewport.width}x${viewport.height}`);
        }
        await ctx.close();
    }
    const routes = ['/wiki', '/carte', '/bestiaire', '/items', '/espace-guilde', '/profil'];
    const ctx = await context({ width: 1920, height: 1080 });
    const page = await ctx.newPage(); observe(page, 'shared-header');
    for (const route of routes) {
        await visit(page, route);
        await capture(page, route.slice(1) + '-1920x1080');
        await metrics(page, route);
    }
    await ctx.close();
    fs.writeFileSync(path.join(output, stage + '-capture-manifest.json'), JSON.stringify({ stage, captures: report.captures, layouts: report.layouts }, null, 2) + '\n');
    console.log('All ' + stage + ' reference images are ready for visual review.');
    if (stage === 'after') await behavioralChecks();
    }
} finally {
    fs.writeFileSync(path.join(output, stage + (modalCapturesOnly ? '-modal-capture' : '-verification') + '.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
}
if (report.checks.some(item => !item.passed)) process.exitCode = 1;

async function behavioralChecks() {
    for (const layout of report.layouts.filter(item => item.name.startsWith('home-'))) {
        await check(layout.name + ': bounds, images and identity', async () => {
            assert.equal(layout.scrollWidth, layout.width, 'No horizontal document overflow');
            assert.deepEqual(layout.brokenImages, [], 'No broken visible images');
            assert.ok(layout.logo && layout.logo.naturalWidth > 0, 'A real logo image is present');
            assert.ok(!layout.logo.src.includes('reference-emblem'), 'The approved emblem replaces the synthetic N');
            assert.ok(layout.logo.objectFit === 'contain' || Math.abs(layout.logo.width / layout.logo.height - layout.logo.naturalWidth / layout.logo.naturalHeight) < 0.02, 'Emblem proportions are preserved');
            assert.equal(layout.hamburgerVisible, layout.width <= 768, 'Hamburger is mobile only');
            return layout;
        });
    }
    await check('Shared header identity and layout on all six supplied routes', async () => {
        const routes = report.layouts.filter(item => !item.name.startsWith('home-'));
        for (const layout of routes) {
            assert.equal(layout.scrollWidth, layout.width, layout.name + ' has no horizontal overflow');
            assert.deepEqual(layout.brokenImages, [], layout.name + ' has no broken visible image');
            assert.ok(layout.logo.naturalWidth > 0 && !layout.logo.src.includes('reference-emblem'), layout.name + ' uses the approved emblem');
            assert.equal(layout.hamburgerVisible, false, layout.name + ' has no desktop hamburger');
        }
        return routes.map(layout => ({ route: layout.name, displayedUrl: layout.url, emblem: layout.logo.src }));
    });
    const ctx = await context({ width: 1920, height: 1080 });
    const page = await ctx.newPage(); observe(page, 'desktop-interactions');
    await visit(page);
    await check('Simplified approved favicon is served and wordmark stays separate', async () => {
        const favicons = await page.locator('link[rel="icon"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
        assert.ok(favicons.length);
        for (const favicon of favicons) {
            assert.ok(favicon && !favicon.includes('reference-emblem'));
            const response = await ctx.request.get(new URL(favicon, base).href);
            assert.ok(response.ok(), favicon + ' is served');
        }
        assert.match(await page.locator('.nav-wordmark').textContent(), /Nameless/i);
        assert.equal(await page.locator('.nav-logo-container img').count(), 1);
        return { favicons, status: 200, separateWordmark: true };
    });
    await check('Ctrl+K, initial focus, Escape with a query and focus return', async () => {
        await page.locator('.nm-search-trigger').focus();
        await page.keyboard.press('Control+k');
        await page.locator('#nameless-global-search[open]').waitFor();
        assert.ok(await page.locator('#nm-global-query').evaluate(el => el === document.activeElement));
        await page.locator('#nm-global-query').fill('Illfang');
        await page.locator('.nm-search-entry-link[href="/boss/illfang"]').waitFor();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#nameless-global-search').open);
        assert.ok(await page.locator('.nm-search-trigger').evaluate(el => el === document.activeElement));
        return { actualEntity: 'Illfang', restoredFocus: true };
    });
    await check('Real index query, clearing, favorites filter and persistence', async () => {
        await visit(page);
        const index = await (await ctx.request.get(base + '/assets/search-index.json')).json();
        const favoriteEntry = index.entries.find(entry => entry.url === '/boss/illfang');
        assert.ok(favoriteEntry, 'Illfang exists in the real published index');
        const favoriteKey = favoriteEntry.kind + ':' + favoriteEntry.id;
        await page.keyboard.press('Control+k');
        const query = page.locator('#nm-global-query');
        await query.fill('Illfang');
        const row = page.locator('.nm-search-result').filter({ has: page.locator('a[href="/boss/illfang"]') }).first();
        await row.waitFor();
        const star = row.locator('.nm-search-star');
        await star.click();
        assert.equal(await star.getAttribute('aria-pressed'), 'true');
        const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('nameless-public-favorites-v1') || '[]'));
        assert.ok(persisted.includes(favoriteKey));
        await page.locator('.nm-search-clear').click();
        assert.equal(await query.inputValue(), '');
        assert.ok(await query.evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('.nm-search-result[data-kind="action"]').count(), 5);
        await page.locator('.nm-search-favorites').click();
        assert.equal(await page.locator('.nm-search-entry-link').count(), 1);
        assert.equal(await page.locator('.nm-search-entry-link').getAttribute('href'), '/boss/illfang');
        await page.keyboard.press('Escape');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.NamelessGlobalSearch);
        await page.locator('.nm-search-trigger').click();
        await query.fill('Illfang');
        assert.equal(await page.locator('.nm-search-star').first().getAttribute('aria-pressed'), 'true');
        await page.locator('.nm-search-star').first().click();
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('nameless-public-favorites-v1') || '[]')), []);
        await page.locator('.nm-search-clear').click();
        await page.locator('.nm-search-favorites').click();
        await page.locator('.nm-search-empty').waitFor();
        assert.equal(await page.locator('.nm-search-entry-link').count(), 0);
        await page.locator('.nm-search-favorites').click();
        await query.fill('nameless-no-match-qa-847281');
        await page.locator('.nm-search-empty').waitFor();
        await page.keyboard.press('Escape');
        return { favoritesSavedAndRemoved: true, survivesReload: true, noMatch: true };
    });
    await check('Keyboard arrows select visible real results; Enter opens the boss route', async () => {
        await visit(page);
        await page.locator('.nm-search-trigger').click();
        await page.locator('#nm-global-query').fill('Illfang');
        const result = page.locator('.nm-search-entry-link[href="/boss/illfang"]');
        await result.waitFor();
        await page.keyboard.press('ArrowDown');
        assert.ok(await result.evaluate(el => el === document.activeElement));
        const focus = await result.evaluate(el => { const style = getComputedStyle(el); return { outline: style.outlineWidth, outlineColor: style.outlineColor, background: style.backgroundColor }; });
        assert.ok(focus.outline !== '0px' || focus.background !== 'rgba(0, 0, 0, 0)', 'Keyboard selection has a visible treatment');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowDown');
        await result.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/boss/illfang');
        await page.locator('h1').filter({ hasText: 'Illfang' }).waitFor();
        assert.equal(await page.locator('#nameless-global-search').evaluate(dialog => dialog.open), false);
        await visit(page);
        return { route: '/boss/illfang', focus };
    });
    await check('FR/EN controls update header/search coherently and persist across routes/reload', async () => {
        await visit(page);
        await page.locator('[data-language-option="en"]').click();
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        assert.equal(await page.locator('[data-language-option="en"]').getAttribute('aria-pressed'), 'true');
        assert.match(await page.locator('.nm-search-trigger').getAttribute('aria-label'), /Search/);
        await page.locator('.nm-search-trigger').click();
        assert.equal(await page.locator('#nm-search-title').textContent(), 'Search Nameless');
        assert.equal(await page.locator('.nm-search-favorites').textContent(), 'My favorites0');
        await page.locator('#nm-global-query').fill('Illfang');
        await page.locator('.nm-search-entry-link[href="/boss/illfang"]').waitFor();
        assert.match(await page.locator('.nm-search-result-category').first().textContent(), /Boss/);
        await page.keyboard.press('Escape');
        await routeLink(page, '/wiki').click();
        await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/wiki');
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.NamelessGlobalSearch);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await page.locator('[data-language-option="fr"]').click();
        assert.match(await page.locator('.nm-search-trigger').getAttribute('aria-label'), /Rechercher/);
        await page.locator('.nm-search-trigger').click();
        assert.equal(await page.locator('#nm-search-title').textContent(), 'Rechercher dans Nameless');
        assert.equal(await page.locator('.nm-search-favorites').textContent(), 'Mes favoris0');
        await page.keyboard.press('Escape');
        await visit(page);
        return { locales: ['fr', 'en'], persistedAcrossRouteAndReload: true };
    });
    await check('SPA navigation preserves header and moves active/focus indicator', async () => {
        await visit(page);
        await page.evaluate(() => { window.__qaHeader = document.querySelector('.header'); });
        const observations = [];
        for (const route of ['/wiki', '/carte', '/bestiaire', '/items']) {
            const link = routeLink(page, route);
            await link.click();
            await page.waitForURL(url => url.pathname.replace(/\/$/, '') === route);
            await page.waitForFunction(route => { const link = document.querySelector('.header .nav-menu a[aria-current="page"]'); return link && new URL(link.href).pathname.replace(/\/$/, '') === route; }, route);
            assert.ok(await page.evaluate(() => window.__qaHeader === document.querySelector('.header')), 'Persistent SPA header');
            const indicator = await page.locator('.header .nav-menu').evaluate(nav => ({ shown: nav.dataset.referenceIndicator, x: nav.style.getPropertyValue('--reference-nav-x'), width: nav.style.getPropertyValue('--reference-nav-width') }));
            assert.equal(indicator.shown, 'true');
            assert.ok(parseFloat(indicator.width) > 0);
            observations.push({ route, indicator });
        }
        const focusLink = routeLink(page, '/wiki');
        await focusLink.focus();
        await page.waitForTimeout(220);
        const focusX = await page.locator('.header .nav-menu').evaluate(nav => parseFloat(nav.style.getPropertyValue('--reference-nav-x')));
        const expectedX = await focusLink.evaluate(link => link.getBoundingClientRect().left - link.closest('.nav-menu').getBoundingClientRect().left);
        assert.ok(Math.abs(focusX - expectedX) < 2, 'Indicator follows the keyboard focus');
        await visit(page);
        return observations;
    });
    await desktopPreferences(page);
    await ctx.close();
    await mobileChecks();
    await reducedMotionChecks();
    await accountFixtureChecks();
    await motionClip();
}

function settingsTrigger(page) { return page.locator('.reference-settings-trigger, .reference-preferences-trigger, [data-reference-settings]').first(); }
async function referenceDialogBounds(page, panel) {
    await page.waitForTimeout(450);
    const data = await panel.evaluate(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight, opacity: s.opacity, background: s.backgroundImage + ' ' + s.backgroundColor, position: s.position }; });
    assert.ok(Math.abs(data.x + data.width / 2 - data.viewportWidth / 2) < 2, 'Dialog centers horizontally');
    assert.ok(Math.abs(data.y + data.height / 2 - data.viewportHeight / 2) < 2, 'Dialog centers vertically');
    assert.equal(data.position, 'fixed');
    assert.equal(Number(data.opacity), 1, 'Dialog has settled to fully visible');
    assert.ok(!data.background.includes('rgba(0, 0, 0, 0)'), 'Reference dialog surface is opaque');
    return data;
}
async function desktopPreferences(page) {
    await check('Desktop settings are separate; real scenery and audio controls respond', async () => {
        await visit(page);
        assert.equal(await page.locator('#hamburger').isVisible(), false);
        const trigger = settingsTrigger(page);
        await trigger.click();
        const panel = page.locator('dialog[open]').filter({ has: page.locator('[data-reference-action="motion"]') });
        await panel.waitFor();
        const bounds = await referenceDialogBounds(page, panel);
        assert.equal(await panel.locator('.reference-menu-links a').count(), 0, 'Desktop settings do not repeat navigation');
        await capture(page, 'settings-1920x1080');
        const homeControl = page.locator('[data-home-motion]');
        const initial = await homeControl.getAttribute('aria-pressed');
        await panel.locator('[data-reference-action="motion"]').click();
        assert.notEqual(await homeControl.getAttribute('aria-pressed'), initial);
        await panel.locator('[data-reference-action="motion"]').click();
        assert.equal(await homeControl.getAttribute('aria-pressed'), initial);
        const audio = page.locator('.nm-audio-btn');
        const audioInitial = await audio.getAttribute('aria-pressed');
        await panel.locator('[data-reference-action="audio"]').click();
        await page.waitForFunction(initial => document.querySelector('.nm-audio-btn').getAttribute('aria-pressed') !== initial, audioInitial);
        assert.notEqual(await audio.getAttribute('aria-pressed'), audioInitial);
        assert.ok(await page.evaluate(() => !window.NamelessAudioPlayer.audio.paused), 'Local audio playback actually starts');
        await panel.locator('[data-reference-action="audio"]').click();
        assert.equal(await audio.getAttribute('aria-pressed'), audioInitial);
        assert.ok(await page.evaluate(() => window.NamelessAudioPlayer.audio.paused), 'Local audio playback actually pauses');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        assert.ok(await trigger.evaluate(el => el === document.activeElement));
        return { realMotionAndAudio: true, focusReturn: true, bounds };
    });
}

async function mobileChecks() {
    const ctx = await context({ width: 390, height: 844 });
    const page = await ctx.newPage(); observe(page, 'mobile-interactions');
    await visit(page);
    await check('Mobile menu opens, traps focus, closes with Escape, and restores content', async () => {
        const trigger = page.locator('#hamburger');
        await trigger.click();
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.ok(await page.locator('#nav-menu a').first().evaluate(el => el === document.activeElement));
        assert.ok(await page.locator('main').evaluate(el => el.inert));
        await capture(page, 'menu-390x844');
        const focusables = await page.locator('.header').evaluate(header => [...header.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.getClientRects().length).map(el => ({ tag: el.tagName, id: el.id, cls: el.className, text: el.textContent.trim() })));
        await page.locator('.header').evaluate(header => { const nodes = [...header.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.getClientRects().length); nodes.at(-1).focus(); });
        await page.keyboard.press('Tab');
        assert.ok(await page.locator('.header').evaluate(header => { const nodes = [...header.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.getClientRects().length); return nodes[0] === document.activeElement; }));
        await page.keyboard.press('Shift+Tab');
        assert.ok(await page.locator('.header').evaluate(header => { const nodes = [...header.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.getClientRects().length); return nodes.at(-1) === document.activeElement; }));
        await page.keyboard.press('Escape');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        assert.ok(await trigger.evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('main').evaluate(el => el.inert), false);
        assert.notEqual(await page.locator('body').evaluate(el => el.style.overflow), 'hidden');
        return { focusableControls: focusables.length, contentRestored: true };
    });
    await check('Mobile route selection closes menu and updates current route', async () => {
        await visit(page);
        await page.locator('#hamburger').click();
        await routeLink(page, '/items').click();
        await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/items');
        assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'false');
        assert.equal(await routeLink(page, '/items').getAttribute('aria-current'), 'page');
        assert.equal(await page.locator('main').evaluate(el => el.inert), false);
        await visit(page);
    });
    await check('Mobile ambience access keeps nested focus and Escape behavior coherent', async () => {
        await visit(page);
        await page.locator('#hamburger').click();
        const settings = page.locator('.reference-mobile-settings');
        await settings.click();
        await page.locator('#reference-navigation[open]').waitFor();
        const bounds = await referenceDialogBounds(page, page.locator('#reference-navigation'));
        await capture(page, 'mobile-settings-390x844');
        assert.equal(await page.locator('#reference-navigation .reference-menu-links a').count(), 0);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#reference-navigation').open);
        assert.ok(await settings.evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'false');
        assert.ok(await page.locator('#hamburger').evaluate(el => el === document.activeElement));
        return { nestedSettingsAndMenu: true, restoredFocus: true, bounds };
    });
    await check('Mobile search keyboard, modal bounds and touch-sized controls', async () => {
        await visit(page);
        await page.locator('.nm-search-trigger').click();
        const query = page.locator('#nm-global-query');
        await query.fill('Illfang');
        await page.locator('.nm-search-entry-link[href="/boss/illfang"]').waitFor();
        const box = await page.locator('#nameless-global-search').boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845);
        const sizes = await page.locator('#nameless-global-search button').evaluateAll(buttons => buttons.filter(button => button.checkVisibility()).map(button => ({ class: button.className, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
        assert.ok(sizes.every(button => button.width >= 24 && button.height >= 24), 'WCAG target-size minimum');
        await page.keyboard.press('ArrowDown');
        assert.ok(await page.locator('.nm-search-entry-link[href="/boss/illfang"]').evaluate(el => el === document.activeElement));
        await page.keyboard.press('Escape');
        assert.ok(await page.locator('.nm-search-trigger').evaluate(el => el === document.activeElement));
        return { modalBounds: box, targets: sizes };
    });
    await ctx.close();
}

async function reducedMotionChecks() {
    const ctx = await context({ width: 1920, height: 1080 }, { reducedMotion: 'reduce' });
    const page = await ctx.newPage(); observe(page, 'reduced-motion');
    await visit(page);
    await check('Reduced motion removes header/search transitions and modal motion', async () => {
        assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
        await page.locator('.nm-search-trigger').click();
        await page.locator('#nameless-global-search[open]').waitFor();
        await page.locator('#nm-global-query').fill('Illfang');
        await page.locator('.nm-search-entry-link[href="/boss/illfang"]').waitFor();
        const styles = await page.locator('.header .nav-menu, .nm-search-trigger, #nameless-global-search, .nm-search-entry-link').evaluateAll(nodes => nodes.map(el => { const s = getComputedStyle(el); return { class: el.className, animation: s.animationName, animationDuration: s.animationDuration, transitionDuration: s.transitionDuration }; }));
        assert.ok(styles.every(s => s.animation === 'none' || s.animationDuration.split(',').every(v => parseFloat(v) <= 0.01)));
        assert.ok(styles.every(s => s.transitionDuration.split(',').every(v => parseFloat(v) <= 0.01)));
        await capture(page, 'search-reduced-motion-1920x1080');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#nameless-global-search').open);
        return styles;
    });
    await ctx.close();
}

async function accountFixtureChecks() {
    const fixture = process.env.NAMELESS_QA_BASE_URL || 'http://127.0.0.1:4181';
    const ctx = await context({ width: 1920, height: 1080 });
    const page = await ctx.newPage(); observe(page, 'isolated-qa-account');
    let available = false;
    try { const response = await ctx.request.get(fixture + '/qa/profile', { timeout: 1500 }); available = response.ok(); } catch {}
    if (!available) { report.checks.push({ name: 'Authenticated account menu / logout forwarding', skipped: true, reason: 'Isolated :4181 QA fixture is unavailable; no real session was used.' }); await ctx.close(); return; }
    await page.goto(fixture + '/qa/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.NamelessQaFixture && !!window.NamelessReferenceShell);
    await check('Account menu and logout forwarding use the isolated marked QA fixture', async () => {
        assert.ok(await page.locator('.qa-fixture-banner').isVisible());
        assert.ok(await page.evaluate(() => !!window.NamelessQaFixture));
        await page.evaluate(() => { window.__qaLogoutClicks = 0; document.getElementById('logout-btn').addEventListener('click', () => window.__qaLogoutClicks++); });
        const trigger = page.locator('.reference-account-trigger, [data-reference-account]').first();
        await trigger.click();
        const panel = page.locator('dialog[open], .reference-account-menu:not([hidden])').filter({ has: page.locator('a[href*="profil"], a[href*="qa/profile"]') }).first();
        await panel.waitFor();
        const bounds = await referenceDialogBounds(page, panel);
        await capture(page, 'account-isolated-qa-1920x1080');
        assert.ok(await panel.locator('a[href*="profil"], a[href*="qa/profile"]').count());
        page.once('dialog', dialog => dialog.dismiss());
        await panel.locator('[data-reference-action="logout"], .reference-account-logout').click();
        assert.equal(await page.evaluate(() => window.__qaLogoutClicks), 1, 'Existing logout handler is forwarded exactly once');
        assert.deepEqual(await page.evaluate(() => window.NamelessQaFixture.writes), [], 'Account UI produces no fixture table writes');
        return { isolatedFixture: fixture, forwardedExactlyOnce: true, realAuthenticationUsed: false, bounds };
    });
    await ctx.close();
}

async function motionClip() {
    await check('Actual navigation/search/settings motion demonstration (18 seconds)', async () => {
        const videoDirectory = path.join(output, 'video');
        fs.mkdirSync(videoDirectory, { recursive: true });
        const ctx = await context({ width: 1280, height: 720 }, { recordVideo: { dir: videoDirectory, size: { width: 1280, height: 720 } } });
        const page = await ctx.newPage();
        const started = Date.now();
        try {
            await visit(page);
            await routeLink(page, '/bestiaire').hover(); await page.waitForTimeout(450);
            await routeLink(page, '/items').hover(); await page.waitForTimeout(450);
            await routeLink(page, '/wiki').click();
            await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/wiki'); await page.waitForTimeout(450);
            await page.locator('.nm-search-trigger').click(); await page.waitForTimeout(350);
            await page.locator('#nm-global-query').pressSequentially('Illfang', { delay: 80 });
            await page.locator('.nm-search-entry-link[href="/boss/illfang"]').waitFor();
            await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
            await page.locator('.nm-search-star').first().click(); await page.waitForTimeout(500);
            await page.locator('.nm-search-clear').click(); await page.waitForTimeout(350);
            await page.locator('.nm-search-favorites').click(); await page.waitForTimeout(700);
            await page.keyboard.press('Escape'); await page.waitForTimeout(350);
            await page.locator('.nav-logo-container a').click(); await page.waitForTimeout(600);
            await settingsTrigger(page).click(); await page.waitForTimeout(350);
            await page.locator('dialog[open] [data-reference-action="motion"]').click(); await page.waitForTimeout(600);
            await page.locator('dialog[open] [data-reference-action="motion"]').click(); await page.waitForTimeout(600);
            await page.keyboard.press('Escape');
            const remaining = 18000 - (Date.now() - started);
            if (remaining > 0) await page.waitForTimeout(remaining);
            const video = page.video();
            await ctx.close();
            const source = await video.path();
            const destination = path.join(output, 'phase1-navigation-motion.webm');
            if (fs.existsSync(destination)) fs.unlinkSync(destination);
            fs.renameSync(source, destination);
            const elapsedMs = Date.now() - started;
            const probe = await browser.newContext();
            let duration;
            try {
                await probe.route('http://127.0.0.1/qa-motion-video.webm', route => route.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(destination) }));
                const metadata = await probe.newPage();
                await metadata.setContent('<video preload="metadata" src="http://127.0.0.1/qa-motion-video.webm"></video>');
                duration = await metadata.evaluate(() => new Promise((resolve, reject) => { const video = document.querySelector('video'); if (video.readyState >= 1) resolve(video.duration); else { video.addEventListener('loadedmetadata', () => resolve(video.duration), { once: true }); video.addEventListener('error', () => reject(new Error('Motion video metadata unreadable')), { once: true }); setTimeout(() => reject(new Error('Motion metadata timeout')), 7000); } }));
            } finally { await probe.close(); }
            assert.ok(duration >= 16 && duration <= 20, 'Actual motion clip is 16–20 seconds: ' + duration);
            return { file: path.basename(destination), durationSeconds: duration, elapsedMs, actualInteractions: ['nav hover', 'route', 'search typing', 'keyboard selection', 'favorite', 'clear', 'favorite filter', 'settings', 'real scenery pause/resume'] };
        } finally { await ctx.close(); }
    });
}
