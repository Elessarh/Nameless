/** Browser evidence for phase 1. Uses installed Playwright/Chromium; never installs packages.
 * Run after `npm run build` and starting the site on :4173:
 * node tools/verify-home-phase1.mjs
 * Optional NAMELESS_BASE_URL, NAMELESS_PLAYWRIGHT_MODULE, NAMELESS_CHROMIUM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = path.join(root, 'docs/home-premium-phase1-2026-10-09');
const base = process.env.NAMELESS_BASE_URL || 'http://127.0.0.1:4173';
const profile = process.env.USERPROFILE || '';
const bundled = path.join(profile, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
let playwright;
if (process.env.NAMELESS_PLAYWRIGHT_MODULE) {
  playwright = await import(pathToFileURL(process.env.NAMELESS_PLAYWRIGHT_MODULE).href);
} else {
  try { playwright = await import('playwright'); }
  catch { playwright = await import(pathToFileURL(bundled).href); }
}
const browserCache = path.join(process.env.LOCALAPPDATA || path.join(profile, 'AppData/Local'), 'ms-playwright');
const installedChromium = fs.existsSync(browserCache) ? fs.readdirSync(browserCache)
  .filter(name => /^chromium-\d+$/.test(name))
  .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  .map(name => path.join(browserCache, name, 'chrome-win64/chrome.exe'))
  .find(filename => fs.existsSync(filename)) : null;
fs.mkdirSync(output, { recursive: true });
const browser = await playwright.chromium.launch({
  ...(process.env.NAMELESS_CHROMIUM || installedChromium ? { executablePath: process.env.NAMELESS_CHROMIUM || installedChromium } : {})
});
const observations = {
  base, generatedAt: new Date().toISOString(), checks: [], viewports: [], routes: [],
  browserErrors: [], consoleErrors: [], localRequestFailures: [], localHttpErrors: [], externalNetworkObservations: []
};
let currentCheck = 'Initial navigation';
function observe(page, label) {
  page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => observations.browserErrors.push({ page: label, check: currentCheck, message: error.message, stack: error.stack }));
  page.on('console', message => {
    if (message.type() === 'error') observations.consoleErrors.push({ page: label, message: message.text() });
  });
  page.on('requestfailed', request => {
    const event = { page: label, url: request.url(), error: request.failure()?.errorText };
    (request.url().startsWith(base) ? observations.localRequestFailures : observations.externalNetworkObservations).push(event);
  });
  page.on('response', response => {
    if (response.status() < 400) return;
    const event = { page: label, url: response.url(), status: response.status() };
    (response.url().startsWith(base) ? observations.localHttpErrors : observations.externalNetworkObservations).push(event);
  });
}
async function check(name, action) {
  currentCheck = name;
  console.log('Checking: ' + name);
  try { const detail = await action(); observations.checks.push({ name, passed: true, ...(detail ? { detail } : {}) }); }
  catch (error) { observations.checks.push({ name, passed: false, message: error.message.slice(0, 800) }); console.log('FAILED: ' + error.message.slice(0, 800)); }
}
async function home(page) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-home-search]').waitFor();
  await page.waitForFunction(() => !!window.NamelessGlobalSearch && document.fonts.status === 'loaded');
  await page.waitForTimeout(1500);
}
async function layout(page, width) {
  const metrics = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    pageWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    brokenImages: Array.from(document.images).filter(image => image.complete && !image.naturalWidth).map(image => image.currentSrc || image.src),
    heading: document.querySelector('h1')?.textContent.trim()
  }));
  assert.equal(metrics.pageWidth, width, 'No horizontal page overflow');
  assert.deepEqual(metrics.brokenImages, [], 'All rendered image resources load');
  observations.viewports.push(metrics);
  return metrics;
}
async function loadAllImages(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 80));
    }
    await Promise.all(Array.from(document.images).map(image => image.complete ? Promise.resolve() :
      new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 5000); })));
    scrollTo(0, 0);
  });
  await page.waitForTimeout(200);
}
async function fullScreenshot(page, filename) {
  // Match the visible document width. Chromium includes clipped decorative bleed
  // in body.scrollWidth when calculating its automatic full-page canvas.
  const clip = await page.evaluate(() => ({ x: 0, y: 0, width: innerWidth, height: document.documentElement.scrollHeight }));
  await page.screenshot({ path: path.join(output, filename), fullPage: true, clip });
}
async function decoration(page) {
  return page.locator('.home-hero-mist,.home-hero-light,.home-hero-clouds,.home-hero-motes i').evaluateAll(elements => elements.map(element => ({
    element: element.className || element.parentElement.className + ' i',
    animation: getComputedStyle(element).animationName,
    playState: getComputedStyle(element).animationPlayState,
    transform: getComputedStyle(element).transform,
    opacity: getComputedStyle(element).opacity,
    visible: element.checkVisibility()
  })));
}

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const desktop = await desktopContext.newPage(); observe(desktop, 'desktop');
  await home(desktop);
  await loadAllImages(desktop);
  await check('Desktop 1920 × 1080: image loading and overflow', () => layout(desktop, 1920));
  await desktop.screenshot({ path: path.join(output, 'home-desktop.png') });
  await fullScreenshot(desktop, 'home-desktop-full.png');

  await check('Four category destinations and five discoveries resolve to real local routes', async () => {
    const routes = await desktop.locator('.home-entry,.home-record').evaluateAll(links => links.map(link => ({
      title: link.querySelector('h3')?.textContent.trim(), href: link.getAttribute('href'), record: link.dataset.homeRecord || null
    })));
    assert.equal(routes.length, 9);
    assert.equal(routes.filter(route => route.record).length, 5);
    for (const route of routes) {
      const response = await desktopContext.request.get(base + route.href, { timeout: 7000 });
      assert.equal(response.status(), 200, route.href);
      const content = await response.text();
      assert.ok(content.includes('<main') || content.includes('<h1'), 'Page content for ' + route.href);
      observations.routes.push({ ...route, status: response.status() });
    }
    return { categories: 4, discoveries: 5 };
  });

  await check('Hero search opens dialog, Escape restores focus, Ctrl+K opens and closes', async () => {
    await desktop.locator('[data-home-search]').click();
    await desktop.locator('#nameless-global-search[open]').waitFor();
    assert.equal(await desktop.locator('#nm-global-query').evaluate(element => element === document.activeElement), true);
    await desktop.keyboard.press('Escape');
    assert.equal(await desktop.locator('[data-home-search]').evaluate(element => element === document.activeElement), true);
    await desktop.keyboard.press('Control+k');
    await desktop.locator('#nameless-global-search[open]').waitFor();
    await desktop.keyboard.press('Control+k');
    assert.equal(await desktop.locator('#nameless-global-search').evaluate(dialog => dialog.open), false);
  });
  await check('Search Illfang, keyboard navigation, real boss route, and home return', async () => {
    try {
      await desktop.locator('[data-home-search]').click();
      await desktop.locator('#nm-global-query').fill('Illfang');
      const result = desktop.locator('.nm-search-results a[href="/boss/illfang"]');
      await result.waitFor();
      await desktop.keyboard.press('ArrowDown');
      assert.equal(await result.evaluate(element => element === document.activeElement), true);
      await desktop.keyboard.press('Enter');
      await desktop.waitForURL(url => url.pathname.replace(/\/$/, '') === '/boss/illfang');
      await desktop.locator('h1').filter({ hasText: 'Illfang' }).waitFor();
      await desktop.goBack({ waitUntil: 'domcontentloaded' });
      await desktop.locator('[data-home-search]').waitFor();
      await desktop.waitForTimeout(500);
      assert.equal(new URL(desktop.url()).pathname, '/');
      return { route: '/boss/illfang/', returnedHome: true };
    } finally { if (!await desktop.locator('[data-home-search]').count()) await home(desktop); }
  });

  await check('Decorative mist, light, clouds and motes actually animate; pause and resume affect every layer', async () => {
    await desktop.evaluate(() => scrollTo(0, 0));
    await desktop.waitForTimeout(400);
    const before = await decoration(desktop);
    await desktop.waitForTimeout(750);
    const after = await decoration(desktop);
    assert.ok(before.every(layer => layer.animation !== 'none' && layer.playState === 'running'));
    assert.ok(before.some((layer, index) => layer.transform !== after[index].transform || layer.opacity !== after[index].opacity), 'Observed changing CSS animation properties');
    await desktop.locator('[data-home-motion]').click();
    const paused = await decoration(desktop);
    assert.ok(paused.every(layer => layer.playState === 'paused'));
    assert.equal(await desktop.locator('[data-home]').getAttribute('data-motion-paused'), 'true');
    await desktop.waitForTimeout(250);
    const still = await decoration(desktop);
    assert.deepEqual(paused.map(layer => [layer.transform, layer.opacity]), still.map(layer => [layer.transform, layer.opacity]));
    await desktop.locator('[data-home-motion]').click();
    const resumed = await decoration(desktop);
    assert.ok(resumed.every(layer => layer.playState === 'running'));
    return { movingLayers: before.length, pausedLayers: paused.length, resumedLayers: resumed.length };
  });
  await check('Pointer parallax moves the scene and resets on pointer exit', async () => {
    await desktop.mouse.move(1600, 230);
    await desktop.waitForTimeout(150);
    const depth = await desktop.locator('[data-home]').evaluate(element => ({ x: element.style.getPropertyValue('--home-depth-x'), y: element.style.getPropertyValue('--home-depth-y') }));
    assert.notEqual(depth.x, '0px');
    assert.notEqual(depth.x, '');
    await desktop.mouse.move(10, 10);
    await desktop.waitForTimeout(50);
    assert.equal(await desktop.locator('[data-home]').evaluate(element => element.style.getPropertyValue('--home-depth-x')), '0px');
    return depth;
  });
  await check('Category hover raises card and uses the luminous frame', async () => {
    const card = desktop.locator('.home-entry').first();
    await card.hover(); await desktop.waitForTimeout(250);
    const visual = await card.evaluate(element => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
    assert.notEqual(visual.transform, 'none');
    assert.notEqual(visual.shadow, 'none');
    await desktop.mouse.move(10, 10);
    return visual;
  });
  await check('FR/EN translates hero, guild section, guild destination and motion control', async () => {
    const french = await desktop.locator('#join-title').innerText();
    await desktop.locator('.language-option').filter({ hasText: /^EN$/ }).click();
    await desktop.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await desktop.locator('#join-title').innerText(), 'Our guild');
    assert.equal(await desktop.locator('.home-guild .home-text-link span').innerText(), 'View the guild');
    assert.equal(await desktop.locator('.home-entry[href="/espace-guilde"] h3').innerText(), 'Guild');
    assert.equal(await desktop.locator('[data-home-motion]').getAttribute('aria-label'), 'Pause scenery');
    const englishHero = await desktop.locator('h1').innerText();
    await desktop.locator('.language-option').filter({ hasText: /^FR$/ }).click();
    await desktop.waitForFunction(() => document.documentElement.lang === 'fr');
    assert.equal(await desktop.locator('#join-title').innerText(), french);
    return { frenchGuild: french, englishGuild: 'Our guild', englishHero };
  });
  await desktopContext.close();

  await check('Direct nonhome route to home loads home CSS through SPA registry', async () => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage(); observe(page, 'direct-nonhome-to-home');
    try {
      await page.goto(base + '/bestiaire', { waitUntil: 'domcontentloaded' });
      await page.locator('h1').filter({ hasText: 'Bestiaire' }).waitFor();
      await page.locator('.nav-logo-container a[href="/"]').click();
      await page.waitForURL(base + '/');
      await page.locator('.home-hero').waitFor();
      await page.waitForTimeout(600);
      const applied = await page.locator('.home-hero-clouds').evaluate(element => ({ animation: getComputedStyle(element).animationName, css: Array.from(document.styleSheets).some(sheet => sheet.href?.includes('/css/components/home-premium.css')) }));
      assert.equal(applied.css, true);
      assert.equal(applied.animation, 'premium-clouds');
      return applied;
    } finally { await context.close(); }
  });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage(); observe(mobile, 'mobile');
  await home(mobile); await loadAllImages(mobile);
  await check('Mobile 390 px: image loading and overflow', () => layout(mobile, 390));
  await mobile.screenshot({ path: path.join(output, 'home-mobile.png') });
  await fullScreenshot(mobile, 'home-mobile-full.png');
  await check('Mobile menu opens, category navigation works, and home returns', async () => {
    try {
      await mobile.locator('#hamburger').click();
      assert.equal(await mobile.locator('#hamburger').getAttribute('aria-expanded'), 'true');
      await mobile.locator('#nav-menu.active').waitFor();
      await mobile.screenshot({ path: path.join(output, 'home-mobile-menu.png') });
      await mobile.locator('#nav-menu a[href$="/bestiaire"]').click();
      await mobile.waitForURL(url => url.pathname.replace(/\/$/, '') === '/bestiaire');
      await mobile.locator('h1').filter({ hasText: 'Bestiaire' }).waitFor();
      await mobile.goBack({ waitUntil: 'domcontentloaded' });
      await mobile.locator('[data-home-search]').waitFor();
      await mobile.waitForTimeout(500);
      return { route: '/bestiaire' };
    } finally {
      if (!await mobile.locator('[data-home-search]').count()) await home(mobile);
      if (await mobile.locator('#nav-menu.active').count()) {
        await mobile.locator('#hamburger').click();
        await mobile.waitForTimeout(300);
      }
    }
  });
  await check('Mobile hero search: filled query closes with one Escape and focus returns', async () => {
    await mobile.locator('[data-home-search]').click();
    await mobile.locator('#nameless-global-search[open]').waitFor();
    await mobile.locator('#nm-global-query').fill('potion');
    await mobile.locator('.nm-search-results a').first().waitFor();
    assert.ok(await mobile.locator('.nm-search-results a').count());
    await mobile.keyboard.press('Escape');
    await mobile.waitForFunction(() => !document.querySelector('#nameless-global-search').open);
    assert.equal(await mobile.locator('[data-home-search]').evaluate(element => element === document.activeElement), true);
  });
  await mobileContext.close();

  for (const width of [320, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage(); observe(page, String(width));
    await home(page); await loadAllImages(page);
    await check('Additional ' + width + ' px viewport: no overflow or broken images', () => layout(page, width));
    await context.close();
  }
  const reducedContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
  const reduced = await reducedContext.newPage(); observe(reduced, 'reduced-motion');
  await home(reduced);
  await check('Reduced motion removes decorative animation and disables scenery toggle', async () => {
    const states = await decoration(reduced);
    assert.ok(states.every(layer => layer.animation === 'none'));
    assert.equal(await reduced.locator('[data-home-motion]').isDisabled(), true);
    assert.equal(await reduced.locator('[data-home-motion]').getAttribute('aria-pressed'), 'true');
    const running = await reduced.locator('[data-home]').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation.effect.getTiming().iterations === Infinity).length);
    assert.equal(running, 0);
    return { decorativeInfiniteAnimationsRunning: running };
  });
  await reducedContext.close();

  await check('Actual browser animation recording', async () => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: output, size: { width: 1920, height: 1080 } } });
    const page = await context.newPage(); observe(page, 'recording');
    const video = page.video();
    const start = Date.now();
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-home-search]').waitFor();
    await page.waitForTimeout(1700);
    await page.mouse.move(1250, 220, { steps: 18 });
    await page.waitForTimeout(1000);
    await page.mouse.move(1620, 430, { steps: 30 });
    await page.waitForTimeout(1000);
    await page.locator('.home-entry').nth(1).hover();
    await page.waitForTimeout(1700);
    await page.locator('[data-home-search]').click();
    await page.locator('#nm-global-query').fill('Illfang');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#nameless-global-search').open);
    await page.waitForTimeout(800);
    await page.locator('[data-home-motion]').click();
    await page.waitForTimeout(1700);
    await page.locator('[data-home-motion]').click();
    await page.mouse.move(1500, 210, { steps: 20 });
    await page.waitForTimeout(Math.max(1500, 15500 - (Date.now() - start)));
    await context.close();
    const destination = path.join(output, 'home-motion-demo.webm');
    await video.saveAs(destination);
    const original = await video.path();
    if (original !== destination && fs.existsSync(original)) fs.unlinkSync(original);
    assert.ok(fs.statSync(destination).size > 100000);
    return { filename: 'home-motion-demo.webm', seconds: Math.round((Date.now() - start) / 1000), resolution: '1920 × 1080', actions: ['entrance', 'pointer parallax', 'category hover', 'search', 'pause', 'resume'] };
  });
} catch (error) {
  observations.fatalError = { check: currentCheck, message: error.message.slice(0, 800) };
} finally {
  await browser.close();
  for (const key of ['browserErrors', 'consoleErrors', 'localRequestFailures', 'localHttpErrors', 'externalNetworkObservations']) {
    observations[key] = [...new Map(observations[key].map(event => [JSON.stringify(event), event])).values()];
  }
  observations.summary = { passed: observations.checks.filter(check => check.passed).length, failed: observations.checks.filter(check => !check.passed).length };
  fs.writeFileSync(path.join(output, 'browser-verification.json'), JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify({ ...observations.summary, output, ...(observations.fatalError ? { fatalError: observations.fatalError } : {}), failedChecks: observations.checks.filter(check => !check.passed), browserErrors: observations.browserErrors, localHttpErrors: observations.localHttpErrors }, null, 2));
  if (observations.summary.failed || observations.fatalError) process.exitCode = 1;
}
