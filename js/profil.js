/* profil.js - Gestion de la page profil utilisateur */

// Variables locales (currentUser et userProfile sont globaux depuis auth-supabase.js)
let localUserProfile = null;
let profileInitToken = 0;
const MINECRAFT_AUTO_LINK_ATTEMPT_PREFIX = 'namelessMinecraftAutoLinkAttempt:';

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
            } else if (attempts >= maxAttempts) {
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
    return profile && profile.minecraft_username ? profile.minecraft_username : 'Compte Microsoft connecté';
}

function getMinecraftProfileValue(profile) {
    return profile && profile.minecraft_username ? profile.minecraft_username : 'Minecraft non lié';
}

function getMinecraftAvatarKey(profile) {
    if (!profile) return '';
    return profile.minecraft_uuid || profile.minecraft_username || '';
}

function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setElementDisplay(id, displayValue) {
    var element = document.getElementById(id);
    if (element) element.style.display = displayValue;
}

function getMinecraftLinkState() {
    try {
        return new URLSearchParams(window.location.search).get('minecraft_link') || '';
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

function getMinecraftAttemptKey(profile) {
    var userId = window.currentUser && window.currentUser.id ? window.currentUser.id : profile && profile.id;
    return MINECRAFT_AUTO_LINK_ATTEMPT_PREFIX + (userId || 'anonymous');
}

function getStoredMinecraftAttempt(key) {
    try {
        return window.sessionStorage ? window.sessionStorage.getItem(key) : null;
    } catch (error) {
        return null;
    }
}

function setStoredMinecraftAttempt(key) {
    try {
        if (window.sessionStorage) window.sessionStorage.setItem(key, String(Date.now()));
    } catch (error) {
        // Storage can be unavailable in hardened browser contexts.
    }
}

function clearStoredMinecraftAttempt(key) {
    try {
        if (window.sessionStorage) window.sessionStorage.removeItem(key);
    } catch (error) {
        // Storage can be unavailable in hardened browser contexts.
    }
}

function getMinecraftReturnUrl() {
    var url = new URL(window.location.href);
    url.searchParams.set('minecraft_link', 'return');
    url.hash = '';
    return url.toString();
}

function explainMinecraftLinkState(state) {
    switch (state) {
        case 'success':
            return 'Liaison Minecraft terminée. Rechargement du profil...';
        case 'not_found':
            return 'Aucun profil Minecraft Java vérifiable n’a été trouvé pour ce compte Microsoft.';
        case 'denied':
            return 'Autorisation Minecraft refusée. La liaison automatique réessaiera lors d’une prochaine session.';
        case 'unavailable':
        case 'error':
            return 'Liaison Minecraft automatique indisponible pour le moment.';
        case 'return':
            return 'Vérification Minecraft en cours de synchronisation...';
        default:
            return 'Liaison Minecraft automatique en cours...';
    }
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

    var hasMinecraftProfile = !!(profile.minecraft_username && avatarKey);

    setText('profile-microsoft-state', 'Compte Microsoft connecté');
    setText('profile-minecraft-state', getMinecraftProfileValue(profile));
    if (displayNameEl) displayNameEl.textContent = mcUsername;
    if (titleFallback) titleFallback.style.display = 'none';

    if (avatarSection && avatarImg && hasMinecraftProfile) {
        avatarImg.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(avatarKey) + '/128';
        avatarImg.alt = mcUsername;
        avatarSection.style.display = 'flex';
    } else if (avatarSection && avatarImg) {
        avatarImg.removeAttribute('src');
        avatarImg.alt = '';
        avatarSection.style.display = 'none';
    }

    
    setElementDisplay('minecraft-link-info', hasMinecraftProfile ? 'none' : 'block');
    startAutomaticMinecraftLink(profile, hasMinecraftProfile);

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
        document.getElementById('profile-created').textContent = date.toLocaleDateString('fr-FR', options);
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

async function startAutomaticMinecraftLink(profile, hasMinecraftProfile) {
    if (hasMinecraftProfile) {
        clearStoredMinecraftAttempt(getMinecraftAttemptKey(profile));
        return;
    }

    var state = getMinecraftLinkState();
    var attemptKey = getMinecraftAttemptKey(profile);

    if (state) {
        setMinecraftLinkStatus(explainMinecraftLinkState(state));
        return;
    }

    if (getStoredMinecraftAttempt(attemptKey)) {
        setMinecraftLinkStatus('Liaison Minecraft automatique déjà lancée pour cette session.');
        return;
    }

    if (typeof supabase === 'undefined' || !supabase || !supabase.functions || typeof supabase.functions.invoke !== 'function') {
        setMinecraftLinkStatus('Liaison Minecraft automatique indisponible pour le moment.');
        return;
    }

    setStoredMinecraftAttempt(attemptKey);
    setMinecraftLinkStatus('Liaison Minecraft automatique en cours...');

    try {
        var response = await supabase.functions.invoke('link-minecraft', {
            body: {
                action: 'start',
                returnTo: getMinecraftReturnUrl()
            }
        });

        if (response.error || !response.data || !response.data.url) {
            clearStoredMinecraftAttempt(attemptKey);
            setMinecraftLinkStatus('Liaison Minecraft automatique indisponible pour le moment.');
            return;
        }

        window.location.assign(response.data.url);
    } catch (error) {
        clearStoredMinecraftAttempt(attemptKey);
        setMinecraftLinkStatus('Liaison Minecraft automatique indisponible pour le moment.');
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

