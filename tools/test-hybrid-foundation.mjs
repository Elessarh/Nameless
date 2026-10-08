import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tokens = read('css/tokens.css');
const styles = read('css/style.css');
const color = name => {
    const match = tokens.match(new RegExp('--nm-' + name + ':\\s*(#[A-Fa-f0-9]{6})\\s*;'));
    assert.ok(match, 'Central color token ' + name);
    return match[1];
};
function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map(value => {
        const channel = parseInt(value, 16) / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (const foreground of ['text', 'text-secondary', 'gold-light', 'link']) {
    for (const surface of ['bg', 'bg-secondary', 'surface', 'surface-raised']) {
        assert.ok(contrast(color(foreground), color(surface)) >= 4.5, `${foreground} on ${surface} passes normal text AA`);
    }
}
assert.ok(contrast(color('bg'), color('gold')) >= 4.5, 'Selected buttons use dark text on gold');
assert.ok(contrast(color('border-control'), color('bg')) >= 3, 'Form boundaries remain distinguishable');
assert.ok(contrast(color('gold-light'), color('surface-raised')) >= 3, 'Focus and selected states remain distinguishable');
assert.ok(!styles.includes('--sao-gold:'), 'Theme values have one central source');
assert.ok(styles.includes('padding-top: var(--nm-header-height)'), 'Body and header use the same height');
assert.ok(styles.includes('grid-template-areas: "logo search actions menu"'), 'Mobile search has a defined grid area');
assert.ok(!/\.nav-menu a:hover\s*\{[^}]*padding/.test(styles), 'Hover does not move navigation items');
assert.ok(!/animation:[^;]+infinite/.test(styles), 'Shared shell has no perpetual animation');
assert.ok(tokens.includes('prefers-reduced-motion'), 'Motion durations respect user preference');
for (const file of ['index.html', '404.html', ...fs.readdirSync(path.join(root, 'pages')).filter(file => file.endsWith('.html')).map(file => 'pages/' + file)]) {
    const document = new JSDOM(read(file)).window.document;
    const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
    const tokenIndex = links.findIndex(link => link.getAttribute('href').includes('css/tokens.css'));
    const styleIndex = links.findIndex(link => link.getAttribute('href').includes('css/style.css'));
    assert.ok(tokenIndex >= 0 && tokenIndex < styleIndex, file + ' loads tokens before shared styles');
    assert.ok(document.querySelector('.nav-wordmark'), file + ' retains a visible real wordmark');
    assert.equal(document.querySelector('meta[name="theme-color"]')?.content, color('bg'), file + ' uses the shared browser theme');
    assert.ok(!document.querySelector('.nav-menu a[href="/quetes"]'), file + ' does not advertise obsolete main quests');
}

const dom = new JSDOM('<nav class="nav-container"><button id="hamburger">Menu</button></nav>', {url:'https://nameless-sao.fr/', runScripts:'outside-only'});
const {window} = dom;
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
let requests = 0;
window.fetch = async () => { requests++; return {ok:true, json:async () => ({version:1, entries:[
    {kind:'boss', id:'illfang', title:'Illfang', url:'/boss/illfang', image:'/assets/brand/boss-illfang.webp'},
    {kind:'item', id:'potion', title:'Potion', url:'/items?item=potion', image:'https://example.com/tracker.png'},
    {kind:'npc', id:'archive', title:'Archive', url:'/quetes?guide=archive', status:'historical-unverified'}
]})}; };
window.eval(read('js/global-search.js'));
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
assert.equal(requests, 0, 'Index is loaded only when needed');
const trigger = window.document.querySelector('.nm-search-trigger');
assert.equal(trigger.querySelector('kbd').textContent, 'Ctrl K', 'Desktop shortcut is visible');
trigger.focus(); trigger.click();
await window.NamelessGlobalSearch.getIndex(); await Promise.resolve();
const input = window.document.getElementById('nm-global-query');
input.value = 'Illfang'; input.dispatchEvent(new window.Event('input'));
assert.equal(window.document.querySelector('.nm-search-thumbnail').getAttribute('src'), '/assets/brand/boss-illfang.webp', 'Real local artwork accompanies a result');
assert.equal(window.document.querySelector('.nm-search-group-count').textContent, '1', 'Category count derives from displayed results');
input.value = 'Potion'; input.dispatchEvent(new window.Event('input'));
assert.ok(!window.document.querySelector('.nm-search-thumbnail'), 'Remote result artwork is rejected');
input.value = 'Archive'; input.dispatchEvent(new window.Event('input'));
assert.ok(window.document.querySelector('.nm-search-result').textContent.includes('Archive secondaire non vérifiée'), 'Historical results carry an explicit status');
input.dispatchEvent(new window.KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
assert.equal(window.document.activeElement.tagName, 'A', 'Keyboard moves into a real result');
window.document.querySelector('.nm-search-star').click();
assert.deepEqual(JSON.parse(window.localStorage.getItem('nameless-public-favorites-v1')), ['npc:archive'], 'Favorites retain their public identity');
window.document.querySelector('.nm-search-close').click();
assert.equal(window.document.activeElement, trigger, 'Closing restores keyboard focus');
dom.window.close();
console.log('Hybrid foundations passed: shared palette AA contrast, form/focus contrast, shell contracts, lazy search, actual counts, image restrictions, archive status, keyboard and favorites.');
