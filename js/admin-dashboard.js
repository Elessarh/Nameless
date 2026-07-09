/* admin-dashboard.js - Gestion du dashboard administrateur */

// Variables locales (currentUser est global depuis auth-supabase.js)
let localCurrentUser = null;
let currentUserProfile = null;
let allUsers = [];
let filteredUsers = [];
let editingUserId = null;
let adminInitToken = 0;

// Variables de pagination et tri
let adminUsersPage = 1;
let usersPerPage = 15;
let currentSortField = 'created_at';
let currentSortDirection = 'desc'; // 'asc' ou 'desc'

// Fonction de gestion des onglets du dashboard
function switchDashboardTab(tabName) {
    
    // Retirer la classe active de tous les boutons et contenus
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Ajouter la classe active au bouton et contenu correspondants
    const activeButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const activeContent = document.querySelector(`.tab-content[data-tab-content="${tabName}"]`);
    
    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    // Charger les données spécifiques à l'onglet
    if (tabName === 'activity') {
        loadAdminActivities();
    }
    
    // Sauvegarder l'onglet actif dans localStorage
    localStorage.setItem('dashboardActiveTab', tabName);
}

// Initialisation au chargement de la page
async function initAdminDashboardPage() {
    const token = ++adminInitToken;
    
    // Attendre que auth-supabase.js soit chargé ET que l'utilisateur soit connecté
    await waitForAdminAuth();
    if (token !== adminInitToken) return;
    
    // Vérifier les droits admin
    await checkAdminAccess();
}

function destroyAdminDashboardPage() {
    adminInitToken++;
    localCurrentUser = null;
    currentUserProfile = null;
}

window.NamelessAdminDashboardPage = {
    init: initAdminDashboardPage,
    destroy: destroyAdminDashboardPage
};

// Initialisation au chargement de la page hors SPA.
document.addEventListener('DOMContentLoaded', initAdminDashboardPage);

function navigateAdminToConnexion() {
    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
        window.NamelessSpaRouter.navigate('/connexion');
        return;
    }

    window.location.href = '/connexion';
}

// Attendre que l'authentification soit prête ET que l'utilisateur soit connecté
function waitForAdminAuth() {
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
                showAdminError('Vous devez être connecté pour accéder au dashboard.');
                setTimeout(navigateAdminToConnexion, 2000);
                resolve();
            }
        }, 100);
    });
}

// Vérifier que l'utilisateur est admin
function logSupabaseWarning(scope, error) {
    if (!error) return;
    console.warn('[Nameless admin]', scope, {
        code: error.code || null,
        message: error.message || String(error)
    });
}

async function getCurrentUserRole() {
    const { data, error } = await supabase.rpc('current_user_role');
    if (error) {
        logSupabaseWarning('current_user_role_failed', error);
        throw error;
    }

    return String(data || '').trim();
}

async function checkAdminAccess() {
    try {
        // Utiliser la session globale depuis auth-supabase.js
        if (!window.currentUser) {
            showAdminError('Vous devez être connecté pour accéder au dashboard.');
            setTimeout(navigateAdminToConnexion, 2000);
            return;
        }

        localCurrentUser = window.currentUser;
        
        // Récupérer le profil et vérifier le rôle
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', localCurrentUser.id)
            .single();
            
        if (error || !profile) {
            logSupabaseWarning('admin_profile_failed', error);
            showAdminError('Profil introuvable. Impossible de vérifier vos droits d\'accès.');
            return;
        }
        
        currentUserProfile = profile;
        const effectiveRole = await getCurrentUserRole();
        
        // Vérifier si l'utilisateur est admin
        if (effectiveRole !== 'admin') {
            showAdminError('Accès admin requis. Rôle admin non détecté côté Supabase.');
            return;
        }
        
        
        // Afficher le dashboard
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        
        // Charger les données
        await loadUsers();
        await loadPresences();
        await loadMembersForPresence(); // Charger la liste des membres pour le formulaire de présence
        
        // Initialiser les event listeners
        initializeEventListeners();
        bindAdminGuildForms();
        bindAdminActivityForm();
        
        // Charger les activités si l'onglet est actif ou pré-charger
        const savedTab = localStorage.getItem('dashboardActiveTab');
        if (savedTab === 'activity') {
            await loadAdminActivities();
        }
        
        // Restaurer l'onglet actif depuis localStorage
        if (savedTab) {
            switchDashboardTab(savedTab);
        }
        
    } catch (error) {
        logSupabaseWarning('admin_access_failed', error);
        showAdminError('Erreur Supabase : voir console.');
    }
}

// ========== ACTIONS ADMIN SÉCURISÉES (Edge Function) ==========
// Toutes les actions sensibles (rôle, vérification Minecraft, suppression)
// passent par l'Edge Function admin-user-actions qui revérifie le JWT et le
// rôle admin côté serveur. Aucune écriture directe sensible depuis le front.

async function callAdminAction(payload) {
    const { data, error } = await supabase.functions.invoke('admin-user-actions', {
        body: payload
    });

    if (error) {
        let code = '';
        try {
            if (error.context && typeof error.context.json === 'function') {
                const body = await error.context.json();
                code = body && body.error ? String(body.error) : '';
            }
        } catch (parseError) {
            // Réponse non JSON : on garde le code générique.
        }
        logSupabaseWarning('admin_action_failed', { code: code || null, message: error.message });
        throw { code: code || 'edge_function_error' };
    }

    if (data && data.error) {
        logSupabaseWarning('admin_action_failed', { code: data.error, message: null });
        throw { code: String(data.error) };
    }

    return data;
}

