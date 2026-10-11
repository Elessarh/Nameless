(function () {
'use strict';
/* espace-guilde.js - Gestion de l'espace guilde pour les membres */

let guildInitToken = 0;
let guildAuthListeners = null;
let guildMemberId = null;
let guildResumeCommunications = false;
let guildRole = null;
let guildViewData = { objectives: null, activities: null };
window.NamelessTranslations = window.NamelessTranslations || {};
window.NamelessTranslations.en = window.NamelessTranslations.en || {};
Object.assign(window.NamelessTranslations.en, {
    'Aucune annonce publiée': 'No announcements published',
    'Les nouvelles de la guilde apparaîtront ici dès leur publication.': 'Guild news will appear here when published.',
    'Publier une annonce': 'Publish announcement', 'Consulter le guide': 'Read the guide',
    'Ouvrir l’administration': 'Open administration',
    'Aucun objectif cette semaine': 'No objectives this week',
    'Les objectifs de la semaine seront affichés ici lorsqu’ils auront été définis.': 'Weekly objectives will appear here once they have been defined.',
    'Gérer les objectifs': 'Manage objectives', 'Consulter les guides': 'Read the guides',
    'Aucune présence renseignée': 'No attendance recorded',
    'Renseignez votre présence ou votre absence pour l’appel du jour.': 'Record your attendance or absence for today’s roll call.',
    'Votre compte est connecté. Contactez l’équipe sur Discord pour faire vérifier votre accès à la guilde.': 'Your account is signed in. Contact the team on Discord to have your guild access checked.',
    'Vous devez être connecté pour accéder à l\'espace guilde.': 'Sign in to access the guild headquarters.',
    'Cet espace est réservé aux membres de Nameless. Contactez un administrateur si vous avez déjà rejoint la guilde.': 'This space is reserved for Nameless members. Contact an administrator if you have already joined the guild.',
    'Impossible de vérifier votre accès. Réessayez dans un instant.': 'Your access could not be verified. Try again shortly.',
    'Erreur de chargement du planning.': 'The schedule could not be loaded.',
    'Erreur technique lors du chargement du planning.': 'The schedule could not be loaded.',
    'Erreur de chargement des objectifs.': 'The objectives could not be loaded.',
    'Erreur technique lors du chargement des objectifs.': 'The objectives could not be loaded.',
    'Erreur de chargement du mur d’activité.': 'Announcements could not be loaded.',
    'Erreur technique lors du chargement du mur d’activité.': 'Announcements could not be loaded.',
    'Erreur de chargement des présences': 'Attendance could not be loaded',
    'Erreur de chargement des profils': 'Member profiles could not be loaded',
    'Erreur technique lors du chargement': 'The information could not be loaded',
    'Votre présence est enregistrée pour aujourd’hui.': 'Your attendance has been recorded for today.',
    'Votre absence est enregistrée pour aujourd’hui.': 'Your absence has been recorded for today.',
    'Impossible d’enregistrer votre statut. Réessayez dans un instant.': 'Your status could not be saved. Try again shortly.',
    'Présent': 'Present', 'Absent': 'Absent', 'En mission': 'On a mission', 'Joueur inconnu': 'Unknown player',
    'À l\'instant': 'Just now', 'Par': 'By', 'Progression': 'Progress', 'Statut': 'Status'
});
function guildTr(text) { return window.NamelessI18n ? window.NamelessI18n.translate(text) : text; }
function guildEmpty(target, title, description, iconName, action) {
    if (!target) return;
    const box = document.createElement('div'); box.className = 'hq-empty';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', iconName === 'announcements' ? 'M4 10h4l11-5v14L8 14H4zM6 14l2 7h4l-2-6' : iconName === 'presence' ? 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2' : 'M5 4h14v17H5zM9 9h6m-6 4h6m-6 4h4');
    svg.appendChild(path); box.appendChild(svg);
    const heading = document.createElement('strong'); heading.textContent = guildTr(title); box.appendChild(heading);
    const copy = document.createElement('p'); copy.textContent = guildTr(description); box.appendChild(copy);
    if (action) { const link = document.createElement('a'); link.className = 'hq-button hq-empty-action'; link.href = action.href; link.textContent = guildTr(action.label); box.appendChild(link); }
    target.replaceChildren(box);
}
function updateObjectivePreview() {
    const preview = document.getElementById('hq-objective-preview');
    const objectives = document.getElementById('objectives-list');
    if (preview && objectives) {
        const children = [...objectives.children].slice(0, 1);
        if (children.length) preview.replaceChildren(...children.map(node => node.cloneNode(true)));
        else preview.textContent = objectives.textContent;
    }
}
function refreshGuildLanguage() {
    const gateText = document.getElementById('access-denied-text');
    if (gateText?.dataset.guildMessage) gateText.textContent = guildTr(gateText.dataset.guildMessage);
    updateGuildGate();
    if (!guildMemberId || guildMemberId !== window.currentUser?.id) return;
    if (guildViewData.objectives) { displayObjectives(guildViewData.objectives); updateObjectivePreview(); }
    if (guildViewData.activities) displayActivityWall(guildViewData.activities);
    document.querySelectorAll('.presence-status[data-status]').forEach(node => { node.textContent = formatPresenceStatus(node.dataset.status); });
    if (document.getElementById('presence-list')?.dataset.empty === 'true') renderEmptyPresence();
}
function updateGuildGate() {
    const signedIn = !!window.currentUser;
    const login = document.querySelector('[data-guild-gate-login]'); if (login) login.hidden = signedIn;
    const profile = document.querySelector('[data-guild-gate-profile]'); if (profile) profile.hidden = !signedIn;
    const hint = document.querySelector('[data-guild-gate-hint]');
    if (hint) hint.textContent = guildTr(signedIn ? 'Votre compte est connecté. Contactez l’équipe sur Discord pour faire vérifier votre accès à la guilde.' : 'Connectez-vous avec votre compte membre pour retrouver les expéditions, le calendrier et les échanges de la guilde.');
}
function renderEmptyPresence() { guildEmpty(document.getElementById('presence-list'), 'Aucune présence renseignée', 'Renseignez votre présence ou votre absence pour l’appel du jour.', 'presence'); }

function clearPrivateGuildContent() {
    guildRole = null;
    guildViewData = { objectives: null, activities: null };
    document.getElementById('presence-list')?.removeAttribute('data-empty');
    const content = document.getElementById('guilde-content');
    if (content) content.style.display = 'none';
    const ids = ['planning-list', 'objectives-list', 'presence-list', 'presence-feedback', 'activity-wall-content',
        'hq-calendar', 'hq-month-label', 'hq-calendar-note', 'hq-day-events', 'hq-objective-preview',
        'chat-messages', 'dm-messages', 'dm-members-list', 'chat-image-preview', 'dm-image-preview', 'mention-autocomplete',
        'reply-to-author', 'reply-to-preview', 'dm-recipient-name'];
    ids.forEach((id) => document.getElementById(id)?.replaceChildren());
    content?.querySelectorAll('[data-guild-events], [data-guild-members], [data-guild-member-count], [data-guild-setup]').forEach((node) => node.replaceChildren());
    content?.querySelectorAll('input, textarea').forEach((input) => { input.value = ''; });
    document.querySelector('#guild-event-dialog [data-guild-dialog-content]')?.replaceChildren();
    const dialog = document.getElementById('guild-event-dialog');
    if (dialog?.open) dialog.close();
    const chat = document.getElementById('guild-chat');
    chat?.classList.remove('open');
    document.getElementById('chat-replying-to')?.classList.remove('active');
    const dmChat = document.getElementById('dm-active-chat');
    if (dmChat) dmChat.style.display = 'none';
    const dmPlaceholder = document.getElementById('dm-placeholder');
    if (dmPlaceholder) dmPlaceholder.style.display = 'block';
    ['chat-badge', 'tab-private-badge'].forEach((id) => { const badge = document.getElementById(id); if (badge) { badge.textContent = ''; badge.style.display = 'none'; } });
    const toggle = document.getElementById('chat-toggle-btn');
    if (toggle) toggle.style.display = 'none';
    ['chat-input', 'dm-input', 'dm-search-input', 'chat-image-input', 'dm-image-input'].forEach((id) => { const input = document.getElementById(id); if (input) input.value = ''; });
    document.querySelectorAll('.appel-actions button').forEach((button) => { button.disabled = false; button.removeAttribute('aria-busy'); button.removeAttribute('aria-pressed'); });
}

function onGuildAuthChanged(event) {
    const content = document.getElementById('guilde-content');
    if (!content) return;
    const active = document.activeElement;
    const privateFocus = content.contains(active) || document.getElementById('guild-event-dialog')?.contains(active) || document.getElementById('guild-chat')?.contains(active);
    // Auth emits { user }, after publishing window.currentUser; invalidate before
    // any outstanding response can render or refill the just-cleared private cache.
    guildInitToken++;
    guildMemberId = null;
    guildResumeCommunications = false;
    markingPresence = null;
    window.NamelessGuildExpeditions?.destroy();
    window.NamelessGuildChat?.destroy();
    window.NamelessGuildDm?.destroy();
    window.cacheManager?.clear();
    clearPrivateGuildContent();
    const user = event.detail && Object.prototype.hasOwnProperty.call(event.detail, 'user') ? event.detail.user : window.currentUser;
    if (!user || !window.currentUser || user.id !== window.currentUser.id) {
        showAccessDenied('Vous devez être connecté pour accéder à l\'espace guilde.');
        if (privateFocus) document.querySelector('#access-denied a[href="/connexion"]')?.focus();
        return;
    }
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'block';
    const denied = document.getElementById('access-denied');
    if (denied) denied.style.display = 'none';
    if (privateFocus) { const title = document.querySelector('.guild-hall h1'); if (title) { title.tabIndex = -1; title.focus(); } }
    guildResumeCommunications = true;
    initGuildPage();
}

// Fonction pour changer d'onglet
function switchGuildeTab(tabName, persist = true) {
    if (!['planning', 'objectives', 'presence'].includes(tabName)) tabName = 'planning';
    // console.log('[GUILDE] Changement d\'onglet vers:', tabName);
    
    // Retirer la classe active de tous les boutons et contenus
    document.querySelectorAll('.guilde-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        btn.tabIndex = -1;
    });
    document.querySelectorAll('.guilde-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    // Ajouter la classe active au bouton et contenu correspondants
    const activeButton = document.querySelector(`.guilde-tab-btn[data-tab="${tabName}"]`);
    const activeContent = document.querySelector(`.guilde-tab-content[data-tab-content="${tabName}"]`);
    
    if (activeButton) {
        activeButton.classList.add('active');
        activeButton.setAttribute('aria-selected', 'true');
        activeButton.tabIndex = 0;
    }
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
    }
    
    // Sauvegarder l'onglet actif dans localStorage
    if (persist) { try { localStorage.setItem('guildeActiveTab', tabName); } catch (_) {} }
}

