/** Real-browser visual/interaction evidence. No package installs or remote mutations.
 * Build/serve :4173 first, then node tools/verify-reference-reproduction.mjs.
 * Optional NAMELESS_QA_BASE_URL points only to the isolated local QA fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const output = path.resolve('docs/reference-reproduction-2026-10-09');
const base = process.env.NAMELESS_BASE_URL || 'http://127.0.0.1:4173';
const qaBase = process.env.NAMELESS_QA_BASE_URL || null;
const guildOnly = process.argv.includes('--guild-only');
const profile = process.env.USERPROFILE || '';
let playwright;
try { playwright = await import('playwright'); }
catch { playwright = await import(pathToFileURL(process.env.NAMELESS_PLAYWRIGHT_MODULE || path.join(profile, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href); }
const cache = path.join(process.env.LOCALAPPDATA || path.join(profile, 'AppData/Local'), 'ms-playwright');
const installed = fs.existsSync(cache) ? fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name))
  .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  .map(name => path.join(cache, name, 'chrome-win64/chrome.exe')).find(filename => fs.existsSync(filename)) : null;
fs.mkdirSync(output, { recursive: true });
const browser = await playwright.chromium.launch({ ...(process.env.NAMELESS_CHROMIUM || installed ? { executablePath: process.env.NAMELESS_CHROMIUM || installed } : {}) });
const report = { generatedAt: new Date().toISOString(), base, checks: [], layouts: [], screenshots: [], browserErrors: [], consoleErrors: [], localHttpErrors: [], abortedRequests: [], externalNetwork: [], qa: { enabled: !!qaBase, base: qaBase, data: qaBase ? 'Explicitly labeled, isolated in-memory QA data; no real API' : 'Public member gate only' } };
let currentCheck = 'Initial navigation';
function observe(page, label) {
  page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => report.browserErrors.push({ page: label, check: currentCheck, name: error.name, message: error.message, stack: error.stack }));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ page: label, message: message.text().slice(0, 350) }); });
  page.on('requestfailed', request => report.abortedRequests.push({ page: label, url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => {
    if (response.status() >= 400) (response.url().startsWith(base) || (qaBase && response.url().startsWith(qaBase)) ? report.localHttpErrors : report.externalNetwork).push({ page: label, url: response.url(), status: response.status() });
  });
}
async function check(name, action) {
  currentCheck = name; console.log('Checking: ' + name);
  try { const detail = await action(); report.checks.push({ name, passed: true, ...(detail ? { detail } : {}) }); }
  catch (error) { report.checks.push({ name, passed: false, message: error.message.slice(0, 800) }); console.log('FAILED: ' + error.message.slice(0, 800)); }
}
async function visit(page, route, ready, origin = base) {
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await page.locator(ready).first().waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(route === '/' ? 1700 : 600);
}
async function images(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo({ top: y, left: 0, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 50)); }
    await Promise.all(Array.from(document.images).map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 4000);
    })));
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(180);
}
async function layout(page, label) {
  const data = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
    brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.currentSrc || image.src), heading: document.querySelector('h1')?.textContent.trim() }));
  report.layouts.push({ page: label, ...data });
  assert.equal(data.width, data.viewport.width, label + ': no horizontal overflow');
  assert.deepEqual(data.brokenImages, [], label + ': image resources load');
  return { viewport: data.viewport, height: data.height };
}
async function screenshot(page, name, fullPage = false) {
  await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await page.waitForFunction(() => scrollY === 0);
  await page.waitForTimeout(120);
  const clip = fullPage ? await page.evaluate(() => ({ x: 0, y: 0, width: innerWidth, height: document.documentElement.scrollHeight })) : undefined;
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage, ...(clip ? { clip } : {}) });
  report.screenshots.push(name + '.png');
}
async function tabs(page, panel, selector = '[data-detail-tab]') {
  const keys = await page.locator(panel + ' ' + selector).evaluateAll(buttons => buttons.map(button => ({ key: button.dataset.detailTab || button.dataset.panelTab, control: button.getAttribute('aria-controls') })));
  assert.ok(keys.length >= 2, 'Real detail tabs exist');
  for (const tab of keys) {
    // Resolve by real aria-controls rather than assuming item IDs or translated labels.
    const control = page.locator(panel + ' [aria-controls="' + tab.control + '"]');
    await control.click();
    assert.equal(await control.getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#' + tab.control).isVisible(), true);
  }
  await page.locator(panel + ' ' + selector).first().click();
  return keys.map(tab => tab.key);
}

try {
  if (guildOnly) {
    report.scope = 'Incremental guild background/typography polish';
    for (const fixture of [false, true]) {
      if (fixture && !qaBase) continue;
      for (const width of [1672, 390, 420]) {
        const label = fixture ? 'guild-qa' : 'guild-public';
        const context = await browser.newContext({ viewport: { width, height: width === 1672 ? 941 : 844 }, ...(width < 768 ? { isMobile: true, hasTouch: true } : {}) });
        const page = await context.newPage(); observe(page, label + '-polish-' + width);
        await visit(page, fixture ? '/qa/guild' : '/espace-guilde', fixture ? '#guilde-content' : '#access-denied', fixture ? qaBase : base); await images(page);
        await check(label + ' final polish ' + width + ': layout/resources', async () => {
          assert.equal(await page.locator('#guilde-content').isVisible(), fixture);
          if (fixture) assert.ok((await page.locator('.qa-fixture-banner').innerText()).includes('données fictives'));
          return layout(page, label + '-polish-' + width);
        });
        const name = label + (width === 1672 ? '-reference' : width === 390 ? '-mobile' : '-mobile420');
        await screenshot(page, name); if (width < 768) await screenshot(page, name + '-full', true);
        await context.close();
      }
    }
  } else {
  if (!process.env.NAMELESS_SKIP_HOME) {
    for (const [width, height, name] of [[1672, 941, 'home-reference'], [1920, 1080, 'home-desktop']]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(); observe(page, name);
      await visit(page, '/', '[data-home-search]'); await images(page);
      await check(name + ': layout and image loading', () => layout(page, name));
      await screenshot(page, name); await screenshot(page, name + '-full', true);
      if (width === 1672) {
        await check('Desktop action menu: keyboard, ARIA and focus return', async () => {
          const trigger = page.locator('#hamburger'); await trigger.focus(); await page.keyboard.press('Enter');
          await page.locator('#reference-navigation[open]').waitFor();
          assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
          assert.equal(await page.locator('#reference-navigation').evaluate(element => element.contains(document.activeElement)), true);
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#reference-navigation').open);
          await page.waitForFunction(() => document.activeElement === document.querySelector('#hamburger'));
          assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
          return { focusReturned: true };
        });
        await check('Home real destination links and global search', async () => {
          const links = await page.locator('.home-entry,.home-record').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
          assert.equal(links.length, 9); assert.ok(links.every(link => link && !link.startsWith('#')));
          await page.locator('[data-home-search]').click(); await page.locator('#nm-global-query').fill('Illfang');
          const result = page.locator('.nm-search-results a[href="/boss/illfang"]'); await result.waitFor();
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#nameless-global-search').open);
          assert.equal(await page.locator('[data-home-search]').evaluate(element => element === document.activeElement), true);
          return { categoryLinks: 4, realRecords: 5, searchResult: '/boss/illfang' };
        });
        await check('Home scenery pauses every decorative layer and resumes', async () => {
          const selector = '.home-hero-mist,.home-hero-light,.home-hero-clouds,.home-hero-motes i';
          await page.locator('[data-home-motion]').click();
          const paused = await page.locator(selector).evaluateAll(elements => elements.map(element => getComputedStyle(element).animationPlayState));
          assert.ok(paused.every(state => state === 'paused'));
          await page.locator('[data-home-motion]').click();
          assert.equal(await page.locator('[data-home-motion]').getAttribute('aria-pressed'), 'false');
          return { pausedLayers: paused.length };
        });
      }
      await context.close();
    }
  }

  const desktopContext = await browser.newContext({ viewport: { width: 1672, height: 941 } });
  const desktop = await desktopContext.newPage(); observe(desktop, 'catalogues/map/guild');
  await visit(desktop, '/bestiaire', '.creature-card'); await images(desktop);
  await check('Bestiary desktop: real cards and initial inline selection', async () => {
    assert.equal(await desktop.locator('.creature-modal').getAttribute('data-panel-mode'), 'rail');
    assert.equal(await desktop.locator('.creature-modal').getAttribute('role'), 'region');
    assert.ok(await desktop.locator('.creature-card').count());
    return layout(desktop, 'bestiaire-desktop');
  });
  await screenshot(desktop, 'bestiaire-initial');
  await check('Bestiary: combinable real filters, chips and reset', async () => {
    const initial = await desktop.locator('#bes-count').innerText();
    await desktop.locator('[data-filter-field="bes-palier"][value="1"]').check();
    await desktop.locator('[data-filter-field="bes-category"][value="creature"]').check();
    assert.equal(await desktop.locator('#bes-active-filters button').count(), 2);
    assert.ok(await desktop.locator('.creature-card').count());
    const filtered = await desktop.locator('#bes-count').innerText(); assert.notEqual(filtered, initial);
    await desktop.locator('.creature-card[data-id="12"]').click(); await desktop.waitForTimeout(350);
    assert.equal(await desktop.locator('.creature-modal').getAttribute('data-creature'), '12');
    await screenshot(desktop, 'bestiaire-reference');
    await desktop.locator('#bes-reset').click(); assert.equal(await desktop.locator('#bes-active-filters button').count(), 0);
    assert.equal(await desktop.locator('#bes-count').innerText(), initial);
    return { initial, filtered, selectedRealCreature: '12' };
  });
  await check('Bestiary: selection, grid/list, sorting and detail tabs', async () => {
    const card = desktop.locator('.creature-card:not(.is-selected)').first(); const id = await card.getAttribute('data-id');
    await card.click(); assert.equal(await desktop.locator('.creature-modal').getAttribute('data-creature'), id);
    assert.equal(await desktop.locator('.creature-card[data-id="' + id + '"]').getAttribute('aria-expanded'), 'true');
    const detailTabs = await tabs(desktop, '.creature-modal');
    await desktop.locator('[data-catalog-view="list"]').click(); assert.equal(await desktop.locator('#creatures-grid').getAttribute('data-view'), 'list');
    await screenshot(desktop, 'bestiaire-list');
    await desktop.locator('[data-catalog-view="grid"]').click();
    await desktop.locator('#bes-sort').selectOption('name-desc'); const descending = await desktop.locator('.creature-card').first().getAttribute('data-id');
    await desktop.locator('#bes-sort').selectOption('name-asc'); assert.notEqual(await desktop.locator('.creature-card').first().getAttribute('data-id'), descending);
    await desktop.locator('#bes-reset').click();
    return { selectedCreature: id, detailTabs };
  });

  await visit(desktop, '/items', '.item-card'); await images(desktop);
  await check('Items desktop: real catalogue and inline selection', async () => {
    assert.equal(await desktop.locator('.item-modal').getAttribute('data-panel-mode'), 'rail');
    assert.equal(await desktop.locator('.item-modal').getAttribute('role'), 'region');
    return layout(desktop, 'items-desktop');
  });
  await screenshot(desktop, 'items-reference');
  await check('Items: selection, real sources tabs, grid/list and sorting', async () => {
    const card = desktop.locator('.item-card:not(.is-selected)').first(); const id = await card.getAttribute('data-id');
    await card.click(); assert.equal(await desktop.locator('.item-modal').getAttribute('data-item'), id);
    const detailTabs = await tabs(desktop, '.item-modal');
    await desktop.locator('[data-catalog-view="list"]').click(); assert.equal(await desktop.locator('#items-grid').getAttribute('data-view'), 'list');
    await screenshot(desktop, 'items-list'); await desktop.locator('[data-catalog-view="grid"]').click();
    await desktop.locator('#it-sort').selectOption('name-desc'); const descending = await desktop.locator('.item-card').first().getAttribute('data-id');
    await desktop.locator('#it-sort').selectOption('name-asc'); assert.notEqual(await desktop.locator('.item-card').first().getAttribute('data-id'), descending);
    await desktop.locator('#it-reset').click(); return { selectedRealItem: id, detailTabs };
  });
  await check('Items: category/rarity/source filters, chips, reset and known Gelée source', async () => {
    const initial = await desktop.locator('#it-count').innerText();
    await desktop.locator('[data-filter-field="it-category"][value$="Ressources"]').check();
    await desktop.locator('[data-filter-field="it-rarity"][value="common"]').check();
    await desktop.locator('[data-filter-field="it-source"][value="known"]').check();
    assert.equal(await desktop.locator('#it-active-filters button').count(), 3);
    assert.ok(await desktop.locator('.item-card').count()); const filtered = await desktop.locator('#it-count').innerText(); assert.notEqual(filtered, initial);
    await desktop.locator('#it-reset').click(); assert.equal(await desktop.locator('#it-count').innerText(), initial);
    await desktop.locator('#it-search').fill('Gelée de Slime'); await desktop.locator('.item-card[data-id="gelee_slime"]').waitFor();
    await desktop.locator('.item-card[data-id="gelee_slime"]').click();
    await desktop.locator('.item-modal [data-detail-tab="sources"]').click();
    await desktop.locator('.item-modal [data-catalogue-tab-panel="sources"] a').first().waitFor();
    const sourceLinks = await desktop.locator('.item-modal [data-catalogue-tab-panel="sources"] a').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    assert.ok(sourceLinks.some(link => link.includes('/bestiaire')));
    const detailTabs = await tabs(desktop, '.item-modal'); await screenshot(desktop, 'items-real-sources');
    return { initial, filtered, sourceLinks, detailTabs };
  });

  await visit(desktop, '/carte', '#map-floor-buttons button'); await images(desktop);
  await check('Map desktop: original floor image, real markers and selected place', () => layout(desktop, 'map-desktop'));
  await screenshot(desktop, 'map-reference');
  await check('Map: exactly three real floors and working floor navigation', async () => {
    const floors = await desktop.locator('#map-floor-buttons button').evaluateAll(elements => elements.map(element => element.dataset.floor)); assert.deepEqual(floors, ['1', '2', '3']);
    for (const floor of ['2', '3', '1']) {
      await desktop.locator('#map-floor-buttons [data-floor="' + floor + '"]').click();
      await desktop.waitForFunction(expected => document.querySelector('#floor-select').value === expected, floor);
      await desktop.waitForTimeout(500); await images(desktop);
      if (floor !== '1') await screenshot(desktop, 'map-floor-' + floor);
      assert.equal(await desktop.locator('#map-floor-buttons [data-floor="' + floor + '"]').getAttribute('aria-pressed'), 'true');
    }
    return { floors };
  });
  await check('Map: marker filters, names, legend and selected-place tabs', async () => {
    const initial = await desktop.locator('#game-map .leaflet-marker-icon:visible').count();
    await desktop.locator('#map-display-markers').uncheck(); assert.equal(await desktop.locator('#game-map .leaflet-marker-icon:visible').count(), 0);
    await desktop.locator('#map-display-markers').check(); assert.equal(await desktop.locator('#game-map .leaflet-marker-icon:visible').count(), initial);
    const typeFilter = desktop.locator('#map-filters input[data-marker-type]').first();
    await typeFilter.uncheck(); const filteredMarkers = await desktop.locator('#game-map .leaflet-marker-icon:visible').count(); assert.ok(filteredMarkers <= initial);
    await typeFilter.check(); assert.equal(await desktop.locator('#game-map .leaflet-marker-icon:visible').count(), initial);
    await desktop.locator('#map-display-names').uncheck(); assert.equal(await desktop.locator('#map-display-names').isChecked(), false); await desktop.locator('#map-display-names').check();
    await desktop.locator('#map-legend-open').click(); await desktop.locator('#map-legend[open]').waitFor(); await screenshot(desktop, 'map-legend');
    await desktop.keyboard.press('Escape'); await desktop.waitForFunction(() => !document.querySelector('#map-legend').open);
    const place = desktop.locator('.map-place-card:not(.is-selected)').first(); const key = await place.getAttribute('data-entity-key');
    await place.click(); await desktop.locator('#map-panel:not([hidden])').waitFor();
    assert.equal(new URL(desktop.url()).searchParams.get('entity'), key);
    const panelTabs = await tabs(desktop, '#map-panel', '[data-panel-tab]');
    await desktop.evaluate(() => scrollTo(0, 0)); await desktop.waitForTimeout(500); await screenshot(desktop, 'map-selected');
    return { markerCount: initial, filteredMarkers, selectedPlace: key, panelTabs };
  });

  await visit(desktop, '/espace-guilde', '#access-denied'); await images(desktop);
  await check('Guild public route: member gate and real sign-in links', async () => {
    assert.equal(await desktop.locator('#guilde-content').isVisible(), false);
    assert.equal(await desktop.locator('#access-denied a').count(), 2);
    assert.ok((await desktop.locator('#access-denied').innerText()).includes('membre'));
    return layout(desktop, 'guild-public-desktop');
  });
  await screenshot(desktop, 'guild-public-reference'); await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage(); observe(mobile, 'mobile');
  for (const [route, ready, name] of [['/', '[data-home-search]', 'home'], ['/bestiaire', '.creature-card', 'bestiaire'], ['/items', '.item-card', 'items'], ['/carte', '#map-floor-buttons button', 'map'], ['/espace-guilde', '#access-denied', 'guild-public']]) {
    if (route === '/' && process.env.NAMELESS_SKIP_HOME) continue;
    await visit(mobile, route, ready); await images(mobile);
    await check(name + ' mobile390: layout and images', () => layout(mobile, name + '-mobile'));
    await screenshot(mobile, name + '-mobile'); await screenshot(mobile, name + '-mobile-full', true);
    if (route === '/') await check('Home mobile menu opens and closes', async () => {
      await mobile.locator('#hamburger').focus(); await mobile.keyboard.press('Enter'); assert.equal(await mobile.locator('#hamburger').getAttribute('aria-expanded'), 'true');
      await mobile.keyboard.press('Escape'); assert.equal(await mobile.locator('#hamburger').getAttribute('aria-expanded'), 'false');
      assert.equal(await mobile.locator('#hamburger').evaluate(element => element === document.activeElement), true);
    });
    if (route === '/bestiaire' || route === '/items') await check(name + ' mobile: real detail sheet and Escape focus return', async () => {
      const card = mobile.locator(route === '/bestiaire' ? '.creature-card' : '.item-card').first();
      const panel = route === '/bestiaire' ? '.creature-modal' : '.item-modal';
      await card.click(); assert.equal(await mobile.locator(panel).getAttribute('data-panel-mode'), 'sheet'); assert.equal(await mobile.locator(panel).getAttribute('role'), 'dialog');
      await tabs(mobile, panel); await screenshot(mobile, name + '-mobile-detail');
      await mobile.keyboard.press('Escape'); assert.equal(await mobile.locator(panel).isVisible(), false);
      assert.equal(await card.evaluate(element => element === document.activeElement), true);
    });
    if (route === '/carte') await check('Map mobile: filter rail and legend are accessible', async () => {
      await mobile.locator('#map-filters-toggle').click(); assert.equal(await mobile.locator('#map-filters-toggle').getAttribute('aria-expanded'), 'true');
      await mobile.locator('#map-legend-open').click(); await mobile.locator('#map-legend[open]').waitFor();
      await mobile.keyboard.press('Escape'); await mobile.locator('#map-filters-toggle').click();
    });
  }
  await mobileContext.close();

  if (qaBase) {
    const context = await browser.newContext({ viewport: { width: 1672, height: 941 } });
    const page = await context.newPage(); observe(page, 'guild-isolated-QA');
    await visit(page, '/qa/guild', '#guilde-content', qaBase); await images(page);
    await check('Guild isolated QA: labeled fixture and reference dashboard', async () => {
      assert.ok((await page.locator('.qa-fixture-banner').innerText()).includes('données fictives'));
      assert.equal(await page.locator('#access-denied').isVisible(), false);
      return layout(page, 'guild-isolated-QA');
    });
    await screenshot(page, 'guild-qa-reference');
    await check('Guild isolated QA: real tabs and calendar controls', async () => {
      const keys = await page.locator('[data-hq-tab]').evaluateAll(elements => elements.map(element => element.dataset.hqTab));
      for (const key of keys) {
        await page.locator('[data-hq-tab="' + key + '"]').click();
        assert.equal(await page.locator('[data-hq-tab="' + key + '"]').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('[data-hq-panel="' + key + '"]').isVisible(), true);
      }
      await page.locator('[data-hq-tab="overview"]').click(); const before = await page.locator('#hq-month-label').innerText();
      await page.locator('[data-calendar-offset="1"]').click(); assert.notEqual(await page.locator('#hq-month-label').innerText(), before);
      await page.locator('[data-calendar-offset="-1"]').click(); assert.equal(await page.locator('#hq-month-label').innerText(), before);
      return { tabs: keys, month: before, fixtureOnly: true };
    });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await images(page);
    await check('Guild isolated QA mobile390: layout and resources', () => layout(page, 'guild-isolated-QA-mobile'));
    await screenshot(page, 'guild-qa-mobile'); await screenshot(page, 'guild-qa-mobile-full', true);
    await context.close();
  }

  if (!process.env.NAMELESS_SKIP_HOME) await check('Reduced motion home remains still', async () => {
    const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); observe(page, 'reduced-motion');
    try {
      await visit(page, '/', '[data-home-motion]');
      assert.equal(await page.locator('[data-home-motion]').isDisabled(), true);
      const running = await page.locator('[data-home]').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation.effect.getTiming().iterations === Infinity).length);
      assert.equal(running, 0); return { runningDecorativeAnimations: running };
    } finally { await context.close(); }
  });
  if (!process.env.NAMELESS_SKIP_HOME) await check('Real browser motion and selection recording', async () => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: output, size: { width: 1920, height: 1080 } } });
    const page = await context.newPage(); observe(page, 'recording'); const video = page.video(); const started = Date.now();
    try {
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await page.locator('[data-home-search]').waitFor(); await page.waitForTimeout(1500);
      await page.mouse.move(1510, 240, { steps: 24 }); await page.waitForTimeout(700); await page.locator('.home-entry').nth(1).hover(); await page.waitForTimeout(600);
      await page.locator('.home-entry[href="/bestiaire"]').click(); await page.locator('.creature-card').first().waitFor(); await page.waitForTimeout(500);
      await page.locator('.creature-card').nth(1).click(); await page.waitForTimeout(450); await page.locator('.creature-modal [data-detail-tab="drops"]').click(); await page.waitForTimeout(650);
      await page.locator('.nav-menu a').filter({ hasText: /^Objets$/ }).click(); await page.locator('.item-card').first().waitFor(); await page.waitForTimeout(350);
      await page.locator('.item-card').nth(1).click(); await page.waitForTimeout(450); await page.locator('.item-modal [data-detail-tab="sources"]').click(); await page.waitForTimeout(650);
      await page.locator('.nav-menu a').filter({ hasText: /^Carte$/ }).click(); await page.locator('#map-floor-buttons [data-floor="2"]').waitFor(); await page.waitForTimeout(600);
      await page.locator('#map-floor-buttons [data-floor="2"]').click(); await page.waitForTimeout(900); await page.locator('#map-floor-buttons [data-floor="1"]').click();
      await page.waitForTimeout(Math.max(1000, 16500 - (Date.now() - started)));
    } finally { await context.close(); }
    const destination = path.join(output, 'reference-motion-demo.webm'); await video.saveAs(destination); const original = await video.path();
    if (original !== destination && fs.existsSync(original)) fs.unlinkSync(original);
    assert.ok(fs.statSync(destination).size > 100000);
    return { file: 'reference-motion-demo.webm', viewport: '1920×1080', actions: ['hero entrance', 'parallax', 'hover', 'creature selection', 'drops tab', 'item selection', 'sources tab', 'real floor transitions'] };
  });
  }
} catch (error) {
  report.fatalError = { check: currentCheck, message: error.message.slice(0, 800) };
} finally {
  await browser.close();
  for (const key of ['browserErrors', 'consoleErrors', 'localHttpErrors', 'abortedRequests', 'externalNetwork']) report[key] = [...new Map(report[key].map(value => [JSON.stringify(value), value])).values()];
  report.summary = { passed: report.checks.filter(result => result.passed).length, failed: report.checks.filter(result => !result.passed).length };
  fs.writeFileSync(path.join(output, guildOnly ? 'guild-polish-verification.json' : 'browser-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report.summary, failed: report.checks.filter(result => !result.passed), fatalError: report.fatalError, browserErrors: report.browserErrors, localHttpErrors: report.localHttpErrors }, null, 2));
  if (report.summary.failed || report.fatalError) process.exitCode = 1;
}