function getAdminActionErrorMessage(error) {
    const code = error && error.code ? String(error.code) : '';
    const messages = {
        'admin_required': 'Action refusée : rôle admin non détecté côté Supabase.',
        'missing_user_session': 'Session expirée. Reconnecte-toi.',
        'invalid_user_session': 'Session invalide. Reconnecte-toi.',
        'invalid_target_user_id': 'Identifiant de joueur invalide.',
        'invalid_role': 'Rôle invalide.',
        'invalid_verified_flag': 'Valeur de vérification invalide.',
        'minecraft_not_linked': 'Ce joueur n\'a pas encore associé de pseudo Minecraft.',
        'target_not_found': 'Joueur introuvable.',
        'self_demote_requires_confirmation': 'Confirme explicitement le retrait de ton propre rôle admin.',
        'self_delete_requires_confirmation': 'Confirme explicitement la suppression de ton propre compte.',
        'cannot_remove_last_admin': 'Impossible : c\'est le dernier admin du site.',
        'cannot_delete_last_admin': 'Impossible : c\'est le dernier admin du site.',
        'auth_delete_blocked_by_storage': 'Suppression Auth bloquée par Storage ownership. Purger les fichiers du joueur puis réessayer.',
        'missing_env': 'Edge Function non configurée (SERVICE_ROLE_KEY manquant côté Supabase).',
        'edge_function_error': 'Edge Function admin-user-actions injoignable. Est-elle déployée ?'
    };
    return messages[code] || ('Action admin échouée' + (code ? ' (' + code + ')' : '') + '.');
}

function setActionButtonBusy(button, isBusy, busyText) {
    if (!button) return;
    if (isBusy) {
        button.dataset.originalText = button.textContent;
        button.textContent = busyText || 'En cours...';
        button.disabled = true;
    } else {
        if (button.dataset.originalText) button.textContent = button.dataset.originalText;
        button.disabled = false;
    }
}

async function refreshUsersAfterAdminAction() {
    if (window.cacheManager) {
        window.cacheManager.invalidate('all_users');
    }
    await loadUsers();
    await loadMembersForPresence();
}

function getMinecraftStatusInfo(user) {
    if (!user || !user.minecraft_uuid) {
        return { label: 'Non lié', className: 'mc-status mc-status-none' };
    }
    if (user.minecraft_verified === true) {
        return { label: 'Minecraft vérifié', className: 'mc-status mc-status-verified' };
    }
    return { label: 'Minecraft détecté', className: 'mc-status mc-status-detected' };
}

async function setMinecraftVerified(user, verified, button) {
    const displayName = user.minecraft_username || user.username || 'ce joueur';
    const question = verified
        ? 'Marquer le compte Minecraft de "' + displayName + '" comme vérifié ?'
        : 'Retirer la vérification Minecraft de "' + displayName + '" ?';
    if (!confirm(question)) return;

    setActionButtonBusy(button, true, verified ? 'Vérification...' : 'Retrait...');
    try {
        await callAdminAction({
            action: 'set_minecraft_verified',
            target_user_id: user.id,
            verified: verified
        });
        await refreshUsersAfterAdminAction();
    } catch (error) {
        alert(getAdminActionErrorMessage(error));
        setActionButtonBusy(button, false);
    }
}

async function secureDeleteUser(user, button) {
    const displayName = user.minecraft_username || user.username || user.id;
    const answer = prompt(
        'Supprimer définitivement "' + displayName + '" ?\n\n' +
        'Supprime le compte Supabase Auth et les données de profil liées ' +
        '(profil, rôles, présences, messages). Action irréversible.\n\n' +
        'Tape SUPPRIMER pour confirmer :'
    );
    if (answer === null) return;
    if (answer.trim() !== 'SUPPRIMER') {
        alert('Suppression annulée : confirmation incorrecte.');
        return;
    }

    const payload = {
        action: 'delete_user',
        target_user_id: user.id
    };
    if (user.id === localCurrentUser.id) {
        if (!confirm('ATTENTION : tu es en train de supprimer TON PROPRE compte admin. Continuer ?')) return;
        payload.confirm_self_delete = true;
    }

    setActionButtonBusy(button, true, 'Suppression...');
    try {
        await callAdminAction(payload);
        alert('Compte supprimé.');
        await refreshUsersAfterAdminAction();
    } catch (error) {
        alert(getAdminActionErrorMessage(error));
        setActionButtonBusy(button, false);
    }
}

// Helper : générer le HTML d'une tête Minecraft (avec avatar par défaut)
function mcHeadHtml(user, size) {
    // size numérique + uuid encodé pour l'URL: empêche tout breakout d'attribut
    // via un minecraft_uuid piégé (l'admin affiche tous les profils).
    size = parseInt(size, 10) || 22;
    if (user && user.minecraft_uuid) {
        return '<img src="https://mc-heads.net/avatar/' + encodeURIComponent(user.minecraft_uuid) + '/' + size + '" ' +
            'class="mc-head-dashboard" alt="" width="' + size + '" height="' + size + '" loading="lazy"> ';
    }
    // Avatar par défaut (Steve) quand pas de compte MC lié
    return '<img src="https://mc-heads.net/avatar/MHF_Steve/' + size + '" ' +
        'class="mc-head-dashboard mc-head-default" alt="" width="' + size + '" height="' + size + '" loading="lazy"> ';
}