// Attendre que l'auth soit prête
async function initGuildPage() {
    const token = ++guildInitToken;
    guildMemberId = null;
    if (guildAuthListeners) guildAuthListeners.abort();
    guildAuthListeners = new AbortController();
    document.addEventListener('nameless:auth-changed', onGuildAuthChanged, { signal: guildAuthListeners.signal });
    document.addEventListener('nameless:languagechange', refreshGuildLanguage, { signal: guildAuthListeners.signal });
    // console.log('[GUILDE] Initialisation de l espace guilde...');
    
    // Cacher le lien "Guilde" du menu (on est déjà sur la page)
    hideGuildeLinkFromMenu();

    // Onglets: délégation (remplace les onclick inline du HTML)
    document.querySelectorAll('.guilde-tab-btn').forEach(btn => {
        if (btn.dataset.guildTabBound === 'true') return;
        btn.dataset.guildTabBound = 'true';
        btn.addEventListener('click', () => switchGuildeTab(btn.dataset.tab));
        btn.addEventListener('keydown', (event) => {
            const tabs = [...document.querySelectorAll('.guilde-tab-btn')];
            const index = tabs.indexOf(btn);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                : event.key === 'ArrowRight' ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
            if (next < 0) return;
            event.preventDefault();
            switchGuildeTab(tabs[next].dataset.tab);
            tabs[next].focus();
        });
    });

    switchGuildeTab('planning', false);
    // Attendre que Supabase et l'utilisateur soient prêts
    if (!await waitForGuildAuth(token)) return;
    if (token !== guildInitToken) return;
    
    // Vérifier que l'utilisateur est membre ou admin
    await checkMemberAccess(token);
}

