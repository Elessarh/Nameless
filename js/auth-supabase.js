var supabase = null;

function _escHtml(t){if(window.NamelessSecurity&&window.NamelessSecurity.escapeHtml)return window.NamelessSecurity.escapeHtml(t);if(!t)return'';var d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function _escAttr(t){if(window.NamelessSecurity&&window.NamelessSecurity.escapeAttr)return window.NamelessSecurity.escapeAttr(t);if(!t)return'';return t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

async function initSupabase() {
    try {
        const SUPABASE_URL = window._getSecureUrl ? window._getSecureUrl() : null;
        const SUPABASE_PUBLISHABLE_KEY = window._getSecureKey ? window._getSecureKey() : null;
        
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            throw new Error('Init error');
        }
        
        const supabaseLib = window.supabase || (window.supabasejs && window.supabasejs.supabase);
        
        if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
            // console.log('⏳ Chargement de la bibliothèque Supabase...');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
                script.onload = () => {
                    // console.log('✅ Script Supabase chargé depuis jsdelivr');
                    resolve();
                };
                script.onerror = () => {
                    // console.warn('⚠️ Échec jsdelivr, essai avec unpkg...');
                    const altScript = document.createElement('script');
                    altScript.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js';
                    altScript.onload = () => {
                        // console.log('✅ Script Supabase chargé depuis unpkg');
                        resolve();
                    };
                    altScript.onerror = () => reject(new Error('Impossible de charger Supabase depuis aucun CDN'));
                    document.head.appendChild(altScript);
                };
                document.head.appendChild(script);
            });
            
            // Attendre que le script soit complètement initialisé
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Récupérer la fonction createClient
        const createClient = window.supabase?.createClient || window.supabasejs?.supabase?.createClient;
        
        if (!createClient || typeof createClient !== 'function') {
            throw new Error('createClient non disponible après chargement');
        }
        
        var _rawClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        supabase = window._initDbGuard ? window._initDbGuard(_rawClient) : _rawClient;
        _rawClient = null;
        try { delete window._initDbGuard; } catch(e) {}
        
        try {
            const { data, error } = await supabase.auth.getUser();
            // console.log('🔍 Test connectivité Supabase:', { data: !!data, error: error?.message });
        } catch (testError) {
            // console.warn('⚠️ Test connectivité échoué:', testError.message);
        }
        
        return true;
    } catch (error) {
        // console.error('Erreur initialisation Supabase:', error);
        return false;
    }
}

// Variables globales
let currentUser = null;
let userProfile = null;
const usernamePendingMap = new Map();

let isCheckingAuthState = false;
let lastAuthStateCheck = 0;

function isFallbackProfileName(name) {
    if (!name) return true;
    if (/^Joueur_[A-Za-z0-9]{6}$/.test(name)) return true;

    if (currentUser && currentUser.email) {
        var emailLocal = currentUser.email.split('@')[0] || '';
        var sanitizedEmailLocal = emailLocal.replace(/[^A-Za-z0-9_-]/g, '_').substring(0, 32);
        if (name === emailLocal || name === sanitizedEmailLocal) return true;
    }

    return false;
}

function getPublicProfileName(profile) {
    if (!profile) return 'Joueur';
    if (profile.minecraft_username) return profile.minecraft_username;
    if (profile.username && !isFallbackProfileName(profile.username)) return profile.username;
    return 'Compte Microsoft';
}

function getPublicMinecraftKey(profile) {
    if (!profile) return '';
    return profile.minecraft_uuid || profile.minecraft_username || '';
}

function createMicrosoftIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '21');
    svg.setAttribute('height', '21');
    svg.setAttribute('viewBox', '0 0 21 21');
    [
        ['1', '1', '#f25022'],
        ['11', '1', '#7fba00'],
        ['1', '11', '#00a4ef'],
        ['11', '11', '#ffb900']
    ].forEach(function (part) {
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', part[0]);
        rect.setAttribute('y', part[1]);
        rect.setAttribute('width', '9');
        rect.setAttribute('height', '9');
        rect.setAttribute('fill', part[2]);
        svg.appendChild(rect);
    });
    return svg;
}

function setMicrosoftButtonText(button, text) {
    if (!button) return;
    button.replaceChildren(createMicrosoftIcon(), document.createTextNode(' ' + text));
}

