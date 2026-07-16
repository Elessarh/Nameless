/* profil.js - Gestion de la page profil utilisateur */

// Variables locales (currentUser et userProfile sont globaux depuis auth-supabase.js)
let localUserProfile = null;
let profileInitToken = 0;
const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const MINECRAFT_UUID_PATTERN = /^[0-9a-f]{32}$/i;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async function() {
    
    // Attendre que auth-supabase.js soit chargé ET que l'utilisateur soit connecté
    await waitForAuthAndUser();
    
    // Charger le profil
    await loadProfilePage();
});

// Attendre que l'authentification soit prête ET que l'utilisateur soit connecté
async function initProfilePage() {
    const token = ++profileInitToken;

    await waitForAuthAndUser();

    if (token !== profileInitToken) return;
    await loadProfilePage();
}

function destroyProfilePage() {
    profileInitToken++;
    localUserProfile = null;
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

function waitForAuthAndUser() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 secondes max
        
        const checkAuth = setInterval(() => {
            attempts++;
            
            // Vérifier que Supabase ET window.currentUser sont prêts
            if (typeof supabase !== 'undefined' && supabase !== null && window.currentUser !== null && window.currentUser !== undefined) {
                clearInterval(checkAuth);
                resolve();
            } else if ((window.namelessAuthReady && !window.currentUser) || attempts >= maxAttempts) {
                clearInterval(checkAuth);
                showError('Vous devez être connecté pour voir votre profil.');
                setTimeout(() => {
                    navigateToConnexion();
                }, 2000);
                resolve();
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

function getDefaultUsername() {
    var userId = window.currentUser && window.currentUser.id ? String(window.currentUser.id).replace(/-/g, '') : '';
    var suffix = userId ? userId.substring(0, 6) : Math.random().toString(36).substring(2, 8);
    return 'Joueur_' + suffix;
}

function getMinecraftDisplayName(profile) {
    if (!profile) return 'Compte Microsoft connecté';
    if (profile.minecraft_username) return profile.minecraft_username;
    if (profile.minecraft_uuid) return 'Minecraft détecté';
    return 'Compte Microsoft connecté';
}

function getMinecraftUsernameValue(profile) {
    if (!profile) return 'Non renseigné';
    return profile.minecraft_username || 'Non renseigné';
}

function getMinecraftUuidValue(profile) {
    if (!profile) return 'Non renseigné';
    return profile.minecraft_uuid || 'Non renseigné';
}

function hasMinecraftIdentity(profile) {
    return !!(profile && profile.minecraft_uuid);
}

function getMinecraftStatusValue(profile) {
    // Il n'existe pas de vérification officielle Microsoft -> Minecraft :
    // seul le profil public compte. Deux états : détecté ou non lié.
    if (hasMinecraftIdentity(profile)) return 'Minecraft détecté';
    return 'Minecraft non lié';
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
        if (titleFallback) titleFallback.style.display = 'block';
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
    setText('minecraft-link-status', message);
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
        button.textContent = isBusy ? 'Association...' : 'Associer ce pseudo';
    }
}

function getPlayerDbErrorCode(data) {
    if (!data || typeof data !== 'object') return '';
    return String(data.code || data.error || '').toLowerCase();
}

async function fetchPublicMinecraftProfile(username) {
    var response;
    var data = null;

    try {
        response = await fetch('https://playerdb.co/api/player/minecraft/' + encodeURIComponent(username), {
            headers: { Accept: 'application/json' }
        });
    } catch (error) {
        throw { code: 'public_api_unavailable' };
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

async function saveDetectedMinecraftProfile(minecraftProfile) {
    var { data, error } = await supabase
        .from('user_profiles')
        .update({
            minecraft_username: minecraftProfile.username,
            minecraft_uuid: minecraftProfile.uuid,
            minecraft_verified: false,
            minecraft_linked_at: new Date().toISOString()
        })
        .eq('id', window.currentUser.id)
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
        return 'La base Supabase bloque encore l’association publique. Applique le patch Minecraft public avant de réessayer.';
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
        setMinecraftLinkStatus('Profil public trouvé. Sauvegarde en cours...');

        var updatedProfile = await saveDetectedMinecraftProfile(minecraftProfile);
        localUserProfile = updatedProfile;
        window.userProfile = updatedProfile;
        invalidateProfileCache();
        displayProfile(updatedProfile);
        showSuccess('Minecraft détecté : profil public associé à ton compte.');
    } catch (error) {
        setMinecraftLinkStatus(getMinecraftPublicLinkErrorMessage(error));
    } finally {
        setMinecraftLinkBusy(false);
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

async function fetchOwnProfile() {
    var query = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', window.currentUser.id);

    if (typeof query.maybeSingle === 'function') {
        return await query.maybeSingle();
    }

    return await query.single();
}

async function createOwnPlayerProfile() {
    var result = await supabase
        .from('user_profiles')
        .insert([{
            id: window.currentUser.id,
            username: getDefaultUsername(),
            role: 'joueur'
        }])
        .select('*')
        .single();

    if (!result.error) return result.data;

    if (result.error.code === '23505') {
        var retry = await fetchOwnProfile();
        if (!retry.error && retry.data) return retry.data;
    }

    throw result.error;
}

async function resolveOwnProfile() {
    var result = await fetchOwnProfile();

    if (!result.error && result.data) return result.data;

    if (!result.error || isMissingProfileError(result.error)) {
        return await createOwnPlayerProfile();
    }

    throw result.error;
}

async function loadProfilePage() {
    try {
        // Double vérification
        if (!window.currentUser) {
            showError('Vous devez être connecté pour voir votre profil.');
            setTimeout(() => {
                navigateToConnexion();
            }, 2000);
            return;
        }
        
        
        // Essayer de charger depuis le cache d'abord
        const cacheKey = `user_profile_${window.currentUser.id}`;
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
            profile = await resolveOwnProfile();
        } catch (error) {
            showError('Impossible de charger votre profil. Veuillez reessayer.');
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
        showError('Une erreur technique est survenue.');
    }
}

// Afficher le profil dans l'interface
function displayProfile(profile) {
    // Masquer le loading
    document.getElementById('loading').style.display = 'none';
    
    // Afficher le contenu
    document.getElementById('profil-content').style.display = 'block';
    
    // Afficher uniquement l'identite Minecraft publique.
    var mcUsername = getMinecraftDisplayName(profile);
    var avatarKey = getMinecraftAvatarKey(profile);
    var avatarSection = document.getElementById('mc-avatar-section');
    var avatarImg = document.getElementById('mc-avatar-img');
    var displayNameEl = document.getElementById('mc-display-name');
    var titleFallback = document.getElementById('profil-title-fallback');

    var hasMinecraftProfile = hasMinecraftIdentity(profile);

    setText('profile-microsoft-state', 'Compte Microsoft connecté');
    setText('profile-minecraft-state', getMinecraftStatusValue(profile));
    setText('profile-minecraft-username', getMinecraftUsernameValue(profile));
    setText('profile-minecraft-uuid', getMinecraftUuidValue(profile));
    if (displayNameEl) displayNameEl.textContent = mcUsername;
    if (titleFallback) titleFallback.style.display = 'none';

    if (avatarSection && avatarImg && hasMinecraftProfile) {
        bindMinecraftAvatarFallback(avatarSection, avatarImg, titleFallback);
        avatarImg.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(avatarKey) + '/128';
        avatarImg.alt = mcUsername;
        avatarSection.style.display = 'flex';
    } else if (avatarSection && avatarImg) {
        avatarImg.removeAttribute('src');
        avatarImg.alt = '';
        avatarSection.style.display = 'none';
    }

    setElementDisplay('minecraft-link-info', hasMinecraftProfile ? 'none' : 'block');
    prepareMinecraftPublicLink(profile, hasMinecraftProfile);

    // Afficher le rôle avec le bon badge
    const roleBadge = document.getElementById('profile-role');
    const role = (profile.role || 'joueur').trim(); // Nettoyer les espaces
    
    roleBadge.textContent = getRoleLabel(role);
    roleBadge.className = 'role-badge role-' + role;
    
    // Afficher classe et niveau
    document.getElementById('profile-classe').value = profile.classe || 'Guerrier';
    document.getElementById('profile-niveau').value = profile.niveau || 1;
    
    // Afficher le bouton Dashboard si admin
    const dashboardBtn = document.getElementById('dashboard-btn');
    
    if (dashboardBtn) {
        if (role === 'admin') {
            dashboardBtn.style.setProperty('display', 'inline-block', 'important');
        } else {
            dashboardBtn.style.setProperty('display', 'none', 'important');
        }
    }
    
    // Afficher le bouton Guilde si membre ou admin
    const guildeBtn = document.getElementById('guilde-btn');
    
    if (guildeBtn) {
        if (role === 'membre' || role === 'admin') {
            guildeBtn.style.setProperty('display', 'inline-block', 'important');
        } else {
            guildeBtn.style.setProperty('display', 'none', 'important');
        }
    }
    
    // Formater la date de création
    if (profile.created_at) {
        const date = new Date(profile.created_at);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('profile-created').textContent = date.toLocaleDateString(window.NamelessI18n ? window.NamelessI18n.getLocale() : 'fr-FR', options);
    } else {
        document.getElementById('profile-created').textContent = 'Date inconnue';
    }
    
    // Ajouter l'event listener pour le bouton de sauvegarde
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn && saveBtn.dataset.profileSaveBound !== 'true') {
        saveBtn.addEventListener('click', saveProfileChanges);
        saveBtn.dataset.profileSaveBound = 'true';
    }
    
}

// Obtenir le label du role en francais.
function getRoleLabel(role) {
    const labels = {
        'joueur': 'Joueur',
        'membre': 'Membre',
        'admin': 'Administrateur'
    };
    return labels[role] || 'Joueur';
}

// Sauvegarder les modifications du profil
async function saveProfileChanges() {
    try {
        const classe = document.getElementById('profile-classe').value;
        const niveau = parseInt(document.getElementById('profile-niveau').value);
        
        // Valider le niveau
        if (niveau < 1 || niveau > 100) {
            showError('Le niveau doit être entre 1 et 100.');
            return;
        }
        
        // Mettre à jour le profil
        const { error } = await supabase
            .from('user_profiles')
            .update({ 
                classe: classe,
                niveau: niveau
            })
            .eq('id', window.currentUser.id);
        
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
        await loadProfilePage();
        
    } catch (error) {
        showError('Une erreur technique est survenue.');
    }
}

// Afficher un message d'erreur
function showError(message) {
    // Masquer le loading spinner si présent
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    
    alert('❌ ' + message);
}

// Afficher un message de succès
function showSuccess(message) {
    alert('✅ ' + message);
}

// Fonction utilitaire pour formater les dates
function formatDate(dateString) {
    if (!dateString) return 'Inconnue';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
    return `Il y a ${Math.floor(diffDays / 365)} ans`;
}
