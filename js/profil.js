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
        window.NamelessSpaRouter.navigate('/pages/connexion.html');
        return;
    }

    window.location.href = 'connexion.html';
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
        
        // Récupérer le profil depuis user_profiles
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .single();
            
        if (error) {
            showError('Impossible de charger votre profil. Veuillez réessayer.');
            return;
        }
        
        if (!profile) {
            showError('Votre profil n\'existe pas encore. Contactez un administrateur.');
            return;
        }
        
        localUserProfile = profile;
        
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
    
    // Afficher le pseudo Minecraft et l'avatar
    var mcUsername = profile.minecraft_username || profile.username || 'Inconnu';
    document.getElementById('profile-username').textContent = mcUsername;
    document.getElementById('profile-email').textContent = window.currentUser.email || 'Inconnu';
    
    // Afficher l'avatar Minecraft si le compte est lié
    if (profile.minecraft_uuid) {
        var avatarSection = document.getElementById('mc-avatar-section');
        var avatarImg = document.getElementById('mc-avatar-img');
        var displayNameEl = document.getElementById('mc-display-name');
        var titleFallback = document.getElementById('profil-title-fallback');
        
        if (avatarSection && avatarImg) {
            // uuid encodé (donnée Supabase non fiable) avant construction de l'URL
            avatarImg.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(profile.minecraft_uuid) + '/128';
            avatarImg.alt = mcUsername;
            if (displayNameEl) displayNameEl.textContent = mcUsername;
            avatarSection.style.display = 'flex';
            if (titleFallback) titleFallback.style.display = 'none';
        }
    }
    
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
    
    // Charger les statistiques avec le vrai niveau
    loadStats(profile);
}

// Obtenir le label du rôle en français
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

// Charger les statistiques avec les vraies données du profil
function loadStats(profile) {
    // Afficher le vrai niveau de l'utilisateur
    document.getElementById('stat-messages').textContent = '0';
    document.getElementById('stat-items').textContent = '0';
    document.getElementById('stat-level').textContent = profile.niveau || 1;
    
    // TODO: Implémenter la récupération des vraies statistiques
    // - Compter les messages dans la table mailbox
    // - Compter les items possédés
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

