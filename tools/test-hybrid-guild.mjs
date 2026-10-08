import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 150));
const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'QA member', role: 'admin', classe: 'Guerrier', niveau: 40, created_at: '2026-01-01T12:00:00Z' };
const tables = {
    user_profiles: [profile],
    guild_planning: [{ titre: 'QA event <script>', date_event: '2026-10-10T18:00:00Z', type_event: 'raid', description: 'Prepare <potions>' }],
    guild_objectives: [{ titre: 'QA objective', description: 'Progress supplied by the database', progression: 150, statut: 'en_cours', semaine_numero: 41, annee: 2026 }],
    guild_presence: [], guild_activity_wall: []
};
function page(name, role = 'admin') {
    const dom = new JSDOM(read('pages/' + name + '.html'), { url: 'https://nameless-sao.fr/' + name, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.alert = () => {};
    w.confirm = () => true;
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.currentUser = { id: profile.id }; w.namelessAuthReady = true;
    const queries = []; const writes = [];
    w.supabase = {
        rpc: async () => ({ data: role, error: null }),
        from(table) {
            queries.push(table);
            let single = false;
            return {
                select() { return this; }, eq() { return this; }, in() { return this; }, gte() { return this; }, order() { return this; }, limit() { return this; },
                single() { single = true; return this; }, maybeSingle() { single = true; return this; },
                insert(payload) { writes.push({table, payload}); return this; }, upsert(payload) { writes.push({table, payload}); return this; },
                then(resolve) { const rows = tables[table] || []; return Promise.resolve({ data: single ? rows[0] : rows, error: null }).then(resolve); }
            };
        }
    };
    w.eval(read('js/guild-date-utils.js'));
    return {dom, w, queries, writes};
}

{
    const {dom, w, writes} = page('espace-guilde');
    w.eval(read('js/espace-guilde.js'));
    await w.NamelessGuildPage.init();
    await settle();
    assert.equal(w.document.querySelector('h1').textContent, 'Quartier général');
    assert.equal(w.document.querySelector('.guilde-two-columns').firstElementChild.className, 'guilde-right-column', 'DOM order must lead with the working tabs on mobile and for screen readers');
    const event = w.document.querySelector('.planning-item');
    assert.equal(event.querySelector('h3').textContent, tables.guild_planning[0].titre, 'titles must remain escaped text');
    assert.equal(event.querySelector('script'), null);
    assert.match(event.querySelector('.item-date').textContent, /20:00/, 'the existing Paris event time remains in the UI');
    const objective = w.document.querySelector('[role="progressbar"]');
    assert.equal(objective.getAttribute('aria-valuenow'), '100', 'numeric progression keeps the existing clamp and now exposes it to assistive technology');
    assert.equal(w.document.querySelector('.objective-progress-label strong').textContent, '100%');
    assert.equal(w.document.querySelector('.progress-fill').textContent, '', 'the progress value must remain readable even at a narrow or zero fill');
    assert.deepEqual([...w.document.querySelectorAll('.guild-resource-links a')].map(a => a.getAttribute('href')), ['/carte', '/wiki', '/items']);
    assert.equal(w.document.getElementById('chat-toggle-btn').getAttribute('aria-controls'), 'guild-chat');
    assert.ok(w.document.getElementById('chat-send-btn').querySelector('svg'));
    assert.equal(writes.length, 0, 'the headquarters must not create events or attendance merely by opening');
    w.NamelessGuildPage.destroy(); dom.window.close();
}
{
    const {dom, w, queries} = page('espace-guilde', 'joueur');
    w.eval(read('js/espace-guilde.js'));
    await w.NamelessGuildPage.init();
    await settle();
    assert.equal(w.document.getElementById('guilde-content').style.display, 'none');
    assert.equal(w.document.getElementById('access-denied').style.display, 'block');
    assert.deepEqual(queries, [], 'presentation changes must preserve the membership gate before any guild read');
    assert.equal(w.document.querySelector('h1').textContent, 'Quartier général', 'denied visitors still have page context');
    dom.window.close();
}
{
    const {dom, w, writes} = page('admin-dashboard');
    assert.ok([...w.document.querySelectorAll('.stat-number')].every(el => el.textContent === '—'), 'pending counts must not imply zero real users');
    w.eval(read('js/admin-dashboard.js'));
    await w.NamelessAdminDashboardPage.init();
    await settle();
    const sort = w.document.querySelector('th[data-sort="username"] .sort-button');
    assert.equal(sort.type, 'button', 'column sorting needs a native keyboard-activatable control');
    sort.focus(); sort.click();
    assert.equal(sort.closest('th').getAttribute('aria-sort'), 'ascending');
    sort.click();
    assert.equal(sort.closest('th').getAttribute('aria-sort'), 'descending');
    assert.equal(w.document.querySelectorAll('th[aria-sort="descending"]').length, 1);
    assert.equal(w.document.activeElement, sort, 'sorting must preserve the focused column control');
    for (const selector of ['.users-table', '.presence-table']) {
        const region = w.document.querySelector(selector);
        assert.equal(region.tabIndex, 0, 'overflowing tables must be keyboard-scrollable');
        assert.ok(region.getAttribute('aria-label'));
    }
    w.document.getElementById('admin-tab-guild').click();
    w.document.getElementById('tab-objectives').click();
    await settle();
    assert.equal(w.document.getElementById('guild-planning-tab').classList.contains('active'), false, 'inactive administration forms must disappear when changing tabs');
    assert.equal(w.document.getElementById('guild-objectives-tab').classList.contains('active'), true);
    assert.equal(w.document.querySelectorAll('.guild-tab[aria-selected="true"]').length, 1, 'one management tab owns selection and keyboard focus');
    assert.equal(w.document.querySelector('#admin-objectives-list [role="progressbar"]').getAttribute('aria-valuenow'), '100');
    assert.equal(writes.length, 0);
    w.NamelessAdminDashboardPage.destroy(); dom.window.close();
}
{
    const dom = new JSDOM(read('pages/profil.html'));
    const d = dom.window.document;
    const character = d.querySelector('.profile-character');
    assert.ok(character.contains(d.getElementById('profile-classe')) && character.contains(d.getElementById('profile-niveau')) && character.contains(d.getElementById('save-profile-btn')));
    assert.equal(character.contains(d.getElementById('profile-minecraft-uuid')), false, 'identity data and editable character fields must have separate context');
    assert.deepEqual([...d.getElementById('profile-classe').options].map(o => o.value), ['Shaman', 'Mage', 'Assassin', 'Guerrier', 'Archer']);
    assert.equal(d.getElementById('profile-niveau').max, '100');
    assert.equal(d.getElementById('minecraft-link-form').querySelector('label').htmlFor, 'minecraft-username-input');
    dom.window.close();
}

// Once imported by the SPA these styles must stop matching controls on other routes.
for (const file of ['guilde', 'guilde-nameless', 'profil', 'admin-dashboard', 'activity-wall', 'guild-chat', 'guild-dm']) {
    const dom = new JSDOM('<style>' + read('css/components/' + file + '.css') + '</style><main class="home-page"><button class="action-btn btn-edit guild-tab tab-btn">Other route</button><div class="modal"><input class="search-input"></div></main>');
    const sheet = dom.window.document.styleSheets[0];
    assert.ok(sheet?.cssRules.length, file + ' must remain valid CSS');
    function visit(rules) {
        for (const rule of rules) {
            if (rule.type === 1) {
                assert.match(rule.selectorText, /guilde-container|profil-container|profil-page|dashboard-container/, file + ' styles must belong to a route');
                for (const el of dom.window.document.querySelectorAll('button, input, .modal')) assert.equal(el.matches(rule.selectorText), false, file + ' must not contaminate another SPA page');
            } else if (rule.type === 4) visit(rule.cssRules);
        }
    }
    visit(sheet.cssRules); dom.window.close();
}
console.log('PASS: headquarters context and real data rendering, membership gate, accessible progress/sorting, profile edit fields and inactive SPA route styles.');