// ========== GESTION DE L'ÉTAT DE CONNEXION ==========
function checkAuthState() {
    const now = Date.now();
    if (now - lastAuthStateCheck < 100) return;
    lastAuthStateCheck = now;
    
    if (isCheckingAuthState) return;
    isCheckingAuthState = true;
    
    try {
        const userInfo = document.getElementById('user-info');
        const loginLink = document.getElementById('login-link');
        const usernameSpan = document.getElementById('username');
        
        
        if (typeof window !== 'undefined') {
            window.currentUser = currentUser;
            window.userProfile = userProfile;
        }
        
        if (currentUser) {
            // Utilisateur connecté
            
            if (userInfo) {
                userInfo.style.setProperty('display', 'flex', 'important');
                userInfo.classList.add('show');
                userInfo.classList.add('js-visible');
                
                if (usernameSpan) {
                    let displayName = 'Joueur';
                    let headImg = null;
                    
                    if (userProfile) {
                        displayName = getPublicProfileName(userProfile);
                        var minecraftKey = getPublicMinecraftKey(userProfile);
                        if (minecraftKey) {
                            headImg = document.createElement('img');
                            headImg.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(minecraftKey) + '/24';
                            headImg.className = 'mc-head-nav';
                            headImg.alt = '';
                            headImg.width = 24;
                            headImg.height = 24;
                            headImg.loading = 'lazy';
                        }
                    } else if (currentUser && currentUser.email) {
                        displayName = 'Joueur';
                    }

                    if (headImg) usernameSpan.replaceChildren(headImg, document.createTextNode(displayName));
                    else usernameSpan.textContent = displayName;
                }
            }
            
            if (loginLink) {
                loginLink.style.setProperty('display', 'none', 'important');
                loginLink.classList.remove('show');
                loginLink.classList.remove('js-visible');
            }
        } else {
            // Utilisateur non connecté
            
            if (userInfo) {
                userInfo.style.setProperty('display', 'none', 'important');
                userInfo.classList.remove('show');
                userInfo.classList.remove('js-visible');
            }
            
            if (loginLink) {
                loginLink.style.setProperty('display', 'inline-block', 'important');
                loginLink.classList.add('show');
                loginLink.classList.add('js-visible');
            }
        }
    } catch (error) {
        // console.error('Erreur checkAuthState:', error);
    } finally {
        isCheckingAuthState = false;
    }
}

function showMessage(message, type = 'error') {
    const messageEl = document.getElementById('auth-message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `auth-message ${type}`;
        messageEl.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
    }
}

// ========== FONCTIONS D'AUTHENTIFICATION ==========
async function registerUser(username, email, password, confirmPassword) {
    try {
        if (!username || !email || !password || !confirmPassword) {
            showMessage('Veuillez remplir tous les champs.');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showMessage('Veuillez entrer un email valide.');
            return false;
        }
        
        if (username.length < 3) {
            showMessage('Le pseudo joueur doit contenir au moins 3 caractères.');
            return false;
        }
        
        if (username.length > 20) {
            showMessage('Le pseudo joueur ne peut pas dépasser 20 caractères.');
            return false;
        }
        
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(username)) {
            showMessage('Le pseudo joueur ne peut contenir que des lettres, chiffres, underscore et tirets.');
            return false;
        }
        
        if (password !== confirmPassword) {
            showMessage('Les mots de passe ne correspondent pas.');
            return false;
        }
        
        if (password.length < 6) {
            showMessage('Le mot de passe doit contenir au moins 6 caractères.');
            return false;
        }
        
        try {
            const { data: existingProfile } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('username', username)
                .single();
                
            if (existingProfile) {
                showMessage('Ce pseudo joueur est déjà pris. Choisissez-en un autre.');
                return false;
            }
        } catch (checkError) {
            if (checkError.code === 'PGRST116' || checkError.message.includes('406')) {
                // Table inaccessible, on continue
            } else {
                // console.error('Erreur vérification pseudo:', checkError);
                showMessage('Erreur technique lors de la vérification. Réessayez.');
                return false;
            }
        }
        
        usernamePendingMap.set(email, username);
        
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username
                }
            }
        });
        
        if (signUpError) {
            // console.error('Erreur inscription Supabase:', signUpError);
            
            // Si l'utilisateur existe déjà dans auth.users
            if (signUpError.message.includes('User already registered') || signUpError.message.includes('already been registered')) {
                // NE PAS se connecter automatiquement, juste vérifier si le profil existe
                // On ne connaît pas le vrai mot de passe de l'utilisateur existant
                
                showMessage('Ce compte existe déjà. Si c\'est votre compte, connectez-vous. Sinon, utilisez un autre email.');
                setTimeout(() => showLoginForm(), 2000);
                return false;
            }
            
            showMessage(`Erreur lors de l'inscription: ${signUpError.message}`);
            return false;
        }
        
        // Si l'inscription réussit, créer le profil utilisateur
        if (authData.user) {
            // console.log('✅ Compte Supabase créé, vérification du profil...');
            
            // Vérifier d'abord si le profil existe déjà
            const { data: existingProfile, error: checkError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();
                
            if (existingProfile) {
                // console.log('ℹ️ Profil déjà existant pour cet utilisateur');
                showMessage('Compte créé avec succès ! Vérifiez votre email pour confirmer votre compte.', 'success');
            } else {
                // Le profil n'existe pas, le créer
                const { error: profileError } = await supabase
                    .from('user_profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            username: username,
                            role: 'joueur'
                        }
                    ]);
                    
                if (profileError) {
                    // console.error('Erreur création profil:', profileError);
                    
                    if (profileError.code === '23505') {
                        showMessage('Compte créé avec succès ! Vérifiez votre email pour confirmer votre compte.', 'success');
                    } else {
                        showMessage(`Erreur lors de la création du profil: ${profileError.message}. Contactez le support.`);
                        return false;
                    }
                } else {
                    showMessage('Compte créé avec succès ! Vérifiez votre email pour confirmer votre compte.', 'success');
                }
            }
            
            setTimeout(() => {
                navigateHome();
            }, 3000);
            
            return true;
        }
        
    } catch (error) {
        // console.error('Erreur lors de l\'inscription:', error);
        showMessage('Erreur technique lors de l\'inscription.');
        return false;
    }
}

