// Isolated DOM fixtures only. This never connects to or writes to Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 140));
const id = '11111111-1111-4111-8111-111111111111';
let checks = 0;
function eq(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
function ok(value, message) { assert.ok(value, message); checks++; }
function page({ role = 'membre', user = true, event = false, planningError = false } = {}) {
    const dom = new JSDOM(read('pages/espace-guilde.html'), { url: 'https://nameless-sao.fr/espace-guilde', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.currentUser = user ? { id } : null; w.namelessAuthReady = true;
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button')?.focus(); };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    w.matchMedia = () => ({ matches: true });
    let language = 'fr';
    let failPlanning = planningError;
    w.NamelessI18n = { getLanguage: () => language, getLocale: () => language === 'en' ? 'en-GB' : 'fr-FR', translate: text => language === 'en' ? w.NamelessTranslations?.en?.[text] || text : text, apply: () => {} };
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 1); date.setUTCHours(18, 0, 0, 0);
    const tables = {
        guild_planning: event ? [{ id: '55555555-5555-4555-8555-555555555555', titre: 'QA <script> expedition', description: 'QA real record', date_event: date.toISOString(), type_event: 'raid', status: 'open' }] : [],
        user_profiles: [], guild_objectives: [], guild_presence: [], guild_activity_wall: [], guild_event_attendance: [], guild_event_checklist: [], guild_event_checks: []
    };
    const reads = [], writes = [];
    w.supabase = {
        rpc: async name => ({ data: name === 'current_user_role' ? role : null, error: null }),
        from(table) {
            reads.push(table); const filters = []; let limit = null;
            return {
                select() { return this; }, order() { return this; }, limit(value) { limit = value; return this; },
                eq(key, value) { filters.push(row => row[key] === value); return this; }, in(key, values) { filters.push(row => values.includes(row[key])); return this; },
                gte(key, value) { filters.push(row => row[key] >= value); return this; }, lt(key, value) { filters.push(row => row[key] < value); return this; },
                upsert(payload) { writes.push({ table, payload }); return this; },
                then(resolve) { let data = tables[table].filter(row => filters.every(filter => filter(row))); if (limit != null) data = data.slice(0, limit); return Promise.resolve({ data, error: table === 'guild_planning' && failPlanning ? { code: 'QA_LOAD_FAILED' } : null }).then(resolve); }
            };
        }
    };
    w.eval(read('js/guild-date-utils.js')); w.eval(read('js/guild-expeditions.js')); w.eval(read('js/espace-guilde.js'));
    return { dom, w, tables, reads, writes, setPlanningError(value) { failPlanning = value; }, setLanguage(value) { language = value; w.document.dispatchEvent(new w.Event('nameless:languagechange')); } };
}
async function ready(p) { await p.w.NamelessGuildPage.init(); await tick(); }
function close(p) { p.w.NamelessGuildPage.destroy(); p.dom.window.close(); }
{
    const p = page({ user: false }); await ready(p);
    eq(p.w.document.getElementById('guilde-content').style.display, 'none', 'Guests do not receive private panels');
    eq(p.w.document.getElementById('access-denied').style.display, 'block');
    eq(p.w.document.querySelector('[data-guild-gate-login]').hidden, false);
    eq(p.w.document.querySelector('[data-guild-gate-profile]').hidden, true);
    eq(p.reads.length, 0, 'Public gate never reads private tables');
    eq(p.writes.length, 0);
    close(p);
}
{
    const p = page({ role: 'joueur' }); await ready(p);
    eq(p.w.document.querySelector('[data-guild-gate-login]').hidden, true, 'Signed-in nonmembers are not sent to sign in again');
    eq(p.w.document.querySelector('[data-guild-gate-profile]').hidden, false);
    ok(p.w.document.querySelector('[data-guild-gate-hint]').textContent.includes('Discord'));
    eq(p.reads.length, 0, 'Membership gate still precedes private data');
    close(p);
}
{
    const p = page(); await ready(p); const d = p.w.document;
    eq(d.getElementById('guilde-content').style.display, 'block');
    eq(d.querySelectorAll('.guilde-right-column > .hq-panel').length, 3, 'Main column owns expeditions, announcements and navigation');
    eq(d.querySelectorAll('.guild-side-column > .hq-panel').length, 3, 'Calendar and directory size independently of the main column');
    eq(d.querySelector('[data-guild-create]').hidden, true);
    ok([...d.querySelectorAll('[data-guild-admin]')].every(node => node.hidden), 'Members never receive administration links');
    eq(d.querySelector('#planning-list .hq-empty-action').getAttribute('href'), '/wiki');
    ok(d.querySelector('#planning-list .hq-empty svg'), 'No scenery stands in for an unpublished expedition');
    eq(d.querySelector('#activity-wall-content .hq-empty strong').textContent, 'Aucune annonce publiée');
    eq(d.querySelector('#activity-wall-content .hq-empty-action').getAttribute('href'), '/wiki');
    eq(d.querySelector('#hq-objective-preview .hq-empty strong').textContent, 'Aucun objectif cette semaine');
    eq(d.querySelector('#hq-objective-preview .hq-empty-action').getAttribute('href'), '/wiki');
    eq(d.querySelectorAll('.hq-event,.hq-member,.activity-post').length, 0, 'Empty records never create fictional activity');
    eq(d.querySelectorAll('#hq-calendar button').length, 0, 'Days without records never imply events');
    ok(d.querySelector('#hq-calendar-note svg'));
    eq(d.querySelectorAll('main img[src*="emblem"]').length, 0, 'No repeated guild logos in panels');
    eq(p.writes.length, 0, 'Opening the headquarters performs no writes');
    d.querySelector('.hq-attendance-link').click();
    eq(d.querySelector('[data-hq-tab="settings"]').getAttribute('aria-selected'), 'true');
    eq(d.querySelector('#presence-list .hq-empty strong').textContent, 'Aucune présence renseignée');
    d.querySelector('[data-hq-tab="expeditions"]').click();
    const search = d.querySelector('[data-guild-event-search]'); search.value = 'Absent'; search.dispatchEvent(new p.w.Event('input'));
    eq(d.querySelector('[data-guild-events="all"] .hq-empty-action').textContent, 'Effacer les filtres');
    d.querySelector('[data-guild-events="all"] .hq-empty-action').click();
    eq(search.value, ''); eq(d.activeElement, search, 'Clearing filters returns focus to the search');
    p.setLanguage('en'); await tick();
    eq(d.querySelector('#activity-wall-content .hq-empty strong').textContent, 'No announcements published');
    eq(d.querySelector('#hq-objective-preview .hq-empty strong').textContent, 'No objectives this week');
    eq(d.querySelector('#presence-list .hq-empty strong').textContent, 'No attendance recorded');
    eq(d.querySelector('#planning-list .hq-empty-action').textContent, 'Read the guide');
    p.w.currentUser = null; d.dispatchEvent(new p.w.CustomEvent('nameless:auth-changed', { detail: { user: null } }));
    eq(d.getElementById('guilde-content').style.display, 'none');
    eq(d.querySelector('#activity-wall-content').children.length, 0, 'Logout clears rendered private records');
    eq(d.querySelector('[data-guild-gate-login]').hidden, false);
    close(p);
}
{
    const p = page({ role: 'admin' }); await ready(p); const d = p.w.document;
    eq(d.querySelector('[data-guild-create]').hidden, false);
    eq(d.querySelector('[data-guild-admin]:not([data-guild-announcement-admin]):not([data-guild-objectives-admin])').hidden, false);
    eq(d.querySelector('[data-guild-announcement-admin]').hidden, true, 'Empty announcements use a single administration CTA');
    eq(d.querySelector('[data-guild-objectives-admin]').hidden, true, 'Empty objectives use a single administration CTA');
    eq(d.querySelector('#activity-wall-content .hq-empty-action').getAttribute('href'), '/admin-dashboard');
    eq(d.querySelector('#activity-wall-content .hq-empty-action').textContent, 'Ouvrir l’administration', 'The link does not promise a specific administration tab');
    eq(d.querySelector('#hq-objective-preview .hq-empty-action').getAttribute('href'), '/admin-dashboard');
    d.querySelector('#planning-list .hq-empty-action').click();
    eq(d.querySelector('dialog').open, true);
    ok(d.querySelector('dialog [data-create-form]'), 'Admin empty CTA opens the existing persisted creation form');
    eq(p.writes.length, 0, 'Opening a creation form does not publish anything');
    close(p);
}
{
    const p = page({ role: 'admin' }); const week = p.w.NamelessGuildDates.isoWeek(new Date());
    p.tables.guild_activity_wall.push({ titre: 'QA published news', contenu: 'QA actual fixture', created_at: new Date().toISOString(), type: 'annonce' });
    p.tables.guild_objectives.push({ titre: 'QA weekly objective', progression: 25, statut: 'en_cours', semaine_numero: week.week, annee: week.year });
    await ready(p); const d = p.w.document;
    eq(d.querySelector('[data-guild-announcement-admin]').hidden, false, 'Published announcements keep their administration link');
    eq(d.querySelector('[data-guild-objectives-admin]').hidden, false, 'Defined objectives keep their administration link');
    eq(d.querySelector('#activity-wall-content .hq-empty-action'), null, 'Published news has no duplicate empty-state CTA');
    eq(d.querySelector('#objectives-list .hq-empty-action'), null);
    close(p);
}
{
    const p = page({ role: 'admin', planningError: true }); await ready(p); const d = p.w.document;
    const upcoming = () => d.querySelector('#planning-list .hq-empty');
    ok(upcoming().querySelector('strong').textContent.includes('n’a pas pu être chargé'), 'Failure is not an empty published schedule');
    eq(upcoming().querySelector('.hq-empty-action').textContent, 'Réessayer');
    eq(d.querySelector('[data-guild-create]').hidden, true, 'A failed schedule read never proposes event creation');
    d.querySelector('[data-guild-event-search]').value = 'QA';
    d.querySelector('[data-guild-event-search]').dispatchEvent(new p.w.Event('input'));
    eq(d.querySelector('[data-guild-events="all"] .hq-empty-action').textContent, 'Réessayer', 'Filters do not replace the failure state');
    d.querySelector('[data-calendar-offset="1"]').click(); await tick();
    eq(upcoming().querySelector('.hq-empty-action').textContent, 'Réessayer', 'Loading another calendar month does not erase the failed schedule read');
    p.setLanguage('en'); await tick();
    eq(upcoming().querySelector('.hq-empty-action').textContent, 'Try again');
    ok(upcoming().querySelector('strong').textContent.includes('could not be loaded'), 'Failure survives a language switch');
    p.setPlanningError(false); upcoming().querySelector('.hq-empty-action').click(); await tick();
    eq(upcoming().querySelector('.hq-empty-action').textContent, 'Create expedition', 'A successful retry returns the actual empty schedule state');
    eq(d.querySelector('[data-guild-create]').hidden, false);
    eq(p.writes.length, 0);
    close(p);
}
{
    const p = page({ event: true }); await ready(p); const d = p.w.document;
    const card = d.querySelector('#planning-list .hq-event');
    eq(card.querySelector('strong').textContent, p.tables.guild_planning[0].titre, 'Record titles stay text, not markup');
    eq(card.querySelectorAll('script,img').length, 0);
    ok(card.querySelector('.hq-event-art svg'), 'Real event type uses a sober SVG icon');
    const expectedTime = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(p.tables.guild_planning[0].date_event));
    ok(card.querySelector('.item-date').textContent.includes(expectedTime), 'Existing Paris date formatting is preserved');
    const month = d.getElementById('hq-month-label').textContent;
    d.querySelector('[data-calendar-offset="1"]').click(); await tick();
    ok(d.getElementById('hq-month-label').textContent !== month, 'Month navigation still loads the chosen month');
    d.querySelector('[data-hq-tab="overview"]').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    eq(d.querySelector('[data-hq-tab="expeditions"]').getAttribute('aria-selected'), 'true', 'Keyboard tab navigation remains native');
    eq(p.writes.length, 0);
    close(p);
}
console.log(`PASS: Phase D guild ${checks} DOM checks (public/member/admin gates, empty states, FR/EN, real date and navigation, no automatic writes).`);