// Charger tous les utilisateurs
async function loadUsers() {
    try {
        // Utiliser le cache pour éviter les requêtes multiples
        const cachedUsers = window.cacheManager?.get('all_users');
        if (cachedUsers) {
            allUsers = cachedUsers;
            filteredUsers = allUsers;
            updateStats();
            displayUsers();
            return;
        }

        const { data: users, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            logSupabaseWarning('users_load_failed', error);
            showAdminError('Impossible de charger les utilisateurs.');
            return;
        }

        allUsers = users || [];
        filteredUsers = allUsers;
        
        // Mettre en cache pour 3 minutes
        if (window.cacheManager) {
            window.cacheManager.set('all_users', allUsers);
        }
        
        
        // Mettre à jour les statistiques
        updateStats();
        
        // Afficher les utilisateurs
        displayUsers();

    } catch (error) {
        logSupabaseWarning('users_load_failed', error);
        showAdminError('Erreur technique lors du chargement des utilisateurs.');
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const totalUsers = allUsers.length;
    const admins = allUsers.filter(u => u.role === 'admin').length;
    const membres = allUsers.filter(u => u.role === 'membre').length;
    const joueurs = allUsers.filter(u => u.role === 'joueur' || !u.role).length;
    
    document.getElementById('stat-total-users').textContent = totalUsers;
    document.getElementById('stat-admins').textContent = admins;
    document.getElementById('stat-membres').textContent = membres;
    document.getElementById('stat-utilisateurs').textContent = joueurs;
}

// Afficher les utilisateurs dans le tableau (avec pagination)
function displayUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Aucun utilisateur trouvé</td></tr>';
        updatePagination();
        return;
    }
    
    // Calculer les indices pour la pagination
    const startIndex = (adminUsersPage - 1) * usersPerPage;
    const endIndex = Math.min(startIndex + usersPerPage, filteredUsers.length);
    const usersToDisplay = filteredUsers.slice(startIndex, endIndex);
    
    usersToDisplay.forEach(user => {
        const tr = document.createElement('tr');
        
        // Pseudo (avec tête Minecraft)
        const tdUsername = document.createElement('td');
        tdUsername.innerHTML = '<span class="mc-user-cell">' + mcHeadHtml(user) + escapeHtml(user.minecraft_username || user.username || 'Inconnu') + '</span>';
        tr.appendChild(tdUsername);
        
        // Classe
        const tdClasse = document.createElement('td');
        tdClasse.textContent = user.classe || 'Guerrier';
        tdClasse.style.fontWeight = '600';
        tdClasse.style.color = getClasseColor(user.classe);
        tr.appendChild(tdClasse);
        
        // Niveau
        const tdNiveau = document.createElement('td');
        tdNiveau.textContent = user.niveau || '1';
        tdNiveau.style.fontWeight = '700';
        tdNiveau.style.textAlign = 'center';
        tr.appendChild(tdNiveau);
        
        // Rôle
        const tdRole = document.createElement('td');
        const roleBadge = document.createElement('span');
        roleBadge.className = `role-badge role-${user.role || 'joueur'}`;
        roleBadge.textContent = getRoleLabel(user.role);
        tdRole.appendChild(roleBadge);
        tr.appendChild(tdRole);

        // Statut Minecraft (Non lié / détecté / vérifié) + UUID en title
        const tdMinecraft = document.createElement('td');
        const mcStatus = getMinecraftStatusInfo(user);
        const mcBadge = document.createElement('span');
        mcBadge.className = mcStatus.className;
        mcBadge.textContent = mcStatus.label;
        if (user.minecraft_uuid) {
            mcBadge.title = 'UUID : ' + user.minecraft_uuid;
        }
        tdMinecraft.appendChild(mcBadge);
        tr.appendChild(tdMinecraft);

        // Date de création
        const tdDate = document.createElement('td');
        tdDate.textContent = formatDate(user.created_at);
        tr.appendChild(tdDate);

        // Actions
        const tdActions = document.createElement('td');

        // Bouton Modifier
        const btnEdit = document.createElement('button');
        btnEdit.className = 'action-btn btn-edit';
        btnEdit.textContent = 'Modifier rôle';
        btnEdit.onclick = () => openRoleModal(user);
        tdActions.appendChild(btnEdit);

        // Boutons vérification Minecraft (uniquement si identité détectée)
        if (user.minecraft_uuid) {
            const btnVerify = document.createElement('button');
            btnVerify.className = 'action-btn btn-edit';
            if (user.minecraft_verified === true) {
                btnVerify.textContent = 'Retirer vérification';
                btnVerify.onclick = () => setMinecraftVerified(user, false, btnVerify);
            } else {
                btnVerify.textContent = 'Vérifier Minecraft';
                btnVerify.onclick = () => setMinecraftVerified(user, true, btnVerify);
            }
            tdActions.appendChild(btnVerify);
        }

        // Bouton Supprimer (compte Auth + données liées, via Edge Function)
        const btnDelete = document.createElement('button');
        btnDelete.className = 'action-btn btn-delete';
        btnDelete.textContent = 'Supprimer';
        btnDelete.onclick = () => secureDeleteUser(user, btnDelete);
        tdActions.appendChild(btnDelete);

        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
}

// Obtenir le label du rôle
function getRoleLabel(role) {
    const labels = {
        'joueur': 'Joueur',
        'membre': 'Membre',
        'admin': 'Administrateur'
    };
    return labels[role] || 'Joueur';
}

// Obtenir la couleur de la classe
function getClasseColor(classe) {
    const colors = {
        'Shaman': '#4ecdc4',
        'Mage': '#667eea',
        'Assassin': '#f5576c',
        'Guerrier': '#ff6b35',
        'Archer': '#45b7aa'
    };
    return colors[classe] || '#4ecdc4';
}

// Mettre à jour la pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    // Afficher les informations de page
    pageInfo.textContent = `Page ${adminUsersPage} / ${totalPages || 1} (${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? 's' : ''})`;
    
    // Activer/désactiver les boutons
    prevBtn.disabled = adminUsersPage <= 1;
    nextBtn.disabled = adminUsersPage >= totalPages || totalPages === 0;
}

