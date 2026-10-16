(function () {
'use strict';
/* profil.js - Gestion de la page profil utilisateur */

// Variables locales (currentUser et userProfile sont globaux depuis auth-supabase.js)
let localUserProfile = null;
let profileInitToken = 0;
let minecraftLookupController = null;
let profileLanguageBound = false;
let profileAuthBound = false;
let profileActorId = null;
const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const MINECRAFT_UUID_PATTERN = /^[0-9a-f]{32}$/i;
const PROFILE_CLASSES = ['Shaman', 'Mage', 'Assassin', 'Guerrier', 'Archer'];

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', initProfilePage);

// Attendre que l'authentification soit prête ET que l'utilisateur soit connecté
async function initProfilePage() {
    const token = ++profileInitToken;
    profileActorId = window.currentUser?.id || null;
    bindProfileTools();
    if (!profileAuthBound) {
        document.addEventListener('nameless:auth-changed', onProfileAuthChanged);
        profileAuthBound = true;
    }
    if (!profileLanguageBound) {
        document.addEventListener('nameless:languagechange', updateProfileLanguage);
        profileLanguageBound = true;
    }
    updateProfileLanguage();

    if (!await waitForAuthAndUser(token)) return;

    if (token !== profileInitToken) return;
    profileActorId = window.currentUser?.id || null;
    await loadProfilePage(token);
}

function destroyProfilePage() {
    profileInitToken++;
    localUserProfile = null;
    if (minecraftLookupController) minecraftLookupController.abort();
    minecraftLookupController = null;
    if (profileLanguageBound) document.removeEventListener('nameless:languagechange', updateProfileLanguage);
    profileLanguageBound = false;
    if (profileAuthBound) document.removeEventListener('nameless:auth-changed', onProfileAuthChanged);
    profileAuthBound = false;
    profileActorId = null;
}

function onProfileAuthChanged() {
    const nextActor = window.currentUser?.id || null;
    if (nextActor && nextActor === profileActorId) return;
    profileInitToken++;
    profileActorId = nextActor;
    localUserProfile = null;
    if (minecraftLookupController) minecraftLookupController.abort();
    minecraftLookupController = null;
    const content = document.getElementById('profil-content');
    const hadFocus = !!content?.contains(document.activeElement);
    if (content) content.style.display = 'none';
    for (const id of ['mc-display-name', 'profile-role', 'profile-class-summary', 'profile-level-summary', 'profile-character-state', 'profile-microsoft-state', 'profile-minecraft-state', 'profile-minecraft-username', 'profile-minecraft-uuid', 'profile-created', 'profile-feedback']) setText(id, '');
    const avatar = document.getElementById('mc-avatar-img');
    if (avatar) { avatar.removeAttribute('src'); avatar.alt = ''; }
    for (const id of ['profile-classe', 'profile-niveau', 'minecraft-username-input']) {
        const input = document.getElementById(id);
        if (input) { input.value = ''; input.removeAttribute('aria-invalid'); }
    }
    const account = document.getElementById('profile-account');
    if (account) account.open = false;
    for (const id of ['dashboard-btn', 'guilde-btn']) document.getElementById(id)?.style.setProperty('display', 'none', 'important');
    const saveButton = document.getElementById('save-profile-btn');
    if (saveButton) {
        saveButton.disabled = false;
        saveButton.removeAttribute('aria-busy');
        saveButton.textContent = profileLabel('Sauvegarder les modifications', 'Save changes');
    }
    setMinecraftLinkBusy(false);
    if (!nextActor) {
        showError('Vous devez être connecté pour voir votre profil.');
        if (hadFocus) document.getElementById('profile-login-btn')?.focus();
        return;
    }
    setElementDisplay('error-content', 'none');
    setElementDisplay('loading', 'block');
    initProfilePage().catch(() => showError('Impossible de charger votre profil. Veuillez reessayer.'));
}

function profileIsEnglish() {
    return window.NamelessI18n ? window.NamelessI18n.getLanguage() === 'en' : document.documentElement.lang === 'en';
}

function profileLabel(french, english) {
    return profileIsEnglish() ? english : french;
}

function profileClassLabel(value) {
    const english = { Shaman: 'Shaman', Mage: 'Mage', Assassin: 'Assassin', Guerrier: 'Warrior', Archer: 'Archer' };
    return profileIsEnglish() && english[value] ? english[value] : value;
}

// Messages belong to this route. Usernames, UUIDs and saved class values stay unchanged.
const PROFILE_MESSAGES = {
    'Vous devez être connecté pour voir votre profil.': 'Sign in to view your character and manage your profile.',
    'Impossible de charger votre profil. Veuillez reessayer.': 'Unable to load your profile. Please try again.',
    'Impossible de creer votre fiche joueur. Veuillez reessayer.': 'Unable to create your player profile. Please try again.',
    'Une erreur technique est survenue.': 'A technical error occurred. Please try again.',
    'Le niveau doit être entre 1 et 100.': 'Enter a whole-number level from 1 to 100.',
    'Choisissez une classe valide.': 'Choose a valid class.',
    'Reconnectez-vous pour sauvegarder votre profil.': 'Sign in again to save your profile.',
    'Impossible de sauvegarder vos modifications.': 'Unable to save your changes. Please try again.',
    'Modifications sauvegardées avec succès !': 'Changes saved successfully!',
    'Minecraft détecté : profil public associé à ton compte.': 'Minecraft detected: public profile linked to your account.',
    'Minecraft non lié.': 'Minecraft not linked.',
    'Recherche du profil Minecraft...': 'Looking up the Minecraft profile…',
    'Profil public trouvé. Sauvegarde en cours...': 'Public profile found. Saving…',
    'Pseudo Minecraft invalide. Utilise 3 à 16 caractères : lettres, chiffres ou underscore.': 'Invalid Minecraft username. Use 3 to 16 letters, numbers or underscores.',
    'Pseudo Minecraft introuvable.': 'Minecraft username not found.',
    'Service public Minecraft indisponible pour le moment.': 'The public Minecraft service is temporarily unavailable.',
    'Réponse Minecraft publique invalide.': 'Invalid response from the public Minecraft service.',
    'Ce profil Minecraft est déjà associé à un autre compte.': 'This Minecraft profile is already linked to another account.',
    'L’association Minecraft est momentanément indisponible. Contactez un administrateur.': 'Minecraft linking is temporarily unavailable. Contact an administrator.',
    'Impossible d’associer ce pseudo Minecraft.': 'Unable to link this Minecraft username.'
};

function setProfileMessage(id, french) {
    const element = document.getElementById(id);
    if (!element) return;
    element.dataset.profileMessage = french;
    element.textContent = profileLabel(french, PROFILE_MESSAGES[french] || (window.NamelessI18n ? window.NamelessI18n.translate(french) : french));
}

function updateCharacterSummary(profile) {
    if (!profile) return;
    const savedClass = typeof profile.classe === 'string' ? profile.classe.trim() : '';
    const savedLevel = Number(profile.niveau);
    const hasLevel = profile.niveau !== null && profile.niveau !== undefined && profile.niveau !== '' && Number.isInteger(savedLevel) && savedLevel >= 1 && savedLevel <= 100;
    setText('profile-class-summary', savedClass ? profileClassLabel(savedClass) : profileLabel('Non renseignée', 'Not set'));
    setText('profile-level-summary', hasLevel ? String(savedLevel) : profileLabel('Non renseigné', 'Not set'));
    setText('profile-character-state', savedClass && hasLevel ? profileLabel('Classe et niveau sauvegardés.', 'Saved class and level.') : profileLabel('Complétez les informations de votre personnage ci-dessous.', 'Complete your character information below.'));
}

function updateProfileLanguage() {
    const root = document.getElementById('main-content');
    if (!root || !root.classList.contains('profil-container')) return;
    root.querySelectorAll('[data-profile-fr]').forEach(element => {
        // A linking request owns its busy label until it completes.
        if ((element.id === 'minecraft-link-btn' || element.id === 'save-profile-btn') && element.disabled) return;
        element.textContent = profileLabel(element.dataset.profileFr, element.dataset.profileEn);
    });
    root.querySelectorAll('[data-profile-aria-fr]').forEach(element => element.setAttribute('aria-label', profileLabel(element.dataset.profileAriaFr, element.dataset.profileAriaEn)));
    root.querySelectorAll('[data-profile-message]').forEach(element => setProfileMessage(element.id, element.dataset.profileMessage));
    const select = document.getElementById('profile-classe');
    if (select) select.querySelectorAll('option').forEach(option => {
        option.textContent = option.value ? profileClassLabel(option.value) : profileLabel('Choisir une classe', 'Choose a class');
    });
    if (localUserProfile) {
        updateCharacterSummary(localUserProfile);
        renderProfileAccount(localUserProfile);
        setText('profile-role', getRoleLabel((localUserProfile.role || 'joueur').trim()));
        setText('mc-display-name', getMinecraftDisplayName(localUserProfile));
    }
    const linkButton = document.getElementById('minecraft-link-btn');
    if (linkButton && linkButton.disabled) linkButton.textContent = profileLabel('Association…', 'Linking…');
    const saveButton = document.getElementById('save-profile-btn');
    if (saveButton && saveButton.disabled) saveButton.textContent = profileLabel('Sauvegarde…', 'Saving…');
}

function bindProfileTools() {
    const accountLink = document.getElementById('profile-account-link');
    if (accountLink && !accountLink.dataset.profileToolBound) {
        accountLink.addEventListener('click', () => { const account = document.getElementById('profile-account'); if (account) account.open = true; });
        accountLink.dataset.profileToolBound = 'true';
    }
    const minecraftLink = document.getElementById('profile-minecraft-link-action');
    if (minecraftLink && !minecraftLink.dataset.profileToolBound) {
        minecraftLink.addEventListener('click', () => {
            const account = document.getElementById('profile-account');
            if (account) account.open = true;
        });
        minecraftLink.dataset.profileToolBound = 'true';
    }
    const retry = document.getElementById('profile-retry-btn');
    if (retry && !retry.dataset.profileToolBound) {
        retry.addEventListener('click', () => {
            setElementDisplay('error-content', 'none');
            setElementDisplay('loading', 'block');
            initProfilePage();
        });
        retry.dataset.profileToolBound = 'true';
    }
}

function navigateToConnexion() {
    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
        window.NamelessSpaRouter.navigate('/connexion');
        return;
    }

    window.location.href = '/connexion';
}

window.NamelessProfilePage = {
    init: initProfilePage,
    destroy: destroyProfilePage
};

function waitForAuthAndUser(token) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 secondes max
        
        const checkAuth = setInterval(() => {
            attempts++;
            if (token !== profileInitToken) { clearInterval(checkAuth); resolve(false); return; }
            
            // Vérifier que Supabase ET window.currentUser sont prêts
            if (typeof supabase !== 'undefined' && supabase !== null && window.currentUser !== null && window.currentUser !== undefined) {
                clearInterval(checkAuth);
                resolve(true);
            } else if ((window.namelessAuthReady && !window.currentUser) || attempts >= maxAttempts) {
                clearInterval(checkAuth);
                showError('Vous devez être connecté pour voir votre profil.');
                resolve(false);
            }
        }, 100);
    });
}

