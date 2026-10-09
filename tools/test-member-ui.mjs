import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const source = (name) => fs.readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8');
const wait = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'Adventurer', role: 'admin', classe: 'Guerrier', niveau: 42, created_at: '2026-01-01T12:00:00Z' };
const activity = { id: '22222222-2222-4222-8222-222222222222', titre: 'Préparation', contenu: 'Potions', type: 'annonce', image_url: 'guild-activities/' + profile.id + '/image.png', created_at: '2026-01-01T12:00:00Z' };
const objective = { id: '33333333-3333-4333-8333-333333333333', titre: 'QA Préparation de la guilde', description: 'Fixture isolée du test membre', progression: 42, statut: 'en_cours' };
function page(name, profileData = profile) {
    const ownProfile = { ...profileData };
    const dom = new JSDOM(fs.readFileSync(new URL('../pages/' + name + '.html', import.meta.url), 'utf8'), {
        url: 'https://nameless-sao.fr/' + name, runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w = dom.window;
    w.alert = () => {};
    w.confirm = () => true;
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.currentUser = { id: ownProfile.id };
    w.namelessAuthReady = true;
    const writes = [];
    w.supabase = {
        rpc: async () => ({ data: 'admin', error: null }),
        from(table) {
            let single = false;
            const query = { select() { return this; }, eq() { return this; }, in() { return this; }, gte() { return this; }, lt() { return this; }, order() { return this; }, limit() { return this; },
                insert(payload) { writes.push({ table, payload }); return this; },
                update(payload) { writes.push({ table, payload }); if (table === 'user_profiles') Object.assign(ownProfile, payload); return this; },
                upsert(payload) { writes.push({ table, payload }); return this; },
                single() { single = true; return this; }, maybeSingle() { single = true; return this; },
                then(resolve) { return Promise.resolve({ data: table === 'user_profiles' ? (single ? ownProfile : [ownProfile]) : table === 'guild_activity_wall' && single ? activity : table === 'guild_objectives' ? [objective] : [], error: null }).then(resolve); }
            };
            return query;
        }
    };
    w.NamelessSecurity = {
        escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        resolveMediaUrl: async () => 'https://example.invalid/signed.png'
    };
    w.eval(source('guild-date-utils'));
    w.eval(source('cache-manager'));
    return { dom, w, writes };
}

{
    const { dom, w, writes } = page('espace-guilde');
    Object.defineProperty(w, 'innerWidth', { value: 390, writable: true });
    let scrollListeners = 0;
    const add = w.addEventListener.bind(w);
    w.addEventListener = (type, ...args) => { if (type === 'scroll') scrollListeners++; return add(type, ...args); };
    w.eval(source('navbar-mobile'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    for (let i = 0; i < 20; i++) w.dispatchEvent(new w.Event('resize'));
    assert.equal(scrollListeners, 1, 'resize must not accumulate scroll listeners');
    w.document.getElementById('hamburger').click();
    assert.equal(w.document.getElementById('hamburger').getAttribute('aria-expanded'), 'true');
    assert.equal(w.document.querySelector('main').inert, true);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(w.document.getElementById('hamburger').getAttribute('aria-expanded'), 'false');
    assert.equal(w.document.querySelector('main').inert, undefined);
    assert.equal(w.document.activeElement.id, 'hamburger');
    w.document.documentElement.lang = 'en';
    w.document.dispatchEvent(new w.Event('nameless:languagechange'));
    assert.equal(w.document.getElementById('hamburger').getAttribute('aria-label'), 'Open menu');
    w.document.getElementById('hamburger').click();
    assert.equal(w.document.getElementById('hamburger').getAttribute('aria-label'), 'Close menu');
    w.document.documentElement.lang = 'fr';
    w.document.dispatchEvent(new w.Event('nameless:languagechange'));
    assert.equal(w.document.getElementById('hamburger').getAttribute('aria-label'), 'Fermer le menu', 'Changing language preserves the open state');
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(w.document.getElementById('hamburger').getAttribute('aria-label'), 'Ouvrir le menu');
    w.document.activeElement.blur();
    Object.defineProperty(w, 'scrollY', {value: 200, writable: true});
    w.dispatchEvent(new w.Event('scroll'));
    assert.equal(w.document.querySelector('.header').classList.contains('hidden'), false, 'Mobile navigation remains available after scrolling away from focused controls');
    w.localStorage.setItem('guildeActiveTab', 'invalid');
    // The route now boots the actual headquarters module after the member gate.
    w.eval(source('guild-expeditions'));
    w.eval(source('espace-guilde'));
    await w.NamelessGuildPage.init();
    await wait();
    assert.equal(w.document.querySelector('.guild-hq-tab[aria-selected="true"]').dataset.hqTab, 'overview');
    const tabs = [...w.document.querySelectorAll('.guild-hq-tab')];
    assert.deepEqual(tabs.map(tab => tab.dataset.hqTab), ['overview', 'expeditions', 'members', 'resources', 'settings']);
    for (let next = 1; next < tabs.length; next++) {
        const event = new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        tabs[next - 1].dispatchEvent(event);
        assert.equal(event.defaultPrevented, true, 'headquarters owns its tab-list arrow navigation');
        assert.equal(w.document.activeElement, tabs[next], 'keyboard activation follows the current headquarters tabs');
        assert.equal(tabs[next].getAttribute('aria-selected'), 'true');
        assert.equal(tabs[next].tabIndex, 0);
        assert.equal(w.document.querySelectorAll('.guild-hq-tab[aria-selected="true"]').length, 1);
        assert.equal(w.document.getElementById(tabs[next].getAttribute('aria-controls')).hidden, false);
        assert.equal(w.document.querySelectorAll('[data-hq-panel]:not([hidden])').length, 1, 'inactive headquarters panels remain hidden');
    }
    w.document.querySelector('[data-hq-tab="resources"]').click();
    assert.equal(w.document.querySelector('#hq-resources #objectives-list [role="progressbar"]').getAttribute('aria-valuenow'), '42', 'the Resources panel preserves real objective progression');
    assert.equal(w.document.querySelector('#hq-resources .objective-progress-label strong').textContent, '42%');
    w.NamelessGuildPage.destroy();
    await w.NamelessGuildPage.init();
    assert.equal(w.document.querySelector('.guild-hq-tab[aria-selected="true"]').dataset.hqTab, 'overview', 'a fresh headquarters visit starts on its overview');
    const firstTab = w.document.querySelector('[data-hq-tab="overview"]');
    firstTab.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    assert.equal(w.document.activeElement.dataset.hqTab, 'expeditions', 'SPA reinitialization binds the current tabs once');
    w.document.querySelector('[data-hq-tab="settings"]').click();
    const presence = w.document.getElementById('mark-presence-btn');
    presence.click(); presence.click();
    await wait(0);
    assert.equal(writes.filter((entry) => entry.table === 'guild_presence').length, 1, 'rapid clicks must produce one atomic attendance write');
    assert.match(w.document.getElementById('presence-feedback').textContent, /enregistrée/);
    w.eval(source('profil'));
    w.eval(source('admin-dashboard'));
    assert.equal(w.formatDate, undefined, 'private page helpers must not collide across SPA routes');
    dom.window.close();
}
{
    const { dom, w, writes } = page('profil');
    w.eval(source('profil'));
    await w.NamelessProfilePage.init();
    await wait();
    const input = w.document.getElementById('profile-niveau');
    input.value = '2.5';
    w.document.getElementById('save-profile-btn').click();
    await wait(0);
    assert.equal(writes.length, 0, 'decimal level must be rejected');
    assert.match(w.document.getElementById('profile-feedback').textContent, /niveau/);
    input.value = '';
    w.document.getElementById('save-profile-btn').click();
    await wait(0);
    assert.equal(writes.length, 0, 'empty level must be rejected');
    input.value = '43';
    w.document.getElementById('save-profile-btn').click();
    await wait(0);
    assert.equal(writes[0].payload.niveau, 43);
    dom.window.close();
}
{
    const { dom, w, writes } = page('profil', { ...profile, classe: 'Paladin' });
    w.eval(source('profil'));
    await w.NamelessProfilePage.init();
    await wait();
    const select = w.document.getElementById('profile-classe');
    assert.equal(select.value, 'Paladin', 'existing class must remain selected');
    assert.equal(select.selectedOptions[0].textContent, 'Paladin');
    w.document.getElementById('profile-niveau').value = '50';
    w.document.getElementById('save-profile-btn').click();
    await wait(0);
    assert.equal(writes.length, 1, 'legacy class must allow a level edit');
    assert.equal(writes[0].payload.niveau, 50);
    assert.equal(Object.hasOwn(writes[0].payload, 'classe'), false, 'unchanged legacy class must be omitted from the payload');
    assert.equal(select.value, 'Paladin', 'level save must preserve the current class');
    const forged = w.document.createElement('option');
    forged.value = 'Chevalier'; forged.textContent = 'Chevalier'; select.appendChild(forged);
    select.value = 'Chevalier';
    w.document.getElementById('save-profile-btn').click();
    await wait(0);
    assert.equal(writes.length, 1, 'new unknown class injected into the select must be rejected');
    assert.match(w.document.getElementById('profile-feedback').textContent, /classe valide/);
    select.value = 'Mage';
    w.document.getElementById('save-profile-btn').click();
    await wait(0);
    assert.equal(writes.length, 2);
    assert.equal(writes[1].payload.classe, 'Mage', 'a known replacement class must be accepted');
    assert.equal(select.value, 'Mage');
    assert.equal(select.querySelector('[data-profile-current-class]'), null, 'legacy option must disappear after a known replacement');
    dom.window.close();
}
{
    const { dom, w, writes } = page('admin-dashboard');
    assert.equal(w.document.getElementById('role-modal').closest('main')?.id, 'main-content', 'SPA must import the role modal');
    w.eval(source('admin-dashboard'));
    await w.NamelessAdminDashboardPage.init();
    await wait();
    const edit = w.document.querySelector('.btn-edit');
    assert.ok(edit, 'administrator user row must render');
    edit.focus(); edit.click();
    assert.equal(w.document.getElementById('role-modal').getAttribute('aria-hidden'), 'false');
    assert.equal(w.document.activeElement.id, 'modal-role-select');
    const palette = w.document.createElement('dialog'); palette.open = true;
    const query = w.document.createElement('input'); palette.appendChild(query); w.document.body.appendChild(palette); query.focus();
    for (const key of ['Tab', 'Escape']) {
        const event = new w.KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}); query.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false, 'a native palette must own its keyboard handling');
        assert.equal(w.document.getElementById('role-modal').getAttribute('aria-hidden'), 'false', 'palette Escape must preserve the pending role edit');
    }
    palette.remove();
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(w.document.getElementById('role-modal').getAttribute('aria-hidden'), 'true');
    assert.equal(w.document.activeElement, edit, 'closing the modal must restore focus');
    w.document.getElementById('planning-titre').value = 'Raid';
    w.document.getElementById('planning-date').value = '2026-10-07T20:30';
    w.document.getElementById('add-planning-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await wait(0);
    assert.equal(writes.find((entry) => entry.table === 'guild_planning').payload.date_event, '2026-10-07T18:30:00.000Z');
    await w.editActivity(activity.id);
    await w.submitActivity();
    assert.equal(writes.find((entry) => entry.table === 'guild_activity_wall').payload.image_url, activity.image_url, 'editing text must preserve the existing image');
    dom.window.close();
}
{
    const { dom, w, writes } = page('espace-guilde');
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    const communications = { destroyed: 0, resumed: 0 };
    w.NamelessGuildChat = w.NamelessGuildDm = { destroy() { communications.destroyed++; }, init() { communications.resumed++; } };
    w.eval(source('guild-expeditions'));
    w.eval(source('espace-guilde'));
    await w.NamelessGuildPage.init();
    await wait();
    assert.ok(w.document.querySelector('#objectives-list [role="progressbar"]'));
    const dialog = w.document.getElementById('guild-event-dialog');
    const details = dialog.querySelector('[data-guild-dialog-content]');
    details.textContent = 'PRIVATE EVENT DETAILS';
    const privateInput = w.document.createElement('input'); details.appendChild(privateInput); dialog.showModal(); privateInput.focus();
    w.document.getElementById('chat-messages').textContent = 'PRIVATE CHAT DATA';
    w.document.getElementById('reply-to-author').textContent = 'PRIVATE REPLY AUTHOR';
    w.document.getElementById('reply-to-preview').textContent = 'PRIVATE REPLY CONTENT';
    w.document.getElementById('dm-recipient-name').textContent = 'PRIVATE RECIPIENT';
    w.currentUser = null;
    w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed', { detail: { user: null } }));
    assert.equal(w.document.getElementById('guilde-content').style.display, 'none', 'external sign out synchronously masks the protected headquarters');
    assert.equal(dialog.open, false, 'sign out immediately closes the event dialog');
    assert.equal(details.textContent, '', 'private event details are removed, not just hidden');
    assert.equal(w.document.getElementById('objectives-list').textContent, '');
    assert.equal(w.document.getElementById('chat-messages').textContent, '');
    assert.equal(w.document.getElementById('reply-to-author').textContent, '');
    assert.equal(w.document.getElementById('reply-to-preview').textContent, '');
    assert.equal(w.document.getElementById('dm-recipient-name').textContent, '');
    assert.equal(w.document.querySelector('[data-guild-members]').textContent, '');
    assert.equal(w.document.activeElement.getAttribute('href'), '/connexion', 'focus leaves the revoked private dialog for the public sign-in action');
    assert.equal(communications.destroyed, 2, 'both communication modules are torn down');
    let reads = 0;
    const from = w.supabase.from.bind(w.supabase);
    w.supabase.from = table => { reads++; return from(table); };
    w.currentUser = { id: '55555555-5555-4555-8555-555555555555' };
    w.supabase.rpc = async () => ({data:'joueur',error:null});
    w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed', {detail:{user:w.currentUser}}));
    await wait(250);
    assert.equal(reads, 0, 'a new account must pass the role gate before any private read');
    assert.equal(w.document.getElementById('guilde-content').style.display, 'none');
    w.document.getElementById('mark-presence-btn').click();await wait(0);
    assert.equal(writes.length, 0, 'a stale attendance control cannot write for a denied account');
    w.supabase.rpc = async () => ({data:'membre',error:null});
    w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed', {detail:{user:w.currentUser}}));
    await wait(250);
    assert.ok(reads > 0, 'a newly authorized actor reloads current guild data');
    assert.equal(w.document.getElementById('guilde-content').style.display, 'block');
    assert.equal(communications.resumed, 2, 'communication is restored only after the new member gate');
    w.NamelessGuildPage.destroy();
    const before = communications.destroyed;
    w.currentUser = null;
    w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed', {detail:{user:null}}));
    assert.equal(communications.destroyed, before, 'a destroyed route removes its auth listener');
    dom.window.close();
}
{
    const { dom, w } = page('espace-guilde');
    let releaseObjectives;
    const from = w.supabase.from.bind(w.supabase);
    w.supabase.from = table => {
        if (table !== 'guild_objectives') return from(table);
        const query = {select(){return this;},eq(){return this;},order(){return this;},then(resolve){return new Promise(release=>{releaseObjectives=release;}).then(resolve);}};
        return query;
    };
    w.eval(source('guild-expeditions'));w.eval(source('espace-guilde'));
    const pending = w.NamelessGuildPage.init();await wait();
    assert.equal(typeof releaseObjectives, 'function');
    w.currentUser = null;
    w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed', {detail:{user:null}}));
    releaseObjectives({data:[objective],error:null});await pending;await wait(0);
    assert.equal(w.document.getElementById('objectives-list').textContent, '', 'late private responses cannot repopulate the revoked DOM');
    const week = w.NamelessGuildDates.isoWeek(new Date());
    assert.equal(w.cacheManager.get('guild_objectives_'+week.year+'_'+week.week), null, 'late private responses cannot refill the cleared cache');
    w.NamelessGuildPage.destroy();dom.window.close();
}
{
    const { dom, w } = page('espace-guilde');
    let release;
    let queries = 0;
    w.supabase.rpc = () => new Promise((resolve) => { release = resolve; });
    w.supabase.from = () => { queries++; throw new Error('stale route query'); };
    w.eval(source('espace-guilde'));
    const pending = w.NamelessGuildPage.init();
    await wait();
    w.NamelessGuildPage.destroy();
    release({ data: 'admin', error: null });
    await pending;
    assert.equal(queries, 0, 'destroyed member route must not resume loading');
    dom.window.close();
}
console.log('PASS: mobile navigation, SPA namespaces/modal, keyboard tabs, profile validation, Paris event date, activity image preservation and stale lifecycle.');