function destroyGuildPage() {
    guildInitToken++;
    guildMemberId = null;
    guildRole = null;
    guildViewData = { objectives: null, activities: null };
    guildResumeCommunications = false;
    if (guildAuthListeners) guildAuthListeners.abort();
    guildAuthListeners = null;
    if (window.NamelessGuildExpeditions) window.NamelessGuildExpeditions.destroy();
}

window.NamelessGuildPage = {
    init: initGuildPage,
    destroy: destroyGuildPage
};

document.addEventListener('DOMContentLoaded', initGuildPage);

// Cacher le lien Guilde du menu (on est déjà sur cette page)
function hideGuildeLinkFromMenu() {
    const navMenu = document.getElementById('nav-menu');
    if (navMenu) {
        const guildeLink = navMenu.querySelector('a[href="espace-guilde.html"]');
        if (guildeLink && guildeLink.parentElement) {
            guildeLink.parentElement.style.display = 'none';
            // console.log('[OK] Lien Guilde cache du menu');
        }
    }
}

// Attendre que l'authentification soit prête
function waitForGuildAuth(token) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100;
        
        const checkAuth = setInterval(() => {
            attempts++;
            if (token !== guildInitToken) { clearInterval(checkAuth); resolve(false); return; }
            
            if (typeof supabase !== 'undefined' && supabase !== null && window.currentUser !== null && window.currentUser !== undefined) {
                clearInterval(checkAuth);
                // console.log('[OK] Auth prete et utilisateur connecte');
                resolve(true);
            } else if ((window.namelessAuthReady && !window.currentUser) || attempts >= maxAttempts) {
                clearInterval(checkAuth);
                // console.error('[ERREUR] Timeout: utilisateur non connecte');
                showAccessDenied('Vous devez être connecté pour accéder à l\'espace guilde.');
                resolve();
            }
        }, 100);
    });
}