// Charger le profil de l'utilisateur connecté (renommé pour éviter conflit avec auth-supabase.js)
function isMissingProfileError(error) {
    if (!error) return false;
    var message = String(error.message || '');
    return error.code === 'PGRST116'
        || message.indexOf('JSON object requested') !== -1
        || message.indexOf('0 rows') !== -1
        || message.indexOf('406') !== -1;
}

function getDefaultUsername(profileUserId = window.currentUser?.id) {
    var userId = profileUserId ? String(profileUserId).replace(/-/g, '') : '';
    var suffix = userId ? userId.substring(0, 6) : Math.random().toString(36).substring(2, 8);
    return 'Joueur_' + suffix;
}

function getMinecraftDisplayName(profile) {
    if (!profile) return profileLabel('Compte Microsoft connecté', 'Microsoft account connected');
    if (profile.minecraft_username) return profile.minecraft_username;
    if (typeof window.getPublicProfileName === 'function') {
        const publicName = window.getPublicProfileName(profile);
        return publicName === 'Compte Microsoft' ? profileLabel('Compte Microsoft', 'Microsoft account') : publicName;
    }
    if (profile.username && !/^Joueur_[A-Za-z0-9]{6}$/.test(profile.username)) return profile.username;
    if (profile.minecraft_uuid) return profileLabel('Minecraft détecté', 'Minecraft detected');
    return profileLabel('Compte Microsoft connecté', 'Microsoft account connected');
}

