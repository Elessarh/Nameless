/* profil.js - Gestion de la page profil utilisateur */

// Variables locales (currentUser et userProfile sont globaux depuis auth-supabase.js)
let localUserProfile = null;
let profileInitToken = 0;

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
    return profile && profile.minecraft_username ? profile.minecraft_username : 'Pseudo Minecraft a lier';
}

function getMinecraftProfileValue(profile) {
    return profile && profile.minecraft_username ? profile.minecraft_username : 'Non lie';
}

function getMinecraftAvatarKey(profile) {
    if (!profile) return '';
    return profile.minecraft_uuid || profile.minecraft_username || '';
}

function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
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
        const cachedProfile = window.cacheManager?.get(cacheKey);
        
        if (cachedProfile) {
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
    var minecraftLinkPanel = document.getElementById('minecraft-link-panel');

    setText('profile-username', getMinecraftProfileValue(profile));
    if (displayNameEl) displayNameEl.textContent = mcUsername;
    if (titleFallback) titleFallback.style.display = 'none';

    if (avatarSection && avatarImg && avatarKey) {
        avatarImg.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(avatarKey) + '/128';
        avatarImg.alt = mcUsername;
        avatarSection.style.display = 'flex';
    } else if (avatarSection && avatarImg) {
        avatarImg.removeAttribute('src');
        avatarImg.alt = '';
        avatarSection.style.display = 'none';
    }

    if (minecraftLinkPanel) {
        minecraftLinkPanel.style.display = profile.minecraft_username && avatarKey ? 'none' : 'block';
    }
    bindMinecraftLinkForm();
    
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

// Gerer la liaison Minecraft depuis la fiche profil.
function setMinecraftStatus(message, type) {
    var status = document.getElementById('profile-mc-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'profile-mc-status' + (type ? ' ' + type : '');
}

function setMinecraftPreview(username, uuid) {
    var preview = document.getElementById('profile-mc-preview');
    if (!preview) return;

    if (!username || !uuid) {
        preview.replaceChildren();
        return;
    }

    var img = document.createElement('img');
    img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(uuid) + '/64';
    img.alt = username;
    img.width = 64;
    img.height = 64;

    var name = document.createElement('span');
    name.textContent = username;

    preview.replaceChildren(img, name);
}

async function handleProfileMinecraftLink(event) {
    if (event) event.preventDefault();

    var input = document.getElementById('profile-mc-username');
    var button = document.getElementById('profile-mc-link-btn');
    var username = input ? input.value.trim() : '';

    if (!username) {
        setMinecraftStatus('Entre ton pseudo Minecraft.', 'error');
        return;
    }

    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
        setMinecraftStatus('Pseudo Minecraft invalide.', 'error');
        return;
    }

    if (typeof window.verifyMinecraftUsername !== 'function' || typeof window.linkMinecraftAccount !== 'function') {
        setMinecraftStatus('Verification Minecraft indisponible pour le moment.', 'error');
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = 'Verification...';
    }
    setMinecraftStatus('');

    try {
        var result = await window.verifyMinecraftUsername(username);
        if (!result || !result.valid) {
            setMinecraftPreview('', '');
            setMinecraftStatus('Pseudo Minecraft introuvable.', 'error');
            return;
        }

        setMinecraftPreview(result.username, result.uuid);
        var linked = await window.linkMinecraftAccount(result.username, result.uuid);

        if (!linked) {
            setMinecraftStatus('Impossible de lier ce compte Minecraft.', 'error');
            return;
        }

        if (localUserProfile) {
            localUserProfile.username = result.username;
            localUserProfile.minecraft_username = result.username;
            localUserProfile.minecraft_uuid = result.uuid;
            window.userProfile = localUserProfile;
        }

        if (window.cacheManager && window.currentUser) {
            window.cacheManager.invalidate(`user_profile_${window.currentUser.id}`);
            window.cacheManager.invalidate('all_users');
        }

        setMinecraftStatus('Compte Minecraft lie.', 'success');
        if (input) input.value = '';
        if (localUserProfile) displayProfile(localUserProfile);
    } catch (error) {
        setMinecraftStatus('Erreur technique pendant la verification.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Lier le compte';
        }
    }
}

function bindMinecraftLinkForm() {
    var form = document.getElementById('profile-mc-link-form');
    if (!form || form.dataset.profileMcBound === 'true') return;
    form.addEventListener('submit', handleProfileMinecraftLink);
    form.dataset.profileMcBound = 'true';
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