// Trier les utilisateurs
function sortUsers() {
    filteredUsers.sort((a, b) => {
        let aValue = a[currentSortField];
        let bValue = b[currentSortField];
        
        // Gestion des valeurs null/undefined
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // Conversion en minuscules pour les strings
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        // Tri numérique pour le niveau
        if (currentSortField === 'niveau') {
            aValue = parseInt(aValue) || 0;
            bValue = parseInt(bValue) || 0;
        }
        
        // Tri pour les dates
        if (currentSortField === 'created_at') {
            aValue = new Date(aValue).getTime();
            bValue = new Date(bValue).getTime();
        }

        // Tri statut Minecraft : non lié (0) < détecté (1) < vérifié (2)
        if (currentSortField === 'minecraft_verified') {
            aValue = a.minecraft_uuid ? (a.minecraft_verified === true ? 2 : 1) : 0;
            bValue = b.minecraft_uuid ? (b.minecraft_verified === true ? 2 : 1) : 0;
        }
        
        // Comparaison
        if (aValue < bValue) {
            return currentSortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return currentSortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

// Formater une date
function formatDate(dateString) {
    if (!dateString) return 'Inconnue';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('fr-FR', options);
}

// Initialiser les event listeners
function initializeEventListeners() {
    // Recherche
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        adminUsersPage = 1; // Reset à la page 1 lors d'une recherche
        filterUsers();
    });
    
    // Filtre par rôle
    const roleFilter = document.getElementById('role-filter');
    roleFilter.addEventListener('change', (e) => {
        adminUsersPage = 1;
        filterUsers();
    });
    
    // Filtre par classe
    const classeFilter = document.getElementById('classe-filter');
    classeFilter.addEventListener('change', (e) => {
        adminUsersPage = 1;
        filterUsers();
    });
    
    // Filtre par niveau
    const niveauFilter = document.getElementById('niveau-filter');
    niveauFilter.addEventListener('change', (e) => {
        adminUsersPage = 1;
        filterUsers();
    });
    
    // Items per page
    const itemsPerPageSelect = document.getElementById('items-per-page');
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            usersPerPage = parseInt(e.target.value);
            adminUsersPage = 1;
            displayUsers();
            updatePagination();
        });
    }
    
    // Event listeners pour les onglets du dashboard
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchDashboardTab(tabName);
        });
    });

    // Onglets de gestion de guilde (remplace les onclick inline du HTML)
    document.querySelectorAll('.guild-tab').forEach(button => {
        if (button.dataset.guildTab) {
            button.addEventListener('click', () => switchGuildTab(button.dataset.guildTab));
        }
    });

    // Boutons du modal de rôle (remplace les onclick inline du HTML)
    document.getElementById('role-modal-cancel')?.addEventListener('click', closeRoleModal);
    document.getElementById('role-modal-confirm')?.addEventListener('click', confirmRoleChange);
    
    // Tri par colonnes
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.getAttribute('data-sort');
            
            // Si on clique sur la même colonne, inverser la direction
            if (currentSortField === sortField) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = sortField;
                currentSortDirection = 'asc';
            }
            
            // Mettre à jour les classes CSS
            sortableHeaders.forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
            });
            header.classList.add(currentSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            
            // Trier et afficher
            sortUsers();
            displayUsers();
        });
    });
    
    // Pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    prevBtn.addEventListener('click', () => {
        if (adminUsersPage > 1) {
            adminUsersPage--;
            displayUsers();
            updatePagination();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
        if (adminUsersPage < totalPages) {
            adminUsersPage++;
            displayUsers();
            updatePagination();
        }
    });

    // Délégation des actions admin générées dynamiquement (remplace les
    // onclick inline). Ne transporte que des ID de lignes (data-id).
    if (!window._adminDelegationBound) {
        window._adminDelegationBound = true;
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-admin-action]');
            if (!el) return;
            const action = el.dataset.adminAction;
            if (action === 'delete-guild-item') {
                deleteGuildItem(el.dataset.table, el.dataset.id, el.dataset.itemType);
            } else if (action === 'edit-activity') {
                editActivity(el.dataset.id);
            } else if (action === 'delete-activity') {
                deleteActivity(el.dataset.id);
            }
        });
    }
}

// Filtrer les utilisateurs
function filterUsers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const roleFilter = document.getElementById('role-filter').value;
    const classeFilter = document.getElementById('classe-filter').value;
    const niveauFilter = document.getElementById('niveau-filter').value;
    
    filteredUsers = allUsers.filter(user => {
        // Filtre de recherche
        const matchesSearch = 
            (user.username && user.username.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm));
        
        // Filtre de rôle
        const matchesRole = roleFilter === 'all' || user.role === roleFilter || (!user.role && roleFilter === 'joueur');
        
        // Filtre de classe
        const matchesClasse = classeFilter === 'all' || user.classe === classeFilter;
        
        // Filtre de niveau
        let matchesNiveau = true;
        if (niveauFilter !== 'all') {
            const niveau = user.niveau || 1;
            const [min, max] = niveauFilter.split('-').map(Number);
            matchesNiveau = niveau >= min && niveau <= max;
        }
        
        return matchesSearch && matchesRole && matchesClasse && matchesNiveau;
    });
    
    // Trier les utilisateurs après filtrage
    sortUsers();
    
    adminUsersPage = 1; // Reset à la page 1
    displayUsers();
    updatePagination();
}

// Ouvrir le modal de modification de rôle
function openRoleModal(user) {
    editingUserId = user.id;
    var displayName = user.minecraft_username || user.username || user.email;
    var headImg = mcHeadHtml(user, 28);
    document.getElementById('modal-username').innerHTML = headImg + escapeHtml(displayName);
    document.getElementById('modal-role-select').value = user.role || 'joueur';
    document.getElementById('role-modal').classList.add('active');
}

// Fermer le modal de modification de rôle
function closeRoleModal() {
    editingUserId = null;
    document.getElementById('role-modal').classList.remove('active');
}

// Confirmer le changement de rôle.
// SÉCURITÉ : l'écriture passe par l'Edge Function admin-user-actions qui
// revérifie le JWT + rôle admin côté serveur et synchronise user_profiles ET
// user_roles. Le front ne fait plus d'update direct.
async function confirmRoleChange() {
    if (!editingUserId) return;

    const newRole = document.getElementById('modal-role-select').value;

    // Vérification de sécurité supplémentaire: s'assurer que les rôles sont valides
    const validRoles = ['joueur', 'membre', 'admin'];
    if (!validRoles.includes(newRole)) {
        alert('Rôle invalide.');
        return;
    }

    const payload = {
        action: 'update_role',
        target_user_id: editingUserId,
        role: newRole
    };

    // Auto-rétrogradation : confirmation explicite obligatoire.
    if (editingUserId === localCurrentUser.id && newRole !== 'admin') {
        if (!confirm('ATTENTION : tu es en train de retirer TON PROPRE rôle admin. Continuer ?')) return;
        payload.confirm_self_demote = true;
    }

    const confirmBtn = document.getElementById('role-modal-confirm');
    setActionButtonBusy(confirmBtn, true, 'Modification...');

    try {
        await callAdminAction(payload);
        alert('Rôle modifié avec succès !');
        closeRoleModal();
        await refreshUsersAfterAdminAction();
    } catch (error) {
        alert(getAdminActionErrorMessage(error));
    } finally {
        setActionButtonBusy(confirmBtn, false);
    }
}