function getMinecraftUsernameValue(profile) {
    return profile && profile.minecraft_username ? profile.minecraft_username : profileLabel('Non renseigné', 'Not set');
}

function getMinecraftUuidValue(profile) {
    return profile && profile.minecraft_uuid ? profile.minecraft_uuid : profileLabel('Non renseigné', 'Not set');
}

function hasMinecraftIdentity(profile) {
    return !!(profile && profile.minecraft_uuid);
}

function getMinecraftStatusValue(profile) {
    // Il n'existe pas de vérification officielle Microsoft -> Minecraft :
    // seul le profil public compte. Deux états : détecté ou non lié.
    if (hasMinecraftIdentity(profile)) return profileLabel('Minecraft détecté', 'Minecraft detected');
    return profileLabel('Minecraft non lié', 'Minecraft not linked');
}

function getMinecraftAvatarKey(profile) {
    if (!profile) return '';
    return profile.minecraft_uuid || '';
}

function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setElementDisplay(id, displayValue) {
    var element = document.getElementById(id);
    if (element) element.style.display = displayValue;
}

function bindMinecraftAvatarFallback(avatarSection, avatarImg, titleFallback) {
    if (!avatarImg || avatarImg.dataset.minecraftAvatarFallbackBound === 'true') return;

    avatarImg.addEventListener('error', function() {
        avatarImg.removeAttribute('src');
        avatarImg.alt = '';
        if (avatarSection) avatarSection.style.display = 'none';
        setElementDisplay('profile-avatar-empty', 'block');
    });

    avatarImg.dataset.minecraftAvatarFallbackBound = 'true';
}

