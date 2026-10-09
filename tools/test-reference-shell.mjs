import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<header class="header"><nav class="nav-container"><img class="nav-logo-safe"><button id="hamburger" aria-controls="nav-menu" aria-expanded="false">Menu</button><div class="nav-connexion"><a id="login-link" href="/connexion">Connexion</a></div></nav></header><main><button data-home-motion aria-pressed="false">Pause</button><button class="nm-audio-btn" aria-pressed="false">Audio</button></main>`, { url: 'https://nameless-sao.fr/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
let language = 'fr', user = { id: 'test-member' }, role = 'membre', privateReads = 0, pendingAccount;
w.innerWidth = 1920;
w.NamelessI18n = { getLanguage: () => language };
w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button').focus(); };
w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
w.supabase = {
    auth: { getUser: () => pendingAccount || Promise.resolve({ data: { user } }) },
    rpc: async () => ({ data: role }),
    from: table => {
        assert.equal(table, 'guild_activity_wall');
        privateReads++;
        return { select: () => ({ order: () => ({ limit: async () => ({ data: [{ titre: 'Annonce réelle <script>', contenu: 'Préparation des membres', created_at: '2026-10-09T10:00:00Z' }] }) }) }) };
    }
};
for (const target of d.querySelectorAll('[data-home-motion], .nm-audio-btn')) target.addEventListener('click', () => target.setAttribute('aria-pressed', String(target.getAttribute('aria-pressed') !== 'true')));
w.eval(fs.readFileSync(new URL('../js/reference-shell.js', import.meta.url), 'utf8'));
d.dispatchEvent(new w.Event('DOMContentLoaded'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const burger = d.querySelector('#hamburger');
const navigation = d.createElement('ul'); navigation.className = 'nav-menu';
const explorer = d.createElement('a'); explorer.href = 'https://nameless-sao.fr/wiki'; explorer.textContent = 'Explorer'; navigation.appendChild(explorer);
navigation.getBoundingClientRect = () => ({ left: 120, width: 600 });
explorer.getBoundingClientRect = () => ({ left: 120, width: 90 });
d.querySelector('.nav-container').appendChild(navigation); w.NamelessReferenceShell.upgrade();
await new Promise(resolve => setTimeout(resolve, 25));
assert.equal(navigation.dataset.referenceIndicator, 'true', 'The homepage indicator accepts router-normalized absolute links');
assert.equal(navigation.style.getPropertyValue('--reference-nav-width'), '90px');
// Exit animations keep focus inside until completion, and stale completions
// cannot hide a newly selected record or return focus to its old card.
const panel = d.createElement('div'); panel.dataset.panelMode = 'rail'; d.body.appendChild(panel);
let resolveExit, cancellations = 0, finishes = 0;
panel.animate = () => ({ finished: new Promise(resolve => { resolveExit = resolve; }), cancel: () => { cancellations++; } });
w.NamelessReferenceShell.closePanel(panel, () => { finishes++; });
assert.equal(panel.dataset.referenceClosing, 'true');
assert.equal(finishes, 0);
w.NamelessReferenceShell.cancelPanelClose(panel);
resolveExit(); await tick();
assert.equal(finishes, 0, 'A cancelled exit never hides the replacement panel');
assert.equal(cancellations, 1);
w.NamelessReferenceShell.closePanel(panel, () => { finishes++; });
resolveExit(); await tick();
assert.equal(finishes, 1);
assert.equal(panel.hasAttribute('data-reference-closing'), false);
w.matchMedia = () => ({ matches: true });
w.NamelessReferenceShell.closePanel(panel, () => { finishes++; });
assert.equal(finishes, 2, 'Reduced motion closes immediately');
w.matchMedia = () => ({ matches: false });
w.NamelessReferenceShell.closePanel(panel, () => { finishes++; });
panel.remove(); resolveExit(); await tick();
assert.equal(finishes, 2, 'A route-unmounted panel cannot steal the new route focus');
burger.click();
const menu = d.querySelector('#reference-navigation');
assert.equal(menu.open, true);
assert.equal(burger.getAttribute('aria-controls'), menu.id);
assert.equal(burger.getAttribute('aria-expanded'), 'true');
for (const action of ['motion', 'audio']) {
    const before = menu.querySelector(`[data-reference-action="${action}"]`);
    before.focus(); before.click();
    assert.notEqual(d.activeElement, before, 'A replaced button is never the active element');
    assert.equal(d.activeElement.dataset.referenceAction, action, 'Re-render retains keyboard focus');
}
language = 'en'; d.dispatchEvent(new w.Event('nameless:languagechange'));
assert.equal(d.activeElement.dataset.referenceAction, 'audio');
assert.equal(menu.querySelector('.reference-dialog-close').getAttribute('aria-label'), 'Close');
menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
assert.equal(menu.open, false);
assert.equal(d.activeElement, burger);
assert.equal(burger.getAttribute('aria-expanded'), 'false');
w.innerWidth = 390; w.dispatchEvent(new w.Event('resize'));
assert.equal(burger.getAttribute('aria-controls'), 'nav-menu');
burger.click(); assert.equal(menu.open, false, 'Mobile remains owned by the existing navigation controller');

const bell = d.querySelector('.reference-notifications-trigger');
bell.click(); await tick(); await tick();
const announcements = d.querySelector('.reference-notification-list');
assert.match(announcements.textContent, /Annonce réelle <script>/);
assert.match(announcements.textContent, /Préparation des membres/);
assert.equal(announcements.querySelector('script'), null, 'Server text is rendered as text');
assert.equal(privateReads, 1, 'The genuine membre role is accepted');
user = null; d.dispatchEvent(new w.Event('nameless:auth-changed')); await tick();
assert.doesNotMatch(d.querySelector('.reference-notification-list').textContent, /Préparation des membres/);
assert.match(d.querySelector('.reference-notification-list').textContent, /Sign in/);
assert.equal(privateReads, 1, 'Anonymous users never read the private wall');
user = { id: 'visitor' }; role = 'visiteur'; d.dispatchEvent(new w.Event('nameless:auth-changed')); await tick(); await tick();
assert.equal(privateReads, 1, 'Non-members never read the private wall');
let release;
pendingAccount = new Promise(resolve => { release = resolve; });
d.dispatchEvent(new w.Event('nameless:auth-changed'));
pendingAccount = null; user = null; d.dispatchEvent(new w.Event('nameless:auth-changed')); await tick();
release({ data: { user: { id: 'stale-member' } } }); await tick(); await tick();
assert.equal(privateReads, 1, 'A stale session response cannot restore private announcements');
dom.window.close();
console.log('Reference shell passed: member announcements, private gates, safe text, stale sessions, menu focus/ARIA, language, mobile ownership and cancellable/reduced-motion panel exits.');