// Afficher un message d'erreur
function showAdminError(message) {
    const loading = document.getElementById('loading');
    const content = document.getElementById('dashboard-content');
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    
    const errorDiv = document.getElementById('error-content');
    if (errorDiv) errorDiv.style.display = 'block';
    const errorText = document.getElementById('error-text');
    if (errorText) errorText.textContent = message;
}

// ========== GESTION DE LA GUILDE ==========

// Basculer entre les onglets de gestion de guilde
function switchGuildTab(tabName) {
    // Masquer tous les contenus
    document.querySelectorAll('.guild-tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Retirer la classe active de tous les onglets
    document.querySelectorAll('.guild-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Afficher le contenu sélectionné
    document.getElementById(`guild-${tabName}-tab`).style.display = 'block';
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Charger les données de l'onglet
    if (tabName === 'planning') {
        loadAdminPlanning();
    } else if (tabName === 'objectives') {
        loadAdminObjectives();
    } else if (tabName === 'presence') {
        loadAdminPresence();
        loadMembersForPresence();
    }
}

// Charger les événements du planning (admin)
async function loadAdminPlanning() {
    try {
        const { data, error } = await supabase
            .from('guild_planning')
            .select('*')
            .order('date_event', { ascending: true });
        
        if (error) throw error;
        
        const container = document.getElementById('admin-planning-list');
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center;">Aucun événement planifié</p>';
            return;
        }
        
        container.innerHTML = data.map(event => `
            <div class="guild-item">
                <div class="guild-item-header">
                    <div class="guild-item-title">${escapeHtml(event.titre)}</div>
                    <div class="guild-item-actions">
                        <button class="btn-delete" data-admin-action="delete-guild-item" data-table="guild_planning" data-id="${escapeHtml(event.id)}" data-item-type="planning">🗑️ Supprimer</button>
                    </div>
                </div>
                <div style="color: #ff6b35; margin: 5px 0;">📅 ${formatDate(event.date_event)} | ${escapeHtml(formatEventType(event.type_event))}</div>
                ${event.description ? `<div style="color: #ccc;">${escapeHtml(event.description)}</div>` : ''}
            </div>
        `).join('');

    } catch (error) {
        logSupabaseWarning('admin_planning_load_failed', error);
        const container = document.getElementById('admin-planning-list');
        if (container) container.textContent = 'Erreur Supabase lors du chargement du planning.';
    }
}

// Charger les objectifs (admin)
async function loadAdminObjectives() {
    try {
        const { data, error } = await supabase
            .from('guild_objectives')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('admin-objectives-list');
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center;">Aucun objectif défini</p>';
            return;
        }
        
        container.innerHTML = data.map(obj => {
            const progression = Math.max(0, Math.min(100, parseInt(obj.progression, 10) || 0));
            const semaine = parseInt(obj.semaine_numero, 10) || 0;
            const annee = parseInt(obj.annee, 10) || 0;
            return `
            <div class="guild-item">
                <div class="guild-item-header">
                    <div class="guild-item-title">${escapeHtml(obj.titre)}</div>
                    <div class="guild-item-actions">
                        <button class="btn-delete" data-admin-action="delete-guild-item" data-table="guild_objectives" data-id="${escapeHtml(obj.id)}" data-item-type="objectives">🗑️ Supprimer</button>
                    </div>
                </div>
                <div style="color: #ccc; margin: 10px 0;">${escapeHtml(obj.description || '')}</div>
                <div style="color: #888; font-size: 0.9rem;">Semaine ${semaine}/${annee} | Statut: ${escapeHtml(formatStatus(obj.statut))}</div>
                <div style="margin-top: 10px;">
                    <div style="background: rgba(0,0,0,0.3); border-radius: 10px; height: 20px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #ff6b35, #f7931e); height: 100%; width: ${progression}%; text-align: center; color: white; font-size: 0.8rem; line-height: 20px;">
                            ${progression}%
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

    } catch (error) {
        logSupabaseWarning('admin_objectives_load_failed', error);
        const container = document.getElementById('admin-objectives-list');
        if (container) container.textContent = 'Erreur Supabase lors du chargement des objectifs.';
    }
}

// Charger les présences (admin)
async function loadAdminPresence() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('guild_presence')
            .select(`
                *,
                user_profiles!inner(username, minecraft_username, minecraft_uuid)
            `)
            .eq('date_presence', today)
            .order('statut', { ascending: true });
        
        if (error) throw error;
        
        const container = document.getElementById('admin-presence-list');
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center;">Aucune présence enregistrée aujourd\'hui</p>';
            return;
        }
        
        container.innerHTML = data.map(presence => {
            const profile = presence.user_profiles;
            const displayName = escapeHtml(profile.minecraft_username || profile.username);
            const headImg = mcHeadHtml(profile, 24);
            
            return `
            <div class="guild-item">
                <div class="guild-item-header">
                    <div class="guild-item-title"><span class="mc-user-cell">${headImg}${displayName}</span></div>
                    <div class="guild-item-actions">
                        <button class="btn-delete" data-admin-action="delete-guild-item" data-table="guild_presence" data-id="${escapeHtml(presence.id)}" data-item-type="presence">🗑️ Supprimer</button>
                    </div>
                </div>
                <div style="color: ${getStatusColor(presence.statut)}; font-weight: bold;">
                    ${escapeHtml(formatPresenceStatus(presence.statut))}
                </div>
                ${presence.commentaire ? `<div style="color: #ccc; margin-top: 5px;">${escapeHtml(presence.commentaire)}</div>` : ''}
            </div>
        `;
        }).join('');

    } catch (error) {
        logSupabaseWarning('admin_presence_load_failed', error);
        const container = document.getElementById('admin-presence-list');
        if (container) container.textContent = 'Erreur Supabase lors du chargement des présences.';
    }
}

// Charger la liste des membres pour le formulaire de présence
async function loadMembersForPresence() {
    try {
        
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, username, minecraft_username, minecraft_uuid')
            .in('role', ['membre', 'admin'])
            .order('username', { ascending: true });
        
        if (error) throw error;
        
        
        const select = document.getElementById('presence-user');
        if (!select) {
            return;
        }
        
        select.innerHTML = '<option value="">Sélectionner un membre</option>' +
            data.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.minecraft_username || user.username)}</option>`).join('');


    } catch (error) {
        logSupabaseWarning('presence_member_list_failed', error);
    }
}

// Supprimer un élément de guilde
async function deleteGuildItem(table, id, type) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) return;
    
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        alert('✅ Élément supprimé avec succès !');
        
        // Recharger la liste appropriée
        if (type === 'planning') loadAdminPlanning();
        else if (type === 'objectives') loadAdminObjectives();
        else if (type === 'presence') loadAdminPresence();
        
    } catch (error) {
        alert('❌ Erreur lors de la suppression');
    }
}