// Vérifier l'accès membre/admin
function logGuildWarning(scope, error) {
    if (!error) return;
    console.warn('[Nameless guild]', scope, {
        code: error.code || null,
        message: error.message || String(error)
    });
}

async function getCurrentUserRole() {
    const { data, error } = await supabase.rpc('current_user_role');
    if (error) {
        logGuildWarning('current_user_role_failed', error);
        throw error;
    }

    return String(data || '').trim();
}

async function checkMemberAccess(token) {
    try {
        if (!window.currentUser) {
            // console.error('[ERREUR] Pas d utilisateur connecte');
            showAccessDenied('Vous devez être connecté pour accéder à l\'espace guilde.');
            return;
        }
        
        const role = await getCurrentUserRole();
        if (token !== guildInitToken) return;
        
        if (role === 'membre' || role === 'admin') {
            guildMemberId = window.currentUser.id;
            guildRole = role;
            // console.log('[OK] Acces autorise - Role:', role);
            await loadGuildeData(token, role);
            if (token !== guildInitToken) return;
            if (guildResumeCommunications) {
                guildResumeCommunications = false;
                if (window.NamelessGuildChat?.init) Promise.resolve(window.NamelessGuildChat.init()).catch((error) => logGuildWarning('chat_resume_failed', error));
                if (window.NamelessGuildDm?.init) Promise.resolve(window.NamelessGuildDm.init()).catch((error) => logGuildWarning('dm_resume_failed', error));
            }
            
            // Restaurer l'onglet actif depuis localStorage
            let savedTab = null;
            try { savedTab = localStorage.getItem('guildeActiveTab'); } catch (_) {}
            if (savedTab) {
                switchGuildeTab(savedTab);
            }
        } else {
            // console.warn('[ATTENTION] Acces refuse - Role:', role);
            showAccessDenied('Cet espace est réservé aux membres de Nameless. Contactez un administrateur si vous avez déjà rejoint la guilde.');
        }
        
    } catch (error) {
        // console.error('[ERREUR] Erreur verification acces:', error);
        logGuildWarning('member_access_failed', error);
        if (token === guildInitToken) showAccessDenied('Impossible de vérifier votre accès. Réessayez dans un instant.');
    }
}

// Afficher le message d'accès refusé
function showAccessDenied(message) {
    const loading = document.getElementById('loading');
    const content = document.getElementById('guilde-content');
    const denied = document.getElementById('access-denied');
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    if (denied) denied.style.display = 'block';
    const deniedText = document.getElementById('access-denied-text');
    if (deniedText && message) { deniedText.dataset.guildMessage = message; deniedText.textContent = guildTr(message); }
    updateGuildGate();
}

