#!/usr/bin/env node
// Reading landmarks preserve source content, public hashes and SPA/i18n behavior.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function text(element) { return element?.textContent.replace(/\s+/g, ' ').trim() || ''; }
function key(w, target, value, options = {}) { target.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })); }
function route(w, hash) { w.history.replaceState({}, '', '/wiki' + hash); w.document.dispatchEvent(new w.CustomEvent('nameless:routechange')); }
function surface(hash = '', width = 1920) {
    const dom = new JSDOM(read('pages/wiki.html'), { url: 'https://nameless-sao.fr/wiki' + hash, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.innerWidth = width;
    w.NamelessSpaRouter = { controlsLifecycle: true };
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = function () { this.dataset.scrolled = 'true'; };
    w.matchMedia = () => ({ matches: true });
    w.localStorage.setItem('nameless-language', 'fr');
    const observers = [];
    w.IntersectionObserver = class {
        constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; this.disconnected = false; observers.push(this); }
        observe(target) { this.targets.push(target); }
        disconnect() { this.disconnected = true; }
        emit() { this.callback([]); }
    };
    w.eval(read('js/wiki.js'));
    return { dom, w, d: w.document, observers };
}

{
    const { dom, w, d, observers } = surface('#reglement-aincrad/page-reglement-aincrad-section-3');
    const sourcePages = Array.from(d.querySelectorAll('.wiki-page'));
    const sourceIDs = sourcePages.map(page => page.id);
    const sourceNodes = sourcePages.filter(page => page.id !== 'page-accueil').flatMap(page => Array.from(page.children).filter(node => !node.matches('h1, .wiki-breadcrumb')));
    const sourceHeadings = sourcePages.flatMap(page => Array.from(page.querySelectorAll('h2, h3')));
    const sourceHeadingTexts = sourceHeadings.map(text);
    const sourceHeadingIcons = sourceHeadings.map(heading => heading.querySelector('.nm-pixel-icon'));
    w.NamelessWikiPage.init(d);
    check(sourceIDs.length === 55 && sourceIDs.join() === Array.from(d.querySelectorAll('.wiki-page')).map(page => page.id).join(), 'All 55 existing pages keep their public article IDs');
    check(d.querySelector('[data-wiki-guide-count]').textContent === '54', 'The guide count excludes the overview and counts genuine articles');
    check(sourceNodes.every(node => node.isConnected && node.closest('.wiki-article-body')), 'Article bodies retain the original content nodes');
    check(sourceHeadings.every((heading, index) => text(heading) === sourceHeadingTexts[index] && heading.querySelector('.nm-pixel-icon') === sourceHeadingIcons[index]), 'TOC projection does not alter source heading labels or icons');
    check(sourcePages.filter(page => page.id !== 'page-accueil').every(page => page.querySelector('h1').parentNode === page && page.querySelector('.wiki-breadcrumb').parentNode === page), 'Breadcrumbs and titles remain outside the reading body');
    check(d.activeElement.id === 'page-reglement-aincrad-section-3' && d.querySelector('#page-reglement-aincrad').classList.contains('active'), 'An existing section deep link focuses the intended article heading');
    const regulation = d.querySelector('#page-reglement-aincrad');
    check(regulation.querySelector('.wiki-toc [aria-current="location"]').dataset.section === d.activeElement.id, 'Section deep links also mark the active reading location');
    check(regulation.querySelector('.wiki-article-label').textContent === 'Règlement', 'The article category comes from its real sidebar group');
    check(!regulation.querySelector('.wiki-article-prev') && regulation.querySelector('.wiki-article-next').hash === '#reglement-discord', 'Previous/next links stay inside the real group and respect its first entry');
    const twoHeadings = sourcePages.find(page => page.id !== 'page-accueil' && page.querySelectorAll('.wiki-article-body h2, .wiki-article-body h3').length === 2);
    check(twoHeadings?.querySelectorAll('.wiki-toc a').length === 2, 'Articles with two headings receive a complete TOC');
    check(d.querySelector('#page-devlogs .wiki-toc-subsection a') && !d.querySelector('.wiki-toc .nm-pixel-icon'), 'H3 entries are indented and TOC labels omit cloned decorative icons');
    check(sourcePages.filter(page => page.id !== 'page-accueil').every(page => Array.from(page.querySelectorAll('.wiki-related a, .wiki-article-pagination a')).every(link => sourceIDs.includes('page-' + link.dataset.page))), 'Every related and pagination link leads to a genuine existing article');

    const retainedIDs = sourceHeadings.map(heading => heading.id);
    const lastObserver = observers.at(-1);
    w.NamelessWikiPage.init(d);
    check(lastObserver.disconnected && d.querySelectorAll('.wiki-reading-layout').length === 54 && d.querySelectorAll('.wiki-related').length === 54 && d.querySelectorAll('.wiki-article-pagination').length === 54, 'Remount disconnects the previous observer and never duplicates article chrome');
    check(sourceHeadings.every((heading, index) => heading.id === retainedIDs[index]), 'Section IDs remain stable across remounts');
    const activeBeforeStale = regulation.querySelector('.wiki-toc [aria-current="location"]').dataset.section;
    sourceHeadings.filter(heading => regulation.contains(heading)).forEach(heading => { heading.getBoundingClientRect = () => ({ top: -100 }); });
    lastObserver.emit();
    check(regulation.querySelector('.wiki-toc [aria-current="location"]').dataset.section === activeBeforeStale, 'A stale observer cannot mutate the current reading location after remount');

    const next = regulation.querySelector('.wiki-article-next');
    const modifiedClick = new w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    next.dispatchEvent(modifiedClick);
    check(!modifiedClick.defaultPrevented && regulation.classList.contains('active'), 'Modified native article links remain available for opening another tab');
    next.click();
    check(w.location.hash === '#reglement-discord' && d.querySelector('#page-reglement-discord').classList.contains('active'), 'Generated next-guide links participate in native article history');
    await pause(20);
    w.history.back(); await pause(30);
    check(w.location.hash === '#reglement-aincrad/page-reglement-aincrad-section-3' && d.activeElement.id === 'page-reglement-aincrad-section-3', 'Back navigation restores the previous article section');
    w.history.forward(); await pause(30);
    check(w.location.hash === '#reglement-discord' && d.querySelector('#page-reglement-discord').classList.contains('active'), 'Forward navigation restores the next article');
    const beforeDestroy = d.querySelectorAll('.wiki-reading-layout').length;
    w.NamelessWikiPage.destroy();
    check(observers.at(-1).disconnected, 'Destruction disconnects the active reading observer');
    d.querySelector('#page-reglement-discord .wiki-article-next').click();
    check(d.querySelectorAll('.wiki-reading-layout').length === beforeDestroy && d.querySelector('#page-reglement-discord').classList.contains('active'), 'Destroyed view navigation handlers no longer switch articles');
    dom.window.close();
}

{
    const { dom, w, d, observers } = surface('#faq');
    w.NamelessWikiPage.init(d);
    const faq = d.querySelector('#page-faq');
    const headings = Array.from(faq.querySelectorAll('.wiki-article-body h2, .wiki-article-body h3'));
    headings.forEach((heading, index) => { heading.getBoundingClientRect = () => ({ top: [12, 80, 450, 650][index] }); });
    observers.at(-1).emit();
    check(faq.querySelector('.wiki-toc [aria-current="location"]').dataset.section === headings[1].id, 'Reading observation marks the last heading above the reading offset');
    check(w.location.hash === '#faq', 'Passive scrolling does not add history entries or overwrite public article hashes');
    const link = faq.querySelectorAll('.wiki-toc a')[2];
    link.click();
    check(w.location.hash === '#faq/' + headings[2].id && d.activeElement === headings[2] && headings[2].dataset.scrolled === 'true', 'TOC selection updates a stable section hash, focuses its heading and scrolls to it');
    check(!d.querySelector('#wiki-nav [data-scrolled]'), 'Sidebar active-item reveal never calls document-scrolling scrollIntoView');
    route(w, '#faq/page-mage-section-1');
    check(d.activeElement === faq.querySelector('h1'), 'A section from another article cannot focus a hidden heading');
    route(w, '#article-inexistant');
    check(d.querySelector('#page-accueil').classList.contains('active'), 'Unknown public article hashes retain the overview fallback');
    w.NamelessWikiPage.destroy(); dom.window.close();
}

{
    const { dom, w, d } = surface('#guerrier');
    const translationObservers = [];
    const NativeMutationObserver = w.MutationObserver;
    w.MutationObserver = class extends NativeMutationObserver {
        constructor(callback) { super(callback); translationObservers.push(this); }
    };
    for (const script of ['js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n.js']) w.eval(read(script));
    w.NamelessI18n.setLanguage('fr');
    w.NamelessWikiPage.init(d);
    const warrior = d.querySelector('#page-guerrier');
    const ids = Array.from(warrior.querySelectorAll('.wiki-article-body h2, .wiki-article-body h3')).map(heading => heading.id);
    const frenchCategory = warrior.querySelector('.wiki-article-label').textContent;
    const search = d.querySelector('#wiki-search');
    search.value = 'guerrier'; search.dispatchEvent(new w.Event('input')); await pause(130);
    check(d.querySelector('#wiki-search-results [data-page="guerrier"]'), 'Local search indexes genuine French article titles and content');
    w.NamelessI18n.setLanguage('en');
    search.value = 'warrior'; search.dispatchEvent(new w.Event('input')); await pause(130);
    check(d.querySelector('#wiki-search-results [data-page="guerrier"]')?.textContent.includes('Warrior'), 'Language switching rebuilds local search from translated source titles');
    check(warrior.querySelector('.wiki-article-label').textContent !== frenchCategory && warrior.querySelector('.wiki-toc strong').textContent === 'On this page', 'Categories and dynamic reading controls follow English without stale French labels');
    check(warrior.querySelector('.wiki-article-prev small').textContent === 'Previous guide' && warrior.querySelector('.wiki-related h2').textContent === 'Continue reading', 'Related and previous/next controls follow the current locale');
    check(Array.from(warrior.querySelectorAll('.wiki-toc a')).every((link, index) => link.dataset.section === ids[index] && link.textContent === text(warrior.querySelector('.wiki-article-body #' + ids[index]))), 'English TOC projection retains IDs and uses current source heading labels');
    key(w, search, 'ArrowUp');
    check(d.activeElement === d.querySelector('#wiki-search-results button:last-child'), 'ArrowUp from search starts at the last result');
    key(w, d.activeElement, 'Escape');
    check(d.activeElement === search && search.getAttribute('aria-expanded') === 'false', 'Search Escape restores focus and closes the results');
    w.NamelessI18n.setLanguage('fr');
    check(warrior.querySelector('.wiki-article-label').textContent === frenchCategory && warrior.querySelector('.wiki-toc strong').textContent === 'Dans cet article', 'Returning to French restores article projections without losing source text');
    check(Array.from(warrior.querySelectorAll('.wiki-article-body h2, .wiki-article-body h3')).every((heading, index) => heading.id === ids[index]), 'FR/EN switches never change the permanent section IDs');
    search.value = 'aucun-guide-xyz'; search.dispatchEvent(new w.Event('input')); await pause(130);
    check(d.querySelector('#wiki-search-results .is-empty').textContent === 'Aucun guide trouvé', 'An empty local query reports a truthful French empty state');
    w.NamelessWikiPage.destroy();
    translationObservers.forEach(observer => observer.disconnect());
    dom.window.close();
}

{
    const { dom, w, d } = surface('', 390);
    d.body.style.overflow = 'clip';
    w.NamelessWikiPage.init(d);
    const opener = d.querySelector('[data-wiki-search]');
    const search = d.querySelector('#wiki-search');
    const sidebar = d.querySelector('#wiki-sidebar');
    opener.click();
    check(sidebar.classList.contains('open') && d.activeElement === search && d.querySelector('.wiki-content').inert, 'Home guide search opens the mobile index and focuses the real local field');
    check(d.querySelector('#sidebar-toggle [data-wiki-toggle-label]').textContent === 'Fermer', 'The persistent mobile guide toggle names its close action');
    search.value = 'reglement'; search.dispatchEvent(new w.Event('input')); await pause(130);
    key(w, search, 'Escape');
    check(sidebar.classList.contains('open') && search.getAttribute('aria-expanded') === 'false', 'Search Escape closes its results before closing the mobile drawer');
    key(w, search, 'Escape');
    check(!sidebar.classList.contains('open') && d.activeElement.id === 'sidebar-toggle' && d.body.style.overflow === 'clip', 'The next Escape closes the drawer and restores focus and prior scrolling');
    opener.click();
    let globalMenuSawRestoredState = false;
    d.querySelector('#hamburger').addEventListener('click', () => {
        globalMenuSawRestoredState = !sidebar.classList.contains('open') && d.body.style.overflow === 'clip' && d.querySelector('.wiki-content').inert !== true;
    }, { once: true });
    d.querySelector('#hamburger').click();
    check(globalMenuSawRestoredState, 'Opening the global mobile navigation releases Wiki drawer side effects before its target handler runs');
    opener.click(); search.value = 'mage'; search.dispatchEvent(new w.Event('input'));
    w.NamelessWikiPage.destroy(); await pause(130);
    check(d.body.style.overflow === 'clip' && d.querySelector('.wiki-content').inert !== true && !d.querySelector('#wiki-search-results [data-page="mage"]'), 'Destruction cancels pending search and restores drawer side effects');
    dom.window.close();
}

{
    const { dom, w, d } = surface('#guerrier');
    const translationObservers = [];
    const NativeMutationObserver = w.MutationObserver;
    w.MutationObserver = class extends NativeMutationObserver {
        constructor(callback) { super(callback); translationObservers.push(this); }
    };
    for (const file of ['i18n-en.js', 'i18n-en-reviewed.js', 'i18n-quests-en-reviewed.js', 'i18n-game-en-reviewed.js', 'i18n-information-en-reviewed.js', 'i18n.js']) w.eval(read('js/' + file));
    w.NamelessI18n.setLanguage('en');
    const imported = new JSDOM(read('pages/wiki.html'));
    const main = d.importNode(imported.window.document.querySelector('main'), true);
    d.querySelector('main').replaceWith(main);
    imported.window.close();
    w.NamelessWikiPage.init(main);
    const warrior = main.querySelector('#page-guerrier');
    check(text(warrior.querySelector('h1')) === 'Warrior', 'Fresh SPA source nodes are translated before the English Wiki lifecycle consumes them');
    check(text(warrior.querySelector('.wiki-toc a')) === text(warrior.querySelector('.wiki-article-body h2')) && !text(warrior.querySelector('.wiki-toc')).includes('Compétences clés'), 'English SPA mount creates current-language TOC immediately');
    check(text(warrior.querySelector('.wiki-article-label')) === w.NamelessI18n.translate('Classes & Compétences'), 'English SPA mount creates translated category labels');
    check([...warrior.querySelectorAll('.wiki-related-links a')].every(link => text(link.querySelector('strong')) === text(main.querySelector('#page-' + link.dataset.page + ' h1'))), 'English SPA related guide titles match translated source articles');
    const search = main.querySelector('#wiki-search');
    search.value = 'key competencies'; search.dispatchEvent(new w.Event('input'));
    await pause(130);
    check(main.querySelector('#wiki-search-results [data-page="guerrier"]'), 'English SPA local index searches translated source headings');
    await pause(30);
    check(!text(warrior.querySelector('.wiki-toc')).includes('Compétences clés') && text(warrior.querySelector('.wiki-article-label')) === w.NamelessI18n.translate('Classes & Compétences'), 'Observer flushing cannot reintroduce stale French projection text');
    w.NamelessWikiPage.destroy();
    translationObservers.forEach(observer => observer.disconnect());
    dom.window.close();
}

console.log('Wiki codex DOM regressions: ' + checks + ' checks passed.');