async function loginUser(email, password) {
    // console.log('🔑 Tentative de connexion pour:', email);
    // console.log('🔍 Supabase client disponible?', !!supabase);
    // console.log('🔍 Supabase auth disponible?', !!supabase?.auth);
    
    try {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        // console.log('🔍 Réponse Supabase:', { authData: !!authData, error: signInError });
        
        if (signInError) {
            // console.error('❌ Erreur de connexion détaillée:', signInError);
            if (signInError.message.includes('Invalid login credentials')) {
                showMessage('Email ou mot de passe incorrect.');
            } else if (signInError.message.includes('Email not confirmed')) {
                showMessage('Veuillez confirmer votre email avant de vous connecter.');
            } else {
                showMessage(`Erreur de connexion: ${signInError.message}`);
            }
            return false;
        }
        
        if (authData.user) {
            currentUser = authData.user;
            await loadUserProfile();
            
            showMessage('Connexion réussie ! Redirection...', 'success');
            
            setTimeout(() => {
                navigateHome();
            }, 2000);
            
            return true;
        }
        
    } catch (error) {
        // console.error('Erreur lors de la connexion:', error);
        showMessage('Erreur technique lors de la connexion.');
        return false;
    }
}

async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            // console.error('Erreur lors de la déconnexion:', error);
        }
        
        currentUser = null;
        userProfile = null;
        
        // Rediriger vers l'accueil
        navigateHome();
        
    } catch (error) {
        // console.error('Erreur technique lors de la déconnexion:', error);
    }
}

// ========== CONNEXION MICROSOFT OAUTH ==========
async function loginWithMicrosoft() {
    try {
        const btn = document.getElementById('microsoft-login-btn');
        if (!supabase || !supabase.auth || typeof supabase.auth.signInWithOAuth !== 'function') {
            showMessage('Connexion Microsoft indisponible. Vérifiez la configuration Supabase.', 'error');
            return;
        }

        if (btn) {
            btn.disabled = true;
            setMicrosoftButtonText(btn, 'Redirection vers Microsoft...');
        }
        
        // Déterminer l'URL de redirection
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'azure',
            options: {
                scopes: 'openid profile email',
                redirectTo: window.location.origin + '/pages/profil.html'
            }
        });
        
        if (error) {
            showMessage('Erreur de connexion Microsoft: ' + error.message);
            if (btn) {
                btn.disabled = false;
                setMicrosoftButtonText(btn, 'Se connecter avec Microsoft');
            }
        }
    } catch (error) {
        const btn = document.getElementById('microsoft-login-btn');
        if (btn) {
            btn.disabled = false;
            setMicrosoftButtonText(btn, 'Se connecter avec Microsoft');
        }
        showMessage('Erreur technique lors de la connexion Microsoft. Vérifiez le provider Azure dans Supabase.');
    }
}