// Event listeners pour les formulaires de guilde
function bindAdminGuildForms() {
    // Formulaire planning
    const planningForm = document.getElementById('add-planning-form');
    if (planningForm && planningForm.dataset.adminFormBound !== 'true') {
        planningForm.dataset.adminFormBound = 'true';
        planningForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const { error } = await supabase
                    .from('guild_planning')
                    .insert({
                        titre: document.getElementById('planning-titre').value,
                        description: document.getElementById('planning-description').value || null,
                        date_event: document.getElementById('planning-date').value,
                        type_event: document.getElementById('planning-type').value,
                        created_by: window.currentUser.id
                    });
                
                if (error) throw error;
                
                alert('✅ Événement ajouté au planning !');
                planningForm.reset();
                loadAdminPlanning();
                
            } catch (error) {
                alert('❌ Erreur lors de l\'ajout');
            }
        });
    }
    
    // Formulaire objectifs
    const objectiveForm = document.getElementById('add-objective-form');
    if (objectiveForm && objectiveForm.dataset.adminFormBound !== 'true') {
        objectiveForm.dataset.adminFormBound = 'true';
        objectiveForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const { error } = await supabase
                    .from('guild_objectives')
                    .insert({
                        titre: document.getElementById('objective-titre').value,
                        description: document.getElementById('objective-description').value,
                        semaine_numero: parseInt(document.getElementById('objective-semaine').value),
                        annee: parseInt(document.getElementById('objective-annee').value),
                        statut: document.getElementById('objective-statut').value,
                        progression: parseInt(document.getElementById('objective-progression').value),
                        created_by: window.currentUser.id
                    });
                
                if (error) throw error;
                
                alert('✅ Objectif créé !');
                objectiveForm.reset();
                loadAdminObjectives();
                
            } catch (error) {
                alert('❌ Erreur lors de la création');
            }
        });
    }
    
    // Formulaire présence
    const presenceForm = document.getElementById('add-presence-form');
    if (presenceForm && presenceForm.dataset.adminFormBound !== 'true') {
        presenceForm.dataset.adminFormBound = 'true';
        presenceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const userId = document.getElementById('presence-user').value;
                const datePresence = document.getElementById('presence-date').value;
                
                // Vérifier si déjà existant
                const { data: existing } = await supabase
                    .from('guild_presence')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('date_presence', datePresence)
                    .single();
                
                if (existing) {
                    // Update
                    const { error } = await supabase
                        .from('guild_presence')
                        .update({
                            statut: document.getElementById('presence-statut').value,
                            commentaire: document.getElementById('presence-commentaire').value || null
                        })
                        .eq('id', existing.id);
                    
                    if (error) throw error;
                    alert('✅ Présence mise à jour !');
                } else {
                    // Insert
                    const { error } = await supabase
                        .from('guild_presence')
                        .insert({
                            user_id: userId,
                            date_presence: datePresence,
                            statut: document.getElementById('presence-statut').value,
                            commentaire: document.getElementById('presence-commentaire').value || null
                        });
                    
                    if (error) throw error;
                    alert('✅ Présence enregistrée !');
                }
                
                presenceForm.reset();
                loadAdminPresence();
                
            } catch (error) {
                alert('❌ Erreur lors de l\'enregistrement');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', bindAdminGuildForms);

// Fonctions utilitaires pour la guilde
function formatEventType(type) {
    const types = {
        'reunion': '🗣️ Réunion',
        'raid': '⚔️ Raid',
        'event': '🎉 Événement',
        'pvp': '🗡️ PvP',
        'construction': '🏗️ Construction',
        'autre': '📌 Autre'
    };
    return types[type] || type;
}

function formatStatus(status) {
    const statuses = {
        'en_cours': '⏳ En cours',
        'termine': '✅ Terminé',
        'abandonne': '❌ Abandonné'
    };
    return statuses[status] || status;
}

function formatPresenceStatus(status) {
    const statuses = {
        'present': '✅ Présent',
        'absent': '❌ Absent',
        'en_mission': '🎯 En mission'
    };
    return statuses[status] || status;
}

function getStatusColor(status) {
    const colors = {
        'present': '#4caf50',
        'absent': '#f44336',
        'en_mission': '#ff9800'
    };
    return colors[status] || '#888';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('fr-FR', options);
}

function escapeHtml(text) {
    if (window.NamelessSecurity && window.NamelessSecurity.escapeHtml) {
        return window.NamelessSecurity.escapeHtml(text);
    }
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== GESTION DES PRÉSENCES ==========

async function loadPresences() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Récupérer tous les membres et admins
        const { data: members, error: membersError } = await supabase
            .from('user_profiles')
            .select('*')
            .in('role', ['membre', 'admin']);

        if (membersError) {
            logSupabaseWarning('presence_members_failed', membersError);
            setPresenceTableMessage('Erreur Supabase lors du chargement des membres.');
            return;
        }

        // Récupérer les présences du jour
        const { data: presences, error: presencesError } = await supabase
            .from('guild_presence')
            .select('*')
            .eq('date_presence', today);

        if (presencesError) {
            logSupabaseWarning('presence_load_failed', presencesError);
            setPresenceTableMessage('Erreur Supabase lors du chargement des présences.');
            return;
        }
        
        // Créer un map des présences par user_id
        const presenceMap = {};
        (presences || []).forEach(p => {
            presenceMap[p.user_id] = p;
        });
        
        // Compter les statistiques
        let presents = 0;
        let absents = 0;
        let enMission = 0;
        
        // Créer le HTML du tableau
        const tbody = document.getElementById('presence-tbody');
        if (!tbody) return;
        
        if (!members || members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Aucun membre dans la guilde</td></tr>';
            return;
        }
        
        tbody.innerHTML = members.map(member => {
            const presence = presenceMap[member.id];
            const statut = presence ? presence.statut : 'non-marque';
            const heure = presence ? new Date(presence.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            // Compter les stats
            if (statut === 'present') presents++;
            else if (statut === 'absent') absents++;
            else if (statut === 'en_mission') enMission++;
            
            const displayName = escapeHtml(member.minecraft_username || member.username || 'Inconnu');
            // Statut restreint à un token sûr (utilisé dans une classe CSS).
            const safeStatut = String(statut || '').replace(/[^a-z0-9_-]/gi, '');

            return `
                <tr>
                    <td><span class="mc-user-cell">${mcHeadHtml(member)}<strong>${displayName}</strong></span></td>
                    <td>${escapeHtml(member.classe || '-')}</td>
                    <td>Niv. ${escapeHtml(member.niveau || 1)}</td>
                    <td>
                        <span class="presence-badge ${safeStatut}">
                            ${escapeHtml(getPresenceLabel(statut))}
                        </span>
                    </td>
                    <td>${escapeHtml(heure)}</td>
                </tr>
            `;
        }).join('');
        
        // Mettre à jour les statistiques
        document.getElementById('stat-presents').textContent = presents;
        document.getElementById('stat-absents').textContent = absents;
        document.getElementById('stat-missions').textContent = enMission;


    } catch (error) {
        logSupabaseWarning('presence_load_failed', error);
        setPresenceTableMessage('Erreur technique lors du chargement des présences.');
    }
}

// Message d'état dans le tableau des présences (texte pur, pas d'HTML dynamique).
function setPresenceTableMessage(message) {
    const tbody = document.getElementById('presence-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.color = '#e74c3c';
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function getPresenceLabel(statut) {
    const labels = {
        'present': 'Present',
        'absent': 'Absent',
        'en_mission': 'En mission',
        'non-marque': 'Non marque'
    };
    return labels[statut] || statut;
}

// ========== GESTION DU MUR D'ACTIVITÉ ==========

let editingActivityId = null;

// Charger les activités dans l'admin
async function loadAdminActivities() {
    try {
        
        const { data, error } = await supabase
            .from('guild_activity_wall')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            document.getElementById('admin-activities-list').innerHTML = 
                '<div style="text-align: center; padding: 40px; color: #e74c3c;">Erreur de chargement</div>';
            return;
        }
        
        displayAdminActivities(data || []);

    } catch (error) {
        logSupabaseWarning('activities_load_failed', error);
        const container = document.getElementById('admin-activities-list');
        if (container) container.textContent = 'Erreur technique lors du chargement des publications.';
    }
}

function displayAdminActivities(activities) {
    const container = document.getElementById('admin-activities-list');
    
    if (!activities || activities.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #888;">
                Aucune publication. Créez votre première publication ci-dessus !
            </div>
        `;
        return;
    }
    
    container.innerHTML = activities.map(activity => {
        // image_url validée (https, pas de javascript:/data:), sinon ignorée.
        const safeImg = (window.NamelessSecurity && activity.image_url)
            ? window.NamelessSecurity.sanitizeImageUrl(activity.image_url)
            : '';
        return `
        <div class="admin-activity-item" data-id="${escapeHtml(activity.id)}">
            <div class="admin-activity-header">
                <h4 class="admin-activity-title">${escapeHtml(activity.titre)}</h4>
                <div class="admin-activity-actions">
                    <button class="btn-edit-activity" data-admin-action="edit-activity" data-id="${escapeHtml(activity.id)}">
                        ✏️ Modifier
                    </button>
                    <button class="btn-delete-activity" data-admin-action="delete-activity" data-id="${escapeHtml(activity.id)}">
                        🗑️ Supprimer
                    </button>
                </div>
            </div>
            <p class="admin-activity-content">${escapeHtml(activity.contenu)}</p>
            ${safeImg ? `<img src="${escapeHtml(safeImg)}" alt="Image" class="admin-activity-image">` : ''}
            <div class="admin-activity-meta">
                <span>📌 Type: ${escapeHtml(formatActivityTypeAdmin(activity.type))}</span>
                <span>👤 Par: ${escapeHtml(activity.author_name || 'Admin')}</span>
                <span>📅 ${escapeHtml(formatDateAdmin(activity.created_at))}</span>
            </div>
        </div>
    `;
    }).join('');
}

function formatActivityTypeAdmin(type) {
    const types = {
        'annonce': 'Annonce',
        'evenement': 'Événement',
        'info': 'Information',
        'victoire': 'Victoire'
    };
    return types[type] || 'Annonce';
}

function formatDateAdmin(dateString) {
    const date = new Date(dateString);
    const options = { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('fr-FR', options);
}

// Prévisualiser l'image
function bindAdminActivityForm() {
    const imageInput = document.getElementById('activity-image');
    if (imageInput && imageInput.dataset.adminActivityBound !== 'true') {
        imageInput.dataset.adminActivityBound = 'true';
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('image-preview');
                    const container = document.getElementById('image-preview-container');
                    preview.src = e.target.result;
                    container.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Attacher les event listeners aux boutons
    const submitBtn = document.getElementById('submit-activity-btn');
    if (submitBtn && submitBtn.dataset.adminActivityBound !== 'true') {
        submitBtn.dataset.adminActivityBound = 'true';
        submitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.submitActivity();
        });
    }
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn && cancelBtn.dataset.adminActivityBound !== 'true') {
        cancelBtn.dataset.adminActivityBound = 'true';
        cancelBtn.addEventListener('click', cancelEdit);
    }
}

document.addEventListener('DOMContentLoaded', bindAdminActivityForm);

// Soumettre une activité (créer ou modifier)
window.submitActivity = async function() {
    try {
        const title = document.getElementById('activity-title').value.trim();
        const type = document.getElementById('activity-type').value;
        const content = document.getElementById('activity-content').value.trim();
        const imageInput = document.getElementById('activity-image');
        
        if (!title || !content) {
            alert('Veuillez remplir le titre et le contenu.');
            return;
        }
        
        const submitBtn = document.getElementById('submit-activity-btn');
        submitBtn.disabled = true;
        submitBtn.querySelector('#submit-btn-text').textContent = 'Publication en cours...';
        
        let imageUrl = null;
        
        // Upload de l'image si présente
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const fileExt = String(file.name.split('.').pop() || '').toLowerCase();

            if (['png', 'jpg', 'jpeg', 'webp'].indexOf(fileExt) === -1) {
                alert('Formats d\'image acceptés : png, jpg, jpeg, webp. La publication sera créée sans image.');
            } else {
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                // Chemin imposé par la policy storage : guild-activities/<user_id>/<fichier>.
                const filePath = `guild-activities/${localCurrentUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('iron-oath-storage')
                    .upload(filePath, file);

                if (uploadError) {
                    logSupabaseWarning('activity_image_upload_failed', uploadError);
                    alert('Erreur lors de l\'upload de l\'image. La publication sera créée sans image.');
                } else {
                    // Bucket privé : URL signée longue durée. Fallback URL
                    // publique si le bucket est resté public.
                    const { data: signed } = await supabase.storage
                        .from('iron-oath-storage')
                        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 5);

                    if (signed && signed.signedUrl) {
                        imageUrl = signed.signedUrl;
                    } else {
                        const { data: urlData } = supabase.storage
                            .from('iron-oath-storage')
                            .getPublicUrl(filePath);
                        imageUrl = urlData.publicUrl;
                    }
                }
            }
        }
        
        const activityData = {
            titre: title,
            type: type,
            contenu: content,
            image_url: imageUrl,
            author_name: currentUserProfile?.username || localCurrentUser?.email || 'Admin'
        };
        
        
        if (editingActivityId) {
            // Mode édition
            const { data, error } = await supabase
                .from('guild_activity_wall')
                .update(activityData)
                .eq('id', editingActivityId)
                .select();
            
            if (error) {
                alert(`Erreur lors de la modification: ${error.message}`);
                submitBtn.disabled = false;
                submitBtn.querySelector('#submit-btn-text').textContent = 'Modifier';
                return;
            }
            
            alert('Publication modifiée avec succès !');
        } else {
            // Mode création
            const { data, error } = await supabase
                .from('guild_activity_wall')
                .insert([activityData])
                .select();
            
            if (error) {
                alert(`Erreur lors de la création: ${error.message}`);
                submitBtn.disabled = false;
                submitBtn.querySelector('#submit-btn-text').textContent = 'Publier';
                return;
            }
            
            
            alert('Publication créée avec succès !');
        }
        
        // Réinitialiser le formulaire
        resetActivityForm();
        
        // Recharger la liste
        await loadAdminActivities();
        
    } catch (error) {
        alert('Une erreur est survenue.');
        const submitBtn = document.getElementById('submit-activity-btn');
        submitBtn.disabled = false;
    }
}