// Charger toutes les données de la guilde
async function loadGuildeData(token, role) {
    if (token !== guildInitToken || !document.getElementById('guilde-content')) return;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('guilde-content').style.display = 'block';
    const denied = document.getElementById('access-denied');
    if (denied) denied.style.display = 'none';
    
    // Charger les trois sections en parallèle
    await Promise.all([
        window.NamelessGuildExpeditions
            ? window.NamelessGuildExpeditions.init(document.getElementById('main-content'), { client: supabase, user: window.currentUser, role: role })
            : loadPlanning(token),
        loadObjectives(token),
        loadPresence(token),
        loadActivityWall(token)
    ]);
    
    if (token !== guildInitToken) return;
    updateObjectivePreview();
    // Event listeners pour les boutons d'appel
    const presenceBtn = document.getElementById('mark-presence-btn');
    const absenceBtn = document.getElementById('mark-absence-btn');
    if (presenceBtn && presenceBtn.dataset.presenceBound !== 'true') {
        presenceBtn.dataset.presenceBound = 'true';
        presenceBtn.addEventListener('click', () => markPresence('present'));
    }
    if (absenceBtn && absenceBtn.dataset.presenceBound !== 'true') {
        absenceBtn.dataset.presenceBound = 'true';
        absenceBtn.addEventListener('click', () => markPresence('absent'));
    }
}

// ========== PLANNING ==========
async function loadPlanning(token = guildInitToken) {
    if (token !== guildInitToken) return;
    try {
        // Utiliser le cache
        const cacheKey = 'guild_planning';
        const cached = window.cacheManager?.get(cacheKey);
        
        if (cached) {
            displayPlanning(cached);
            // console.log('[OK] Planning charge depuis cache');
            return;
        }
        
        // Récupérer les événements à venir
        const { data, error } = await supabase
            .from('guild_planning')
            .select('*')
            .gte('date_event', new Date().toISOString())
            .order('date_event', { ascending: true })
            .limit(10);
        
        if (error) {
            // console.error('[ERREUR] Erreur chargement planning:', error);
            logGuildWarning('planning_load_failed', error);
            const container = document.getElementById('planning-list');
            if (token === guildInitToken && container) container.textContent = guildTr('Erreur de chargement du planning.');
            return;
        }
        
        if (token !== guildInitToken) return;
        // Mettre en cache pour 2 minutes
        if (window.cacheManager) {
            window.cacheManager.set(cacheKey, data || []);
        }
        
        if (token === guildInitToken) displayPlanning(data || []);
        // console.log('[OK] Planning charge:', (data || []).length, 'evenements');
        
    } catch (error) {
        // console.error('[ERREUR]:', error);
        logGuildWarning('planning_load_failed', error);
        const container = document.getElementById('planning-list');
        if (token === guildInitToken && container) container.textContent = guildTr('Erreur technique lors du chargement du planning.');
    }
}

function displayPlanning(data) {
    const container = document.getElementById('planning-list');
    if (!container) return;
    
    if (!data || data.length === 0) {
        guildEmpty(container, 'Aucune expédition publiée pour cette sélection.', 'Les prochaines sorties apparaîtront ici dès leur publication.', 'objectives', { href: '/wiki', label: 'Consulter le guide' });
        return;
    }
    
    container.innerHTML = data.map(event => `
        <article class="planning-item">
            <h3 class="item-title">${escapeHtml(event.titre)}</h3>
            <div class="item-date">${formatDate(event.date_event)} | Type: ${escapeHtml(formatEventType(event.type_event))}</div>
            ${event.description ? `<div class="item-description">${escapeHtml(event.description)}</div>` : ''}
        </article>
    `).join('');
}// ========== OBJECTIFS ==========
async function loadObjectives(token = guildInitToken) {
    if (token !== guildInitToken) return;
    try {
        // Obtenir le numéro de semaine actuel
        const now = new Date();
        const week = window.NamelessGuildDates.isoWeek(now);
        const weekNumber = week.week;
        const year = week.year;
        
        // Utiliser le cache
        const cacheKey = `guild_objectives_${year}_${weekNumber}`;
        const cached = window.cacheManager?.get(cacheKey);
        
        if (cached) {
            displayObjectives(cached);
            // console.log('[OK] Objectifs charges depuis cache');
            return;
        }
        
        // Récupérer les objectifs de la semaine
        const { data, error } = await supabase
            .from('guild_objectives')
            .select('*')
            .eq('semaine_numero', weekNumber)
            .eq('annee', year)
            .order('created_at', { ascending: true });
        
        if (error) {
            // console.error('[ERREUR] Erreur chargement objectifs:', error);
            logGuildWarning('objectives_load_failed', error);
            const container = document.getElementById('objectives-list');
            if (token === guildInitToken && container) container.textContent = guildTr('Erreur de chargement des objectifs.');
            return;
        }
        
        if (token !== guildInitToken) return;
        // Mettre en cache pour 5 minutes
        if (window.cacheManager) {
            window.cacheManager.set(cacheKey, data || []);
        }
        
        if (token === guildInitToken) displayObjectives(data || []);
        // console.log('[OK] Objectifs charges:', (data || []).length);
        
    } catch (error) {
        // console.error('[ERREUR]:', error);
        logGuildWarning('objectives_load_failed', error);
        const container = document.getElementById('objectives-list');
        if (token === guildInitToken && container) container.textContent = guildTr('Erreur technique lors du chargement des objectifs.');
    }
}