function getMinecraftHeadUrl(uuid, size) {
    if (!uuid) return null;
    return 'https://mc-heads.net/avatar/' + uuid + '/' + (size || 32);
}

// Gérer l'état de connexion sur la page connexion
function handleConnexionPageAuth() {
    if (!window.location.pathname.includes('connexion')) return;

    if (userProfile) {
        showMessage('Connexion réussie ! Redirection...', 'success');
        setTimeout(function() {
            navigateProfile();
        }, 1500);
    }
}

async function loadUserProfile() {
    if (!currentUser) return null;
    
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('406')) {
                return await createMissingProfile();
            } else {
                // console.error('Erreur chargement profil:', error);
                return await createMissingProfile();
            }
        }
        
        userProfile = data;
        window.userProfile = userProfile; // Mettre à jour immédiatement
        
        if (currentUser.email && usernamePendingMap.has(currentUser.email)) {
            usernamePendingMap.delete(currentUser.email);
        }
        
        checkAuthState();
        return userProfile;
        
    } catch (error) {
        // console.error('Erreur technique chargement profil:', error);
        
        try {
            return await createMissingProfile();
        } catch (recoveryError) {
            // console.error('Échec de la récupération automatique:', recoveryError);
            showMessage('Erreur de synchronisation. Rechargez la page.', 'error');
            return null;
        }
    }
}

async function createMissingProfile() {
    if (!currentUser) return null;
    
    try {
        let username = usernamePendingMap.get(currentUser.email);
        
        if (username) {
            usernamePendingMap.delete(currentUser.email);
        } else if (currentUser.app_metadata && currentUser.app_metadata.provider === 'azure') {
            // Utilisateur OAuth Microsoft - pseudo temporaire
            username = 'Joueur_' + currentUser.id.substring(0, 6);
        } else {
            username = 'Joueur_' + currentUser.id.substring(0, 6);
        }
        
        const { data, error } = await supabase
            .from('user_profiles')
            .insert([
                {
                    id: currentUser.id,
                    username: username,
                    role: 'joueur'
                }
            ])
            .select()
            .single();
            
        if (error) {
            // console.error('Erreur création profil:', error);
            
            if (error.code === '23505') {
                const { data: existingProfile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();
                    
                if (existingProfile) {
                    userProfile = existingProfile;
                    return userProfile;
                }
            }
            
            throw new Error(`Erreur création profil: ${error.message}`);
        }
        
        userProfile = data;
        checkAuthState();
        return userProfile;
        
    } catch (error) {
        // console.error('Erreur technique création profil:', error);
        throw error;
    }
}

// ========== GESTION DES FORMULAIRES ==========
function clearForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.reset());
}

function showLoginForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm && registerForm) {
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        clearForms();
    }
}

function showRegisterForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm && registerForm) {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        clearForms();
    }
}

// ========== FONCTIONS UTILITAIRES ==========
function getCurrentUser() {
    return currentUser;
}

function getUserProfile() {
    return userProfile;
}

function isLoggedIn() {
    return currentUser !== null && userProfile !== null;
}

function isAdmin() {
    return userProfile && userProfile.role === 'admin';
}

function isMemberOrAdmin() {
    return userProfile && (userProfile.role === 'membre' || userProfile.role === 'admin');
}

function navigateHome() {
    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
        window.NamelessSpaRouter.navigate('/');
        return;
    }

    window.location.href = '/';
}

function navigateProfile() {
    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
        window.NamelessSpaRouter.navigate('/profil');
        return;
    }

    window.location.href = '/profil';
}

function bindOnce(element, eventName, marker, handler) {
    if (!element) return;
    var key = 'authBound' + marker;
    if (element.dataset && element.dataset[key] === 'true') return;
    element.addEventListener(eventName, handler);
    if (element.dataset) element.dataset[key] = 'true';
}

function bindAuthInterface(root) {
    root = root || document;

    bindOnce(root.querySelector('#microsoft-login-btn'), 'click', 'MicrosoftLogin', loginWithMicrosoft);

    bindOnce(document.getElementById('logout-btn'), 'click', 'Logout', logoutUser);
}