// Éditer une activité
async function editActivity(activityId) {
    try {
        const { data, error } = await supabase
            .from('guild_activity_wall')
            .select('*')
            .eq('id', activityId)
            .single();
        
        if (error || !data) {
            alert('Impossible de charger l\'activité.');
            return;
        }
        
        // Remplir le formulaire
        document.getElementById('activity-title').value = data.titre;
        document.getElementById('activity-type').value = data.type;
        document.getElementById('activity-content').value = data.contenu;
        
        // Afficher l'aperçu de l'image si elle existe
        if (data.image_url) {
            const preview = document.getElementById('image-preview');
            const container = document.getElementById('image-preview-container');
            preview.src = data.image_url;
            container.style.display = 'block';
        }
        
        // Passer en mode édition
        editingActivityId = activityId;
        document.getElementById('form-mode-title').textContent = 'Modifier la Publication';
        document.getElementById('submit-btn-text').textContent = 'Modifier';
        document.getElementById('cancel-edit-btn').style.display = 'block';
        
        // Scroller vers le formulaire
        document.querySelector('.activity-form').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        alert('Une erreur est survenue.');
    }
}

// Annuler l'édition
function cancelEdit() {
    resetActivityForm();
}

// Réinitialiser le formulaire
function resetActivityForm() {
    document.getElementById('activity-title').value = '';
    document.getElementById('activity-type').value = 'annonce';
    document.getElementById('activity-content').value = '';
    document.getElementById('activity-image').value = '';
    document.getElementById('image-preview-container').style.display = 'none';
    
    editingActivityId = null;
    document.getElementById('form-mode-title').textContent = 'Nouvelle Publication';
    document.getElementById('submit-btn-text').textContent = 'Publier';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    
    const submitBtn = document.getElementById('submit-activity-btn');
    submitBtn.disabled = false;
}