function displayObjectives(data) {
    const container = document.getElementById('objectives-list');
    if (!container) return;
    guildViewData.objectives = data || [];
    const administration = document.querySelector('[data-guild-objectives-admin]');
    if (administration) administration.hidden = guildRole !== 'admin' || !data?.length;
    
    if (!data || data.length === 0) {
        guildEmpty(container, 'Aucun objectif cette semaine', 'Les objectifs de la semaine seront affichés ici lorsqu’ils auront été définis.', 'objectives', guildRole === 'admin' ? { href: '/admin-dashboard', label: 'Ouvrir l’administration' } : { href: '/wiki', label: 'Consulter les guides' });
        return;
    }
    
    container.innerHTML = data.map(obj => {
        // Coercition numérique: empêche l'injection via l'attribut style.
        const progression = Math.max(0, Math.min(100, parseInt(obj.progression, 10) || 0));
        return `
        <article class="objective-item">
            <h3 class="item-title">${escapeHtml(obj.titre)}</h3>
            <div class="item-description">${escapeHtml(obj.description || '')}</div>
            <div class="objective-progress-label"><span>${guildTr('Progression')}</span><strong>${progression}%</strong></div>
            <div class="progress-bar" role="progressbar" aria-label="${guildTr('Progression')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progression}">
                <div class="progress-fill" style="width: ${progression}%"></div>
            </div>
            <div class="objective-status">
                ${guildTr('Statut')}: ${escapeHtml(formatStatus(obj.statut))}
            </div>
        </article>
    `;
    }).join('');
}

// ========== PRÉSENCE ==========
async function loadPresence(token = guildInitToken) {
    if (token !== guildInitToken) return;
    document.getElementById('presence-list')?.removeAttribute('data-empty');
    try {
        const today = window.NamelessGuildDates.dateKey();
        
        // console.log('[DEBUG] Chargement presences pour:', today);
        
        // Récupérer toutes les présences du jour
        const { data: presences, error: presencesError } = await supabase
            .from('guild_presence')
            .select('*')
            .eq('date_presence', today)
            .order('statut', { ascending: true });
        
        if (presencesError) {
            // console.error('[ERREUR] Erreur chargement presences:', presencesError);
            const container = document.getElementById('presence-list');
            if (token !== guildInitToken || !container) return;
            container.textContent = guildTr('Erreur de chargement des présences');
            return;
        }
        
        // console.log('[DEBUG] Presences recues:', presences);
        
        const container = document.getElementById('presence-list');
        if (token !== guildInitToken || !container) return;
        container.dataset.empty = String(!presences || presences.length === 0);
        const ownPresence = (presences || []).find((entry) => entry.user_id === window.currentUser?.id);
        document.getElementById('mark-presence-btn')?.setAttribute('aria-pressed', ownPresence?.statut === 'present' ? 'true' : 'false');
        document.getElementById('mark-absence-btn')?.setAttribute('aria-pressed', ownPresence?.statut === 'absent' ? 'true' : 'false');
        
        if (!presences || presences.length === 0) {
            renderEmptyPresence();
            return;
        }
        
        // Récupérer les profils des utilisateurs
        const userIds = presences.map(p => p.user_id);
        const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, username, minecraft_username, classe, niveau')
            .in('id', userIds);
        
        if (profilesError) {
            // console.error('[ERREUR] Erreur chargement profils:', profilesError);
            const container = document.getElementById('presence-list');
            if (token === guildInitToken) container.textContent = guildTr('Erreur de chargement des profils');
            return;
        }
        
        if (token !== guildInitToken) return;
        // Créer un map des profils par ID
        const profileMap = {};
        (profiles || []).forEach(p => {
            profileMap[p.id] = p;
        });
        
        // console.log('[DEBUG] Profils recus:', profiles);
        
        // Construction DOM pure : les noms passent par textContent.
        container.innerHTML = '';
        presences.forEach(presence => {
            const profile = profileMap[presence.user_id];

            // Statut restreint à un token sûr (utilisé dans des classes CSS).
            const safeStatut = String(presence.statut || '').replace(/[^a-z0-9_-]/gi, '');

            const card = document.createElement('div');
            card.className = 'presence-card ' + safeStatut;

            const nameEl = document.createElement('div');
            nameEl.className = 'presence-username';
            nameEl.textContent = getPresenceDisplayName(profile);
            card.appendChild(nameEl);

            const statusEl = document.createElement('span');
            statusEl.className = 'presence-status status-' + safeStatut;
            statusEl.dataset.status = presence.statut;
            statusEl.textContent = formatPresenceStatus(presence.statut);
            card.appendChild(statusEl);

            container.appendChild(card);
        });
        
        // console.log('[OK] Presences chargees:', presences.length);
        
    } catch (error) {
        // console.error('[ERREUR]:', error);
        const container = document.getElementById('presence-list');
        if (token === guildInitToken && container) {
            container.textContent = guildTr('Erreur technique lors du chargement');
        }
    }
}