function exposeAuthGlobals() {
    window.getCurrentUser = getCurrentUser;
    window.getUserProfile = getUserProfile;
    window.isLoggedIn = isLoggedIn;
    window.isAdmin = isAdmin;

    window.loginWithMicrosoft = loginWithMicrosoft;
    window.getMinecraftHeadUrl = getMinecraftHeadUrl;

    window.updateGlobalAuthVars = function() {
        window.currentUser = currentUser;
        window.userProfile = userProfile;
    };
}

async function initAuthPage(root) {
    bindAuthInterface(root || document);
    checkAuthState();

    if (currentUser && document.getElementById('microsoft-login')) {
        handleConnexionPageAuth();
    }
}

window.NamelessAuthPage = {
    init: initAuthPage,
    destroy: function() {}
};

// ========== INITIALISATION AUTOMATIQUE ==========
document.addEventListener('DOMContentLoaded', async function() {
    // console.log('🚀 Démarrage de l\'initialisation auth...');
    
    const supabaseReady = await initSupabase();
    if (!supabaseReady) {
        window.namelessAuthReady = true;
        // console.error('❌ Impossible d\'initialiser Supabase');
        // Forcer l'affichage du bouton connexion si Supabase échoue
        setTimeout(() => {
            const loginLink = document.getElementById('login-link');
            if (loginLink) {
                loginLink.style.display = 'block';
                loginLink.classList.add('show');
                loginLink.classList.add('js-visible');
            }
            const userInfo = document.getElementById('user-info');
            if (userInfo) {
                userInfo.style.display = 'none';
            }
        }, 500);
        return;
    }
    
    // Vérifier la session actuelle
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            // console.warn('⚠️ Erreur récupération session:', error);
            currentUser = null;
            userProfile = null;
        } else if (session?.user) {
            // console.log('✅ Session trouvée pour:', session.user.email);
            currentUser = session.user;
            window.currentUser = currentUser;
            await loadUserProfile();
        } else {
            // console.log('ℹ️ Aucune session active');
            currentUser = null;
            userProfile = null;
            window.currentUser = null;
            window.userProfile = null;
        }
    } catch (error) {
        // console.error('❌ Erreur lors de la vérification de session:', error);
        currentUser = null;
        userProfile = null;
    }
    
    // Mettre à jour l'UI une seule fois
    checkAuthState();

    // Signale aux pages protégées que l'état de session initial est connu :
    // elles peuvent refuser l'accès immédiatement au lieu d'attendre le timeout.
    window.namelessAuthReady = true;

    // Écouter les changements d'authentification
    supabase.auth.onAuthStateChange(async (event, session) => {
        try {
            if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
                currentUser = session.user;
                window.currentUser = currentUser;
                try {
                    await loadUserProfile();
                } catch (profileErr) {
                    // Profil échoué, UI mise à jour quand même
                }
                checkAuthState();
                
                // Redirection propre apres connexion.
                if (event === 'SIGNED_IN') {
                    handleConnexionPageAuth();
                }
            } else if (event === 'INITIAL_SESSION' && !session) {
                currentUser = null;
                userProfile = null;
                window.currentUser = null;
                window.userProfile = null;
                checkAuthState();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                userProfile = null;
                window.currentUser = null;
                window.userProfile = null;
                checkAuthState();
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                currentUser = session.user;
                window.currentUser = currentUser;
            }
        } catch (err) {
            checkAuthState();
        }
    });
    
    // === MICROSOFT OAUTH ===
    
    // Bouton connexion Microsoft
    var msLoginBtn = document.getElementById('microsoft-login-btn');
    if (msLoginBtn) {
        msLoginBtn.addEventListener('click', loginWithMicrosoft);
    }
    
    // Si deja connecte sur la page connexion, gerer la redirection.
    if (currentUser && window.location.pathname.includes('connexion')) {
        handleConnexionPageAuth();
    }
    
    // Bouton de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        bindOnce(logoutBtn, 'click', 'Logout', logoutUser);
    }
    
    // console.log('✅ Système d\'authentification Supabase initialisé');
    // console.log('📊 Utilisateur actuel:', currentUser ? userProfile?.username || currentUser.email : 'Aucun');
    
    window.getCurrentUser = getCurrentUser;
    window.getUserProfile = getUserProfile;
    window.isLoggedIn = isLoggedIn;
    window.isAdmin = isAdmin;
    
    window.loginWithMicrosoft = loginWithMicrosoft;
    window.getMinecraftHeadUrl = getMinecraftHeadUrl;

    window.updateGlobalAuthVars = function() {
        window.currentUser = currentUser;
        window.userProfile = userProfile;
    };

}); // Fin de DOMContentLoaded