// Supprimer une activité
async function deleteActivity(activityId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette publication ?')) {
        return;
    }
    
    try {
        // Récupérer l'activité pour supprimer l'image si elle existe
        const { data: activity } = await supabase
            .from('guild_activity_wall')
            .select('image_url')
            .eq('id', activityId)
            .single();
        
        // Supprimer l'image du storage si elle existe. Le chemin objet est la
        // partie après le nom du bucket, valable pour les URLs publiques
        // (/object/public/iron-oath-storage/...) et signées (/object/sign/...).
        if (activity?.image_url) {
            const bucketMarker = '/iron-oath-storage/';
            const markerIndex = activity.image_url.indexOf(bucketMarker);
            if (markerIndex !== -1) {
                const objectPath = activity.image_url
                    .slice(markerIndex + bucketMarker.length)
                    .split('?')[0];
                if (objectPath) {
                    await supabase.storage
                        .from('iron-oath-storage')
                        .remove([objectPath]);
                }
            }
        }
        
        // Supprimer l'activité
        const { error } = await supabase
            .from('guild_activity_wall')
            .delete()
            .eq('id', activityId);
        
        if (error) {
            alert('Erreur lors de la suppression.');
            return;
        }
        
        alert('Publication supprimée avec succès !');
        await loadAdminActivities();
        
    } catch (error) {
        alert('Une erreur est survenue.');
    }
}

// Rendre les fonctions accessibles globalement pour les appels dynamiques depuis le HTML généré
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;



