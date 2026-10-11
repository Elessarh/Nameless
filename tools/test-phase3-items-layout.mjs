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
    for (const width of [1920, 1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForFunction(() => {
            const image = document.querySelector('.item-image');
            return document.querySelector('main').getBoundingClientRect().width >= innerWidth - 48 && image && image.complete && image.naturalWidth > 0 && Number(image.dataset.pixelScale) >= 2;
        });
        const inventory = await page.locator('.item-card').first().evaluate(card => {
            const image = card.querySelector('.item-image'), badge = card.querySelector('.item-rarity-badge');
            const imageBounds = image.getBoundingClientRect(), mediaBounds = image.parentElement.getBoundingClientRect(), cardBounds = card.getBoundingClientRect(), badgeBounds = badge.getBoundingClientRect();
            const categoryBounds = card.querySelector('.item-cat').getBoundingClientRect();
            return { count: document.querySelectorAll('.item-card').length, pageSize: document.getElementById('items-per-page-select').value, factor: Number(image.dataset.pixelScale), nativeWidth: image.naturalWidth, nativeHeight: image.naturalHeight, imageWidth: imageBounds.width, imageHeight: imageBounds.height, imageBottom: imageBounds.bottom, mediaWidth: mediaBounds.width, mediaHeight: mediaBounds.height, badgeWidth: badgeBounds.width, badgeTop: badgeBounds.top, metaCenters: [categoryBounds.top + categoryBounds.height / 2, badgeBounds.top + badgeBounds.height / 2], badgeRight: badgeBounds.right, cardRight: cardBounds.right, cardWidth: cardBounds.width, mainWidth: document.querySelector('main').getBoundingClientRect().width, gridWidth: card.parentElement.getBoundingClientRect().width, layoutWidth: document.querySelector('.catalogue-layout').getBoundingClientRect().width, inner: innerWidth, nameSize: Number.parseFloat(getComputedStyle(card.querySelector('.item-name')).fontSize), rendering: getComputedStyle(image).imageRendering, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(inventory.count, 48, width + ': real inventory starts with 48 elements'); checks++;
        assert.equal(inventory.pageSize, '48', width + ': the pagination control agrees with visible native records'); checks++;
        assert.ok(Number.isInteger(inventory.factor) && inventory.factor >= 2 && inventory.factor <= 3, width + ': small native sprites have a readable integer enlargement'); checks++;
        assert.equal(inventory.imageWidth, inventory.nativeWidth * inventory.factor, width + ': CSS preserves the exact native image width'); checks++;
        assert.equal(inventory.imageHeight, inventory.nativeHeight * inventory.factor, width + ': CSS preserves the exact native image height'); checks++;
        assert.ok(inventory.imageWidth <= inventory.mediaWidth && inventory.imageHeight <= inventory.mediaHeight, width + ': the entire PNG canvas fits its inventory support ' + JSON.stringify(inventory)); checks++;
        assert.ok(inventory.badgeWidth < inventory.cardWidth - 12, width + ': the rarity badge wraps its label rather than becoming a full-width ribbon'); checks++;
        assert.ok(inventory.badgeTop >= inventory.imageBottom, width + ': the rarity badge never covers the native image canvas'); checks++;
        assert.ok(Math.abs(inventory.metaCenters[0] - inventory.metaCenters[1]) < 1, width + ': Accessories and Legendary fit the same metadata row'); checks++;
        assert.ok(inventory.badgeRight <= inventory.cardRight - 5, width + ': the compact badge stays within the card’s inset'); checks++;
        assert.ok(inventory.nameSize >= 15, width + ': item names remain readable in the denser grid'); checks++;
        assert.equal(inventory.rendering, 'pixelated', width + ': native pixels are not smoothed'); checks++;
        assert.equal(inventory.overflow, false, width + ': the denser inventory remains within the viewport'); checks++;
    }
    await page.locator('.item-card').first().click();
    await page.waitForFunction(() => {
        const image = document.querySelector('.item-modal-media img');
        return image && image.complete && Number(image.dataset.pixelScale) === 3;
    });
    const detail = await page.locator('.item-modal-media img').evaluate(image => {
        const bounds = image.getBoundingClientRect(), support = image.parentElement.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height, nativeWidth: image.naturalWidth, nativeHeight: image.naturalHeight, supportWidth: support.width, supportHeight: support.height };
    });
    assert.deepEqual([detail.width, detail.height], [detail.nativeWidth * 3, detail.nativeHeight * 3], 'The contextual sheet displays a small native sprite at exact 3x dimensions'); checks++;
    assert.ok(detail.width <= detail.supportWidth && detail.height <= detail.supportHeight, 'The enlarged detail preserves the complete transparent canvas without clipping'); checks++;
    await page.keyboard.press('Escape');
    console.log('Phase 3 item drawer native layout: ' + checks + ' checks passed.');
} finally { await browser.close(); }