// Marquer sa présence ou absence
let markingPresence = null;
async function markPresence(statut = 'present') {
    const token = guildInitToken;
    if (markingPresence === token || !window.currentUser || window.currentUser.id !== guildMemberId || !['present', 'absent'].includes(statut)) return;
    markingPresence = token;
    const buttons = [...document.querySelectorAll('.appel-actions button')];
    const feedback = document.getElementById('presence-feedback');
    buttons.forEach((button) => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });
    if (feedback) feedback.textContent = guildTr('Enregistrement…');
    try {
        const { error } = await supabase.from('guild_presence').upsert({
            user_id: window.currentUser.id,
            date_presence: window.NamelessGuildDates.dateKey(),
            statut: statut
        }, { onConflict: 'user_id,date_presence' });
        if (token !== guildInitToken) return;
        if (error) throw error;
        if (feedback) feedback.textContent = guildTr(statut === 'present' ? 'Votre présence est enregistrée pour aujourd’hui.' : 'Votre absence est enregistrée pour aujourd’hui.');
        await loadPresence(token);
    } catch (error) {
        if (token === guildInitToken && feedback) feedback.textContent = guildTr('Impossible d’enregistrer votre statut. Réessayez dans un instant.');
    } finally {
        if (markingPresence === token) {
            markingPresence = null;
            buttons.forEach((button) => { button.disabled = false; button.removeAttribute('aria-busy'); });
        }
    }
}

// ========== FONCTIONS UTILITAIRES ==========

// Nom public affiché dans l'appel :
// 1. minecraft_username si présent ;
// 2. username seulement s'il est personnalisé (pas le fallback technique
//    Joueur_xxxxxx généré à l'inscription Microsoft) ;
// 3. « Joueur inconnu » sinon. Jamais d'email.
function getPresenceDisplayName(profile) {
    if (!profile) return guildTr('Joueur inconnu');
    if (profile.minecraft_username) return profile.minecraft_username;

    const username = String(profile.username || '').trim();
    if (username && !/^Joueur_[A-Za-z0-9]{6}$/.test(username)) return username;

    return guildTr('Joueur inconnu');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: window.NamelessGuildDates.timeZone
    };
    return date.toLocaleDateString(window.NamelessI18n ? window.NamelessI18n.getLocale() : 'fr-FR', options);
}

function formatEventType(type) {
    const types = {
        'reunion': 'Réunion',
        'raid': 'Raid',
        'event': 'Événement',
        'pvp': 'PvP',
        'construction': 'Construction',
        'autre': 'Autre'
    };
    return guildTr(types[type] || type);
}

function formatStatus(status) {
    const statuses = {
        'en_cours': 'En cours',
        'termine': 'Terminé',
        'abandonne': 'Abandonné'
    };
    return guildTr(statuses[status] || status);
}

function formatPresenceStatus(status) {
    const statuses = {
        'present': 'Présent',
        'absent': 'Absent',
        'en_mission': 'En mission'
    };
    return guildTr(statuses[status] || status);
}

