import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
const saved = { id: '11111111-1111-4111-8111-111111111111', username: 'Adventurer', minecraft_username: 'Adventurer', minecraft_uuid: '11111111111141118111111111111111', role: 'membre', classe: 'Guerrier', niveau: 42, created_at: '2026-01-01T12:00:00Z' };
async function surface(profile = saved, options = {}) {
    const dom = new JSDOM(read('pages/profil.html'), { url: 'https://nameless-sao.fr/profil', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, d = w.document;
    if (d.readyState === 'loading') await new Promise(resolve => d.addEventListener('DOMContentLoaded', resolve, { once: true }));
    let record = { ...profile };
    let language = 'fr';
    const writes = [];
    w.currentUser = options.public ? null : { id: saved.id };
    w.namelessAuthReady = true;
    w.NamelessI18n = { getLanguage: () => language, getLocale: () => language === 'en' ? 'en-GB' : 'fr-FR', translate: x => x };
    w.supabase = {
        from(table) {
            let payload = null;
            return {
                select() { return this; }, eq() { return this; }, single() { return this; }, maybeSingle() { return this; },
                update(value) { payload = value; writes.push({ table, payload: value }); return this; },
                then(resolve) {
                    if (options.error) return Promise.resolve({ data: null, error: { code: 'read_failure' } }).then(resolve);
                    if (payload) record = { ...record, ...payload };
                    return Promise.resolve({ data: { ...record }, error: null }).then(resolve);
                }
            };
        }
    };
    w.eval(read('js/profil.js'));
    await w.NamelessProfilePage.init();
    return { dom, w, d, writes, language(value) { language = value; d.documentElement.lang = value; d.dispatchEvent(new w.Event('nameless:languagechange')); } };
}
{
    const { dom, w, d, writes, language } = await surface();
    check(d.getElementById('profil-content').style.display === 'block', 'An authenticated character sheet is visible');
    check(d.querySelector('.player-card').contains(d.getElementById('mc-avatar-img')), 'The native avatar belongs to the primary identity panel');
    check(d.getElementById('mc-avatar-img').src === 'https://mc-heads.net/avatar/' + saved.minecraft_uuid + '/128', 'The avatar still uses the real public Minecraft UUID');
    check(d.getElementById('profile-avatar-empty').style.display === 'none', 'A linked avatar does not display a placeholder');
    check(d.getElementById('mc-display-name').textContent === saved.minecraft_username, 'A saved Minecraft username is prominent');
    check(d.getElementById('profile-class-summary').textContent === 'Guerrier' && d.getElementById('profile-level-summary').textContent === '42', 'The character summary uses saved class and level');
    check(d.getElementById('profile-account').open === false, 'Account identifiers start in a closed native disclosure');
    check(d.getElementById('profile-account').contains(d.getElementById('profile-minecraft-uuid')), 'UUID is secondary account information');
    check(!d.querySelector('.profile-character').contains(d.getElementById('profile-minecraft-uuid')), 'The character editor has no account identifiers');
    check(d.getElementById('profile-minecraft-uuid').textContent === saved.minecraft_uuid, 'UUID text is complete');
    check(d.getElementById('guilde-btn').style.display === 'flex' && d.getElementById('dashboard-btn').style.display === 'none', 'Member tools respect role gates');
    d.getElementById('profile-account-link').click();
    check(d.getElementById('profile-account').open, 'Account settings opens its disclosure');
    const select = d.getElementById('profile-classe'), level = d.getElementById('profile-niveau');
    select.value = 'Mage'; level.value = '51'; level.focus();
    language('en');
    check(select.value === 'Mage' && level.value === '51', 'Changing language preserves unsaved fields');
    check(d.activeElement === level, 'Changing language preserves focus');
    check(d.getElementById('profile-class-summary').textContent === 'Warrior' && d.getElementById('profile-level-summary').textContent === '42', 'The translated summary still shows saved values');
    check(d.querySelector('.profil-hero h1').textContent === 'My profile' && d.getElementById('profile-role').textContent === 'Member', 'New route labels and role switch to English');
    check(d.getElementById('profile-minecraft-state').textContent === 'Minecraft detected', 'Account state switches to English');
    level.value = '2.5'; d.getElementById('save-profile-btn').click(); await pause();
    check(writes.length === 0 && level.getAttribute('aria-invalid') === 'true', 'Decimal levels are rejected and the field is flagged');
    check(d.activeElement === level && /whole-number/.test(d.getElementById('profile-feedback').textContent), 'Validation is announced in the active language and focuses the field');
    language('fr');
    check(/niveau/.test(d.getElementById('profile-feedback').textContent), 'Existing validation feedback translates back to French');
    level.value = '51'; d.getElementById('save-profile-btn').click(); d.getElementById('save-profile-btn').click();
    await pause(); await pause();
    check(writes.length === 1 && writes[0].payload.niveau === 51 && writes[0].payload.classe === 'Mage', 'A rapid double-click saves one valid profile update');
    check(d.getElementById('profile-class-summary').textContent === 'Mage' && d.getElementById('profile-level-summary').textContent === '51', 'Successful saving updates the recorded character summary');
    check(!d.getElementById('save-profile-btn').disabled && !d.getElementById('save-profile-btn').hasAttribute('aria-busy'), 'Saving restores usable controls');
    check(level.getAttribute('aria-invalid') === null, 'Successful reload clears field validation');
    d.getElementById('mc-avatar-img').dispatchEvent(new w.Event('error'));
    check(d.getElementById('mc-avatar-section').style.display === 'none' && !d.getElementById('mc-avatar-img').hasAttribute('src'), 'A failed remote avatar is removed');
    check(d.getElementById('profile-avatar-empty').style.display === 'block' && d.getElementById('mc-display-name').textContent === 'Adventurer', 'Avatar fallback leaves the real player name intact');
    w.NamelessProfilePage.destroy();
    await w.NamelessProfilePage.init();
    level.value = '52'; d.getElementById('save-profile-btn').click(); await pause(); await pause();
    check(writes.length === 2, 'SPA destroy and reinitialization do not duplicate save handlers');
    w.currentUser = null; level.value = '53'; d.getElementById('save-profile-btn').click(); await pause();
    check(writes.length === 2 && /Reconnectez-vous/.test(d.getElementById('profile-feedback').textContent), 'Expired authentication cannot write a profile');
    w.NamelessProfilePage.destroy(); dom.window.close();
}
{
    const { dom, w, d, language } = await surface({ ...saved, role: 'joueur', minecraft_username: null, minecraft_uuid: null, classe: null, niveau: null, created_at: 'invalid' });
    check(d.getElementById('profile-class-summary').textContent === 'Non renseignée' && d.getElementById('profile-level-summary').textContent === 'Non renseigné', 'Missing character fields are explicitly absent');
    check(d.getElementById('profile-classe').value === '' && d.getElementById('profile-niveau').value === '', 'Missing data does not create a Warrior or level-one default');
    check(d.getElementById('mc-avatar-section').style.display === 'none' && d.getElementById('profile-avatar-empty').style.display === 'block', 'An unlinked account has no invented avatar');
    check(d.getElementById('minecraft-link-info').style.display === 'block' && d.getElementById('profile-minecraft-state').textContent === 'Minecraft non lié', 'The original Minecraft linking form remains available');
    check(d.getElementById('profile-minecraft-link-action').style.display === 'inline-flex', 'An unlinked character has a direct Minecraft-link action');
    d.getElementById('profile-minecraft-link-action').click();
    check(d.getElementById('profile-account').open, 'The Minecraft-link action reveals the existing form');
    check(d.getElementById('guilde-btn').style.display === 'none' && d.getElementById('dashboard-btn').style.display === 'none', 'A regular player cannot see gated tools');
    check(d.getElementById('profile-created').textContent === 'Date inconnue', 'An invalid date is not shown as a member date');
    language('en');
    check(d.getElementById('profile-class-summary').textContent === 'Not set' && d.getElementById('profile-level-summary').textContent === 'Not set', 'Absence states have explicit English labels');
    check(d.getElementById('profile-classe').selectedOptions[0].textContent === 'Choose a class', 'The missing-class prompt translates without changing its value');
    w.NamelessProfilePage.destroy(); dom.window.close();
}
{
    const { dom, w, d } = await surface({ ...saved, role: 'admin', classe: 'Paladin' });
    check(d.getElementById('dashboard-btn').style.display === 'flex', 'An administrator retains the administration action');
    check(d.getElementById('profile-class-summary').textContent === 'Paladin', 'A previously saved legacy class remains visible');
    d.getElementById('profile-niveau').value = '43'; d.getElementById('save-profile-btn').click(); await pause(); await pause();
    check(d.getElementById('profile-classe').value === 'Paladin', 'Saving a level preserves an unchanged legacy class');
    w.NamelessProfilePage.destroy(); dom.window.close();
}
{
    const { dom, w, d, language } = await surface(saved, { public: true });
    check(d.getElementById('profil-content').style.display === 'none' && d.getElementById('error-content').style.display === 'block', 'Public visitors see a useful entry state without private data');
    check(d.getElementById('profile-login-btn').getAttribute('href') === '/connexion' && d.getElementById('profile-login-btn').style.display === 'inline-flex', 'Public entry has the local sign-in action');
    check(d.getElementById('profile-retry-btn').style.display === 'none', 'Public entry does not suggest retrying an unavailable private profile');
    language('en');
    check(d.getElementById('profile-error-title').textContent === 'Return to your character' && /Sign in/.test(d.getElementById('error-text').textContent), 'The public entry state translates to English');
    w.NamelessProfilePage.destroy(); dom.window.close();
}
{
    const { dom, w, d } = await surface(saved, { error: true });
    check(d.getElementById('profile-retry-btn').style.display === 'flex' && d.getElementById('profile-login-btn').style.display === 'none', 'A signed-in load error offers retry instead of another sign-in');
    check(d.getElementById('error-content').style.display === 'block', 'A failed load keeps an actionable error visible');
    w.NamelessProfilePage.destroy(); dom.window.close();
}
console.log('PASS: ' + checks + ' Phase D profile checks: real character summary, account disclosure, role gates, saved edits, native avatar fallback, FR/EN, public/error states and SPA lifecycle.');
