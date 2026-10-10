#!/usr/bin/env node
// Source-only native browser fixture: no _site build, external request or server mutation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const profile = process.env.USERPROFILE || '';
let playwright;
try { playwright = await import('playwright'); }
catch { playwright = await import(pathToFileURL(process.env.NAMELESS_PLAYWRIGHT_MODULE || path.join(profile, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href); }
const cache = path.join(process.env.LOCALAPPDATA || path.join(profile, 'AppData/Local'), 'ms-playwright');
const installed = fs.existsSync(cache) ? fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])).map(name => path.join(cache, name, 'chrome-win64/chrome.exe')).find(file => fs.existsSync(file)) : null;
const browser = await playwright.chromium.launch({ ...(process.env.NAMELESS_CHROMIUM || installed ? { executablePath: process.env.NAMELESS_CHROMIUM || installed } : {}) });
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let checks = 0;
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://nameless-layout.test') return route.abort();
        const pathname = decodeURIComponent(url.pathname);
        if (pathname === '/items') {
            const html = fs.readFileSync(path.join(root, 'pages/items.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi, '');
            return route.fulfill({ contentType: 'text/html', body: html });
        }
        const filename = path.resolve(root, '.' + pathname);
        if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ contentType: types[path.extname(filename)] || 'application/octet-stream', body: fs.readFileSync(filename) });
    });
    await page.goto('https://nameless-layout.test/items');
    await page.addScriptTag({ content: 'window.NamelessSpaRouter = { controlsLifecycle: true };' });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'js/items-catalog-hdv.js'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'js/items.js'), 'utf8') });
    await page.evaluate(() => window.NamelessItemsPage.init(document));
    for (const width of [360, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.locator('#it-filters').isVisible(), false, width + ': closed drawer is removed from layout'); checks++;
        assert.equal(await page.locator('#it-filter-toggle').isVisible(), true, width + ': actual filter control is visible'); checks++;
        await page.locator('#it-filter-toggle').click();
        const geometry = await page.locator('#it-filters').evaluate(element => {
            const bounds = element.getBoundingClientRect(), style = getComputedStyle(element), close = document.getElementById('it-filter-close').getBoundingClientRect();
            return { position: style.position, left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, z: Number(style.zIndex), closeWidth: close.width, closeHeight: close.height, closeHit: document.elementFromPoint(close.left + close.width / 2, close.top + close.height / 2)?.id, overflow: document.body.style.overflow, inert: document.querySelector('.catalogue-results').inert };
        });
        assert.equal(geometry.position, 'fixed', width + ': shared styles cannot return the open drawer to normal flow'); checks++;
        assert.ok(geometry.left >= 0 && geometry.top === 0 && geometry.width <= width && geometry.height === 844, width + ': drawer occupies its intended viewport bounds'); checks++;
        assert.ok(geometry.closeWidth >= 44 && geometry.closeHeight >= 44 && geometry.closeHit === 'it-filter-close', width + ': close target is at least 44px and above the header'); checks++;
        assert.ok(geometry.z >= 200 && geometry.overflow === 'hidden' && geometry.inert, width + ': overlay depth and controller isolation agree'); checks++;
        assert.equal(await page.locator('.catalogue-filter-backdrop').isVisible(), true, width + ': backdrop is a visible dismissal surface'); checks++;
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#it-filters').isVisible(), false, width + ': Escape actually hides the drawer'); checks++;
        const released = await page.evaluate(() => ({ focus: document.activeElement.id, overflow: document.body.style.overflow, inert: document.querySelector('.catalogue-results').inert }));
        assert.deepEqual(released, { focus: 'it-filter-toggle', overflow: '', inert: false }, width + ': close restores focus and underlying page'); checks++;
    }
    await page.setViewportSize({ width: 769, height: 844 });
    assert.equal(await page.locator('#it-filters').isVisible(), true, 'At 769px the genuine desktop filter rail returns'); checks++;
    assert.equal(await page.locator('#it-filter-toggle').isVisible(), false, 'Desktop hides the redundant drawer toggle'); checks++;
    assert.equal(await page.locator('#it-filter-close').isVisible(), false, 'Desktop hides the drawer-only close target'); checks++;
    assert.equal(await page.locator('.catalogue-filter-backdrop').isVisible(), false, 'Desktop has no overlay backdrop'); checks++;
    console.log('Phase 3 item drawer native layout: ' + checks + ' checks passed.');
} finally { await browser.close(); }