function getMinecraftLinkState() {
    try {
        return new URLSearchParams(window.location.search).get('minecraft_link') || '';
    } catch (error) {
        return '';
    }
}

function getMinecraftLinkReason() {
    try {
        return new URLSearchParams(window.location.search).get('reason') || '';
    } catch (error) {
        return '';
    }
}

function hasMinecraftLinkReturnState() {
    var state = getMinecraftLinkState();
    return state === 'success' || state === 'return';
}

function setMinecraftLinkStatus(message) {
    setProfileMessage('minecraft-link-status', message);
}

function normalizeMinecraftUsername(value) {
    var username = String(value || '').trim();
    return MINECRAFT_USERNAME_PATTERN.test(username) ? username : '';
}

function normalizeMinecraftUuid(value) {
    var uuid = String(value || '').replace(/-/g, '').toLowerCase();
    return MINECRAFT_UUID_PATTERN.test(uuid) ? uuid : '';
}

function setMinecraftLinkBusy(isBusy) {
    var input = document.getElementById('minecraft-username-input');
    var button = document.getElementById('minecraft-link-btn');

    if (input) input.disabled = isBusy;
    if (button) {
        button.disabled = isBusy;
        button.textContent = isBusy ? profileLabel('Association…', 'Linking…') : profileLabel('Associer ce pseudo', 'Link this username');
    }
}

function getPlayerDbErrorCode(data) {
    if (!data || typeof data !== 'object') return '';
    return String(data.code || data.error || '').toLowerCase();
}