function escapeHtml(text) {
    if (window.NamelessSecurity && window.NamelessSecurity.escapeHtml) {
        return window.NamelessSecurity.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

// ========== MUR D'ACTIVITÉ ==========
async function loadActivityWall(token = guildInitToken) {
    if (token !== guildInitToken) return;
    try {
        // console.log('[GUILDE] Chargement du mur d\'activité...');
        
        // Utiliser le cache
        const cacheKey = 'guild_activity_wall';
        const cached = window.cacheManager?.get(cacheKey);
        
        if (cached) {
            await displayActivityWall(cached, token);
            // console.log('[OK] Mur d\'activité chargé depuis cache');
            return;
        }
        
        // Récupérer les activités (limitées aux 20 dernières)
        const { data, error } = await supabase
            .from('guild_activity_wall')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) {
            // console.error('[ERREUR] Erreur chargement activités:', error);
            logGuildWarning('activity_wall_load_failed', error);
            const container = document.getElementById('activity-wall-content');
            if (token === guildInitToken && container) container.textContent = guildTr('Erreur de chargement du mur d’activité.');
            return;
        }
        
        if (token !== guildInitToken) return;
        // Mettre en cache pour 1 minute
        if (window.cacheManager) {
            window.cacheManager.set(cacheKey, data || [], 60000);
        }
        
        if (token === guildInitToken) await displayActivityWall(data || [], token);
        // console.log('[OK] Mur d\'activité chargé:', (data || []).length, 'publications');
        
    } catch (error) {
        // console.error('[ERREUR] Erreur mur d\'activité:', error);
        logGuildWarning('activity_wall_load_failed', error);
        const container = document.getElementById('activity-wall-content');
        if (token === guildInitToken && container) container.textContent = guildTr('Erreur technique lors du chargement du mur d’activité.');
    }
}

async function displayActivityWall(activities, token = guildInitToken) {
    const container = document.getElementById('activity-wall-content');
    if (!container || token !== guildInitToken) return;
    guildViewData.activities = activities || [];
    const administration = document.querySelector('[data-guild-announcement-admin]');
    if (administration) administration.hidden = guildRole !== 'admin' || !activities?.length;
    
    if (!activities || activities.length === 0) {
        guildEmpty(container, 'Aucune annonce publiée', 'Les nouvelles de la guilde apparaîtront ici dès leur publication.', 'announcements', guildRole === 'admin' ? { href: '/admin-dashboard', label: 'Ouvrir l’administration' } : { href: '/wiki', label: 'Consulter le guide' });
        return;
    }
    
    const posts = await Promise.all(activities.map(async (activity) => {
        // URL image validée (https, pas de javascript:/data:). Rejetée => pas d'image.
        const safeImg = (window.NamelessSecurity && activity.image_url)
            ? await window.NamelessSecurity.resolveMediaUrl(activity.image_url, { client: supabase }).catch(() => '')
            : '';
        // Type limité à un mot alphanumérique pour l'usage dans une classe CSS.
        const safeType = String(activity.type || 'annonce').replace(/[^a-z0-9_-]/gi, '');
        return `
        <div class="activity-post">
            <div class="activity-post-header">
                <div>
                    <h3 class="activity-post-title">${escapeHtml(activity.titre)}</h3>
                    <div class="activity-post-date">${formatActivityDate(activity.created_at)}</div>
                </div>
            </div>
            <div class="activity-post-content">${escapeHtml(activity.contenu)}</div>
            ${safeImg ? `<img src="${escapeHtml(safeImg)}" alt="${escapeHtml(activity.titre)}" class="activity-post-image" loading="lazy" decoding="async">` : ''}
            <div class="activity-post-footer">
                <span class="activity-post-author">${guildTr('Par')} ${escapeHtml(activity.author_name || 'Admin')}</span>
                <span class="activity-post-type type-${safeType}">${escapeHtml(formatActivityType(activity.type))}</span>
            </div>
        </div>
    `;
    }));
    if (token === guildInitToken && container.isConnected) container.innerHTML = posts.join('');
}

function formatActivityDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const english = window.NamelessI18n?.getLanguage() === 'en';
    if (minutes < 1) return guildTr('À l\'instant');
    if (minutes < 60) return english ? `${minutes} min ago` : `Il y a ${minutes} min`;
    if (hours < 24) return english ? `${hours}h ago` : `Il y a ${hours}h`;
    if (days < 7) return english ? `${days}d ago` : `Il y a ${days}j`;
    
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString(window.NamelessI18n ? window.NamelessI18n.getLocale() : 'fr-FR', options);
}

function formatActivityType(type) {
    const types = {
        'annonce': 'Annonce',
        'evenement': 'Événement',
        'info': 'Information',
        'victoire': 'Victoire'
    };
    return guildTr(types[type] || 'Annonce');
}

})();