async function fetchPublicMinecraftProfile(username) {
    var response;
    var data = null;
    var controller = new AbortController();
    minecraftLookupController = controller;
    var timeout = setTimeout(() => controller.abort(), 8000);

    try {
        response = await fetch('https://playerdb.co/api/player/minecraft/' + encodeURIComponent(username), {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
    } catch (error) {
        throw { code: 'public_api_unavailable' };
    } finally {
        clearTimeout(timeout);
        if (minecraftLookupController === controller) minecraftLookupController = null;
    }

    try {
        data = await response.json();
    } catch (error) {
        throw { code: 'public_api_invalid_response' };
    }

    if (!response.ok) {
        throw { code: response.status === 404 ? 'minecraft_public_not_found' : 'public_api_unavailable' };
    }

    var player = data && data.data && data.data.player ? data.data.player : null;
    var apiCode = getPlayerDbErrorCode(data);
    if (!player || (apiCode && apiCode !== 'player.found')) {
        throw { code: 'minecraft_public_not_found' };
    }

    var officialUsername = normalizeMinecraftUsername(player.username || player.name);
    var uuid = normalizeMinecraftUuid(player.raw_id || player.id || player.uuid);

    if (!officialUsername || !uuid) {
        throw { code: 'public_api_invalid_response' };
    }

    return {
        username: officialUsername,
        uuid: uuid
    };
}

async function saveDetectedMinecraftProfile(minecraftProfile, userId) {
    var { data, error } = await supabase
        .from('user_profiles')
        .update({
            minecraft_username: minecraftProfile.username,
            minecraft_uuid: minecraftProfile.uuid,
            minecraft_verified: false,
            minecraft_linked_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

function getMinecraftPublicLinkErrorMessage(error) {
    var code = error && error.code ? String(error.code) : '';
    var message = error && error.message ? String(error.message) : '';

    if (code === 'minecraft_public_not_found') return 'Pseudo Minecraft introuvable.';
    if (code === 'public_api_unavailable') return 'Service public Minecraft indisponible pour le moment.';
    if (code === 'public_api_invalid_response') return 'Réponse Minecraft publique invalide.';
    if (code === '23505') return 'Ce profil Minecraft est déjà associé à un autre compte.';
    if (code === 'P0001' || message.indexOf('minecraft link fields require backend verification') !== -1) {
        return 'L’association Minecraft est momentanément indisponible. Contactez un administrateur.';
    }

    return 'Impossible d’associer ce pseudo Minecraft.';
}

function invalidateProfileCache() {
    if (!window.cacheManager || !window.currentUser) return;
    window.cacheManager.invalidate(`user_profile_${window.currentUser.id}`);
    window.cacheManager.invalidate('all_users');
}

async function submitMinecraftPublicLink(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const token = profileInitToken;
    const button = document.getElementById('minecraft-link-btn');
    if (!window.currentUser || !button || button.disabled) return;
    const userId = window.currentUser.id;

    var input = document.getElementById('minecraft-username-input');
    var username = normalizeMinecraftUsername(input ? input.value : '');

    if (!username) {
        setMinecraftLinkStatus('Pseudo Minecraft invalide. Utilise 3 à 16 caractères : lettres, chiffres ou underscore.');
        return;
    }

    setMinecraftLinkBusy(true);
    setMinecraftLinkStatus('Recherche du profil Minecraft...');

    try {
        var minecraftProfile = await fetchPublicMinecraftProfile(username);
        if (token !== profileInitToken || window.currentUser?.id !== userId) return;
        setMinecraftLinkStatus('Profil public trouvé. Sauvegarde en cours...');

        var updatedProfile = await saveDetectedMinecraftProfile(minecraftProfile, userId);
        if (token !== profileInitToken || window.currentUser?.id !== userId) return;
        localUserProfile = updatedProfile;
        window.userProfile = updatedProfile;
        invalidateProfileCache();
        displayProfile(updatedProfile);
        showSuccess('Minecraft détecté : profil public associé à ton compte.');
    } catch (error) {
        if (token === profileInitToken) setMinecraftLinkStatus(getMinecraftPublicLinkErrorMessage(error));
    } finally {
        if (token === profileInitToken) setMinecraftLinkBusy(false);
    }
}

function bindMinecraftPublicLinkForm() {
    var form = document.getElementById('minecraft-link-form');
    if (!form || form.dataset.minecraftPublicLinkBound === 'true') return;

    form.addEventListener('submit', submitMinecraftPublicLink);
    form.dataset.minecraftPublicLinkBound = 'true';
}

function prepareMinecraftPublicLink(profile, hasMinecraftProfile) {
    bindMinecraftPublicLinkForm();

    if (hasMinecraftProfile) return;

    var input = document.getElementById('minecraft-username-input');
    if (input && profile && profile.minecraft_username) {
        input.value = profile.minecraft_username;
    }

    setMinecraftLinkStatus('Minecraft non lié.');
}

async function fetchOwnProfile(userId = window.currentUser?.id) {
    var query = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId);

    if (typeof query.maybeSingle === 'function') {
        return await query.maybeSingle();
    }

    return await query.single();
}

async function createOwnPlayerProfile(userId) {
    if (!userId || window.currentUser?.id !== userId) throw new Error('profile_session_changed');
    var result = await supabase
        .from('user_profiles')
        .insert([{
            id: userId,
            username: getDefaultUsername(userId),
            role: 'joueur'
        }])
        .select('*')
        .single();

    if (!result.error) return result.data;

    if (result.error.code === '23505') {
        var retry = await fetchOwnProfile(userId);
        if (!retry.error && retry.data) return retry.data;
    }

    throw result.error;
}

async function resolveOwnProfile(userId) {
    var result = await fetchOwnProfile(userId);
    if (!userId || window.currentUser?.id !== userId) throw new Error('profile_session_changed');

    if (!result.error && result.data) return result.data;

    if (!result.error || isMissingProfileError(result.error)) {
        return await createOwnPlayerProfile(userId);
    }

    throw result.error;
}

async function loadProfilePage(token = profileInitToken) {
    try {
        // Double vérification
        if (!window.currentUser) {
            showError('Vous devez être connecté pour voir votre profil.');

            return;
        }
        const userId = window.currentUser.id;
        
        
        // Essayer de charger depuis le cache d'abord
        const cacheKey = `user_profile_${userId}`;
        if (hasMinecraftLinkReturnState() && window.cacheManager) {
            window.cacheManager.invalidate(cacheKey);
            window.cacheManager.invalidate('all_users');
        }

        const cachedProfile = window.cacheManager?.get(cacheKey);
        
        if (cachedProfile && !hasMinecraftLinkReturnState()) {
            localUserProfile = cachedProfile;
            displayProfile(cachedProfile);
            return;
        }
        
        // Recuperer ou creer la fiche joueur de l'utilisateur connecte.
        let profile = null;
        try {
            profile = await resolveOwnProfile(userId);
            if (token !== profileInitToken || window.currentUser?.id !== userId || !document.getElementById('profil-content')) return;
        } catch (error) {
            if (token === profileInitToken) showError('Impossible de charger votre profil. Veuillez reessayer.');
            return;
        }
        
        if (!profile) {
            showError('Impossible de creer votre fiche joueur. Veuillez reessayer.');
            return;
        }
        
        localUserProfile = profile;
        window.userProfile = profile;
        
        // Mettre en cache pour 5 minutes
        if (window.cacheManager) {
            window.cacheManager.set(cacheKey, profile);
        }
        
        // Afficher le profil
        displayProfile(profile);
        
    } catch (error) {
        if (token === profileInitToken) showError('Une erreur technique est survenue.');
    }
}

// Afficher le profil dans l'interface
function displayProfile(profile) {
    // Masquer le loading
    document.getElementById('loading').style.display = 'none';
    
    // Afficher le contenu
    document.getElementById('profil-content').style.display = 'block';
    const errorContent = document.getElementById('error-content');
    if (errorContent) errorContent.style.display = 'none';
    
    // Afficher uniquement l'identite Minecraft publique.
    var mcUsername = getMinecraftDisplayName(profile);
    var avatarKey = getMinecraftAvatarKey(profile);
    var avatarSection = document.getElementById('mc-avatar-section');
    var avatarImg = document.getElementById('mc-avatar-img');
    var displayNameEl = document.getElementById('mc-display-name');
    var titleFallback = document.getElementById('profil-title-fallback');

    var hasMinecraftProfile = hasMinecraftIdentity(profile);

    renderProfileAccount(profile);
    if (displayNameEl) displayNameEl.textContent = mcUsername;
    if (titleFallback) titleFallback.style.display = hasMinecraftProfile ? 'none' : 'block';

    if (avatarSection && avatarImg && hasMinecraftProfile) {
        bindMinecraftAvatarFallback(avatarSection, avatarImg, titleFallback);
        avatarImg.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(avatarKey) + '/128';
        avatarImg.alt = mcUsername;
        avatarSection.style.display = 'flex';
        setElementDisplay('profile-avatar-empty', 'none');
    } else if (avatarSection && avatarImg) {
        avatarImg.removeAttribute('src');
        avatarImg.alt = '';
        avatarSection.style.display = 'none';
        setElementDisplay('profile-avatar-empty', 'block');
    }

    setElementDisplay('minecraft-link-info', hasMinecraftProfile ? 'none' : 'block');
    setElementDisplay('profile-minecraft-link-action', hasMinecraftProfile ? 'none' : 'inline-flex');
    prepareMinecraftPublicLink(profile, hasMinecraftProfile);

    // Afficher le rôle avec le bon badge
    const roleBadge = document.getElementById('profile-role');
    const role = (profile.role || 'joueur').trim(); // Nettoyer les espaces
    
    roleBadge.textContent = getRoleLabel(role);
    roleBadge.className = 'role-badge role-' + role;
    
    // Afficher classe et niveau
    const classSelect = document.getElementById('profile-classe');
    const currentClass = typeof profile.classe === 'string' ? profile.classe : '';
    classSelect.querySelectorAll('option[data-profile-current-class]').forEach((option) => option.remove());
    if (!PROFILE_CLASSES.includes(currentClass)) {
        const option = document.createElement('option');
        option.value = currentClass;
        option.textContent = currentClass || profileLabel('Choisir une classe', 'Choose a class');
        option.dataset.profileCurrentClass = 'true';
        classSelect.appendChild(option);
    }
    classSelect.value = currentClass;
    const levelInput = document.getElementById('profile-niveau');
    const storedLevel = Number(profile.niveau);
    levelInput.value = profile.niveau !== null && profile.niveau !== undefined && profile.niveau !== '' && Number.isInteger(storedLevel) && storedLevel >= 1 && storedLevel <= 100 ? String(storedLevel) : '';
    levelInput.removeAttribute('aria-invalid');
    classSelect.removeAttribute('aria-invalid');
    updateCharacterSummary(profile);
    
    // Afficher le bouton Dashboard si admin
    const dashboardBtn = document.getElementById('dashboard-btn');
    
    if (dashboardBtn) {
        if (role === 'admin') {
            dashboardBtn.style.setProperty('display', 'flex', 'important');
        } else {
            dashboardBtn.style.setProperty('display', 'none', 'important');
        }
    }
    
    // Afficher le bouton Guilde si membre ou admin
    const guildeBtn = document.getElementById('guilde-btn');
    
    if (guildeBtn) {
        if (role === 'membre' || role === 'admin') {
            guildeBtn.style.setProperty('display', 'flex', 'important');
        } else {
            guildeBtn.style.setProperty('display', 'none', 'important');
        }
    }
    
    updateProfileLanguage();
    
    // Ajouter l'event listener pour le bouton de sauvegarde
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn && saveBtn.dataset.profileSaveBound !== 'true') {
        saveBtn.addEventListener('click', saveProfileChanges);
        saveBtn.dataset.profileSaveBound = 'true';
    }
    
}

function renderProfileAccount(profile) {
    setText('profile-microsoft-state', profileLabel('Compte Microsoft connecté', 'Microsoft account connected'));
    setText('profile-minecraft-state', getMinecraftStatusValue(profile));
    setText('profile-minecraft-username', getMinecraftUsernameValue(profile));
    setText('profile-minecraft-uuid', getMinecraftUuidValue(profile));
    const date = profile.created_at ? new Date(profile.created_at) : null;
    const locale = window.NamelessI18n ? window.NamelessI18n.getLocale() : profileIsEnglish() ? 'en-GB' : 'fr-FR';
    setText('profile-created', date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : profileLabel('Date inconnue', 'Unknown date'));
}

// Obtenir le label du role en francais.
function getRoleLabel(role) {
    const labels = {
        'joueur': profileLabel('Joueur', 'Player'),
        'membre': profileLabel('Membre', 'Member'),
        'admin': profileLabel('Administrateur', 'Administrator')
    };
    return labels[role] || labels.joueur;
}

// Sauvegarder les modifications du profil
async function saveProfileChanges() {
    const token = profileInitToken;
    const saveBtn = document.getElementById('save-profile-btn');
    if (!saveBtn || saveBtn.disabled) return;
    try {
        const classSelect = document.getElementById('profile-classe');
        const levelInput = document.getElementById('profile-niveau');
        const classe = classSelect.value;
        const niveau = Number(levelInput.value);
        classSelect.removeAttribute('aria-invalid');
        levelInput.removeAttribute('aria-invalid');
        
        // Valider le niveau
        if (!Number.isInteger(niveau) || niveau < 1 || niveau > 100) {
            levelInput.setAttribute('aria-invalid', 'true');
            levelInput.focus();
            showError('Le niveau doit être entre 1 et 100.');
            return;
        }
        
        const unchangedClass = !!classe && localUserProfile && classe === localUserProfile.classe;
        if (!unchangedClass && !PROFILE_CLASSES.includes(classe)) { classSelect.setAttribute('aria-invalid', 'true'); classSelect.focus(); showError('Choisissez une classe valide.'); return; }
        if (!window.currentUser) { showError('Reconnectez-vous pour sauvegarder votre profil.'); return; }
        const userId = window.currentUser.id;
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
        saveBtn.textContent = profileLabel('Sauvegarde…', 'Saving…');
        const changes = { niveau: niveau };
        if (!unchangedClass) changes.classe = classe;
        // Mettre à jour le profil
        const { error } = await supabase
            .from('user_profiles')
            .update(changes)
            .eq('id', userId);

        if (token !== profileInitToken || !window.currentUser || window.currentUser.id !== userId) return;
        
        if (error) {
            showError('Impossible de sauvegarder vos modifications.');
            return;
        }
        
        showSuccess('Modifications sauvegardées avec succès !');
        
        // Invalider le cache du profil
        if (window.cacheManager) {
            window.cacheManager.invalidate(`user_profile_${window.currentUser.id}`);
            window.cacheManager.invalidate('all_users'); // Aussi invalider la liste complète
        }
        
        // Recharger le profil
        await loadProfilePage(token);
        
    } catch (error) {
        if (token === profileInitToken) showError('Une erreur technique est survenue.');
    } finally {
        if (token === profileInitToken) {
            saveBtn.disabled = false;
            saveBtn.removeAttribute('aria-busy');
            saveBtn.textContent = profileLabel('Sauvegarder les modifications', 'Save changes');
        }
    }
}

// Afficher un message d'erreur
function showError(message) {
    // Masquer le loading spinner si présent
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    
    const feedback = document.getElementById('profile-feedback');
    if (feedback) { setProfileMessage('profile-feedback', message); feedback.className = 'profile-feedback error'; }
    const content = document.getElementById('profil-content');
    if (!content || content.style.display === 'none') {
        const errorContent = document.getElementById('error-content');
        const errorText = document.getElementById('error-text');
        if (errorText) setProfileMessage('error-text', message);
        if (errorContent) errorContent.style.display = 'block';
        const signedIn = !!window.currentUser;
        setElementDisplay('profile-login-btn', signedIn ? 'none' : 'inline-flex');
        setElementDisplay('profile-retry-btn', signedIn ? 'flex' : 'none');
        const title = document.getElementById('profile-error-title');
        if (title) {
            title.dataset.profileFr = signedIn ? 'Profil indisponible' : 'Retrouvez votre personnage';
            title.dataset.profileEn = signedIn ? 'Profile unavailable' : 'Return to your character';
            title.textContent = profileLabel(title.dataset.profileFr, title.dataset.profileEn);
        }
    }
}

// Afficher un message de succès
function showSuccess(message) {
    const feedback = document.getElementById('profile-feedback');
    if (feedback) { setProfileMessage('profile-feedback', message); feedback.className = 'profile-feedback success'; }
}

})();
