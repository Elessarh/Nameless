// HDV.js - Système complet de marketplace pour Iron Oath
// Échappement centralisé (délègue à NamelessSecurity si présent).
function _hdvEsc(t){
    if(window.NamelessSecurity&&window.NamelessSecurity.escapeHtml)return window.NamelessSecurity.escapeHtml(t);
    if(!t)return'';var d=document.createElement('div');d.textContent=t;return d.innerHTML;
}
function _hdvEscA(t){
    if(window.NamelessSecurity&&window.NamelessSecurity.escapeAttr)return window.NamelessSecurity.escapeAttr(t);
    if(!t)return'';return t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
class HDVSystem {
    constructor() {
        // Cache pour améliorer les performances
        this.cache = {
            orders: null,
            myOrders: null,
            lastUpdate: null,
            cacheTimeout: 30000 // 30 secondes
        };

        // Attendre un peu que le système d'auth soit chargé
        setTimeout(async () => {
            // Vérification de l'authentification
            const userInfo = this.getCurrentUserInfo();
            if (!userInfo) {
                // console.log('❌ Utilisateur non connecté, redirection...');
                this.redirectToLogin();
                return;
            }
            
            // console.log('✅ Utilisateur connecté:', userInfo.username);
            await this.initializeHDV();
        }, 500);
    }

    // Initialiser le système HDV
    async initializeHDV() {
        this.currentTab = 'marketplace';
        this.selectedItem = null;
        this.orderType = null;
        this.filters = {
            category: 'all',
            type: 'all',
            rarity: 'all',
            search: ''
        };
        this.orders = [];
        this.myOrders = [];
        
        // Données des catégories pour déduction
        this.categoryMapping = {
            'armes': ['Bâton', 'Épée', 'Arc', 'Dague', 'Marteau'],
            'consommables': ['Clé', 'Cristal', 'Parchemin', 'Potion', 'Sandwich', 'Viande'],
            'ressources': ['Aile', 'Bonbon', 'Brindille', 'Bûche', 'Carapace', 'Cendre', 'Coeur', 'Corde', 'Corne', 'Crinière', 'Crocs', 'Débris', 'Éclat', 'Écorce', 'Essence', 'Fil', 'Fourrure', 'Fragment', 'Gelée', 'Griffe', 'Lingot', 'Minerai', 'Mycélium', 'Noyau', 'Os', 'Peau', 'Bourse', 'Pièce'],
            'armures': ['Casque', 'Plastron', 'Jambières', 'Bottes', 'Bouclier'],
            'accessoires': ['Anneau', 'Amulette', 'Collier', 'Bracelet'],
            'outils': ['Pioche', 'Hache', 'Pelle', 'Canne'],
            'runes': ['Rune'],
            'familiers': ['Familier', 'Pet'],
            'montures': ['Monture', 'Cheval', 'Dragon']
        };
        
        this.categoryNames = {
            'armes': '⚔️ Armes',
            'consommables': '🧪 Consommables', 
            'ressources': '🔧 Ressources',
            'armures': '🛡️ Armures',
            'accessoires': '💍 Accessoires',
            'outils': '⛏️ Outils',
            'runes': '✨ Runes',
            'familiers': '🐾 Familiers',
            'montures': '🐎 Montures'
        };

        // Système de rareté basé sur les mots-clés
        this.rarityMapping = {
            'legendaire': ['Légendaire', 'Mythique', 'Épique', 'Ultime', 'Divin', 'Titanesque', 'Shaman'],
            'epique': ['Cristal', 'Enchantée', 'Magique', 'Arcanique', 'Supérieur', 'Maître'],
            'rare': ['Renforcé', 'Soutien', 'Titan', 'Nautherion', 'Halloween', 'Overall'],
            'peu_commun': ['Moyenne', 'Putrifié', 'Corrompu', 'Glacial', 'Martyr'],
            'commun': ['Bûche', 'Minerai', 'Lingot', 'Viande', 'Sandwich', 'Peau', 'Os']
        };

        this.rarityNames = {
            'legendaire': '🌟 Légendaire',
            'epique': '🔮 Épique',
            'rare': '💎 Rare',
            'peu_commun': '🔷 Peu commun',
            'commun': '⚪ Commun'
        };

        this.rarityColors = {
            'legendaire': '#ff6b35',
            'epique': '#8a2be2',
            'rare': '#00a8ff',
            'peu_commun': '#00ff88',
            'commun': '#ffffff'
        };

        // Mapping des raretés anglaises vers françaises pour synchronisation avec l'onglet Items
        this.rarityMapping_EN_FR = {
            'legendary': 'legendaire',
            'epic': 'epique', 
            'rare': 'rare',
            'uncommon': 'peu_commun',
            'common': 'commun'
        };

        // Catalogue d'items (sera chargé depuis le fichier items-catalog-hdv.js)
        this.itemsCatalog = null;
        this.loadItemsCatalog();
        
        // Charger les données sauvegardées (asynchrone)
        await this.loadOrdersFromStorage();
        
        this.initializeEventListeners();
        await this.loadMarketplace();
        
        // Démarrer l'auto-actualisation
        this.startAutoRefresh();
    }

    // Charger le catalogue d'items depuis la variable globale
    loadItemsCatalog() {
        try {
            // Le catalogue d'items est défini dans items-catalog-hdv.js
            if (typeof itemsCatalog !== 'undefined') {
                this.itemsCatalog = itemsCatalog;
                // console.log('✅ Catalogue d\'items chargé avec', this.getTotalItemsCount(), 'items');
            } else {
                // console.warn('⚠️ Catalogue d\'items non trouvé - utilisation du système de déduction par défaut');
            }
        } catch (error) {
            // console.warn('⚠️ Erreur lors du chargement du catalogue d\'items:', error);
        }
    }

    // Obtenir le nombre total d'items dans le catalogue
    getTotalItemsCount() {
        if (!this.itemsCatalog) return 0;
        let count = 0;
        Object.values(this.itemsCatalog).forEach(category => {
            count += category.items.length;
        });
        return count;
    }

    // Rechercher un item dans le catalogue par nom
    findItemInCatalog(itemName) {
        if (!this.itemsCatalog) return null;
        
        for (const category of Object.values(this.itemsCatalog)) {
            const item = category.items.find(item => item.name === itemName);
            if (item) return item;
        }
        return null;
    }

    // Déduire la catégorie d'un item à partir de son nom
    deduceItemCategory(itemName) {
        if (!itemName) return 'Catégorie inconnue';
        
        for (const [categoryKey, keywords] of Object.entries(this.categoryMapping)) {
            for (const keyword of keywords) {
                if (itemName.toLowerCase().includes(keyword.toLowerCase())) {
                    return this.categoryNames[categoryKey] || 'Catégorie inconnue';
                }
            }
        }
        
        return 'Catégorie inconnue';
    }

    // Obtenir la catégorie d'un item (avec fallback)
    getItemCategory(item) {
        // Si l'item a déjà une catégorie, l'utiliser
        if (item.category) {
            return item.category;
        }
        
        // Sinon, essayer de la déduire
        return this.deduceItemCategory(item.name);
    }

    // Déduire la rareté d'un item à partir de son nom
    deduceItemRarity(itemName) {
        if (!itemName) return 'commun';
        
        for (const [rarityKey, keywords] of Object.entries(this.rarityMapping)) {
            for (const keyword of keywords) {
                if (itemName.toLowerCase().includes(keyword.toLowerCase())) {
                    return rarityKey;
                }
            }
        }
        
        return 'commun';
    }

    // Obtenir la rareté d'un item (avec fallback)
    getItemRarity(item) {
        // Si l'item a déjà une rareté française, l'utiliser
        if (item.rarity && this.rarityNames[item.rarity]) {
            return item.rarity;
        }
        
        // Chercher d'abord dans le catalogue d'items pour avoir la rareté officielle
        const catalogItem = this.findItemInCatalog(item.name);
        if (catalogItem && catalogItem.rarity) {
            // Convertir la rareté anglaise en française
            const frenchRarity = this.rarityMapping_EN_FR[catalogItem.rarity];
            if (frenchRarity) {
                return frenchRarity;
            }
        }
        
        // Si l'item a une rareté anglaise, la convertir
        if (item.rarity && this.rarityMapping_EN_FR[item.rarity]) {
            return this.rarityMapping_EN_FR[item.rarity];
        }
        
        // En dernier recours, déduire la rareté à partir du nom
        return this.deduceItemRarity(item.name);
    }

    // Obtenir le nom affiché de la rareté
    getRarityDisplayName(item) {
        const rarity = this.getItemRarity(item);
        return this.rarityNames[rarity] || this.rarityNames['commun'];
    }

    // Obtenir la couleur de la rareté
    getRarityColor(item) {
        const rarity = this.getItemRarity(item);
        return this.rarityColors[rarity] || this.rarityColors['commun'];
    }

    // Système d'auto-actualisation optimisé
    startAutoRefresh() {
        // console.log('🔄 Démarrage auto-actualisation HDV intelligente (60s)');
        
        // Variables pour l'optimisation
        this.lastUpdateTime = Date.now();
        this.isPageVisible = true;
        
        // Détecter si la page est visible
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            if (this.isPageVisible) {
                // console.log('�️ Page redevenue visible, actualisation immédiate');
                this.performOptimizedRefresh();
            }
        });
        
        // Actualiser toutes les 60 secondes (au lieu de 30) seulement si la page est visible
        this.refreshInterval = setInterval(async () => {
            if (this.isPageVisible) {
                this.performOptimizedRefresh();
            } else {
                // console.log('🔄 Actualisation ignorée (page non visible)');
            }
        }, 60000); // Intervalle augmenté à 60 secondes
        
        // Nettoyer l'intervalle si on quitte la page
        window.addEventListener('beforeunload', () => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
        });
    }
    
    // Actualisation optimisée avec cache intelligent
    async performOptimizedRefresh() {
        const now = Date.now();
        
        // Éviter les actualisations trop fréquentes (min 30 secondes)
        if (now - this.lastUpdateTime < 30000) {
            // console.log('🔄 Actualisation trop récente, ignorée');
            return;
        }
        
        // console.log('🔄 Auto-actualisation HDV optimisée...');
        this.lastUpdateTime = now;
        
        try {
            const previousOrderCount = this.orders.length;
            await this.loadOrdersFromStorage();
            
            // Actualiser l'affichage seulement si les données ont changé
            if (this.orders.length !== previousOrderCount) {
                // console.log('📊 Données modifiées, mise à jour de l\'affichage');
                await this.displayOrders(this.orders);
            } else {
                // console.log('📊 Aucun changement détecté, affichage conservé');
            }
        } catch (error) {
            // console.error('❌ Erreur lors de l\'actualisation optimisée:', error);
        }
    }

    // Rediriger vers la page de connexion si non connecté
    redirectToLogin() {
        const loginUrl = '/connexion';
        const currentUrl = window.location.href;
        
        // Éviter la boucle de redirection si on est déjà sur la page de connexion
        if (!currentUrl.includes('/connexion')) {
            this.showAuthError();
            setTimeout(() => {
                window.location.href = loginUrl;
            }, 3000);
        }
    }

    // NOTE SÉCURITÉ: la méthode DEBUG forceAccess() a été retirée. Elle
    // écrivait une identité fabriquée dans localStorage('currentUser') puis
    // rechargeait la page — une porte dérobée d'usurpation d'identité côté
    // client. L'identité réelle doit toujours provenir de la session Supabase.

    // DEBUG: Méthode pour vérifier l'état d'authentification
    checkAuthStatus() {
        // console.log('=== ÉTAT AUTHENTIFICATION ===');
        // console.log('window.getCurrentUser:', typeof window.getCurrentUser);
        // console.log('localStorage currentUser:', localStorage.getItem('currentUser'));
        // console.log('window.currentUser:', window.currentUser);
        // console.log('getCurrentUserInfo():', this.getCurrentUserInfo());
    }

    // Afficher un message d'erreur d'authentification
    showAuthError() {
        const authError = document.createElement('div');
        authError.className = 'auth-error-overlay';
        authError.innerHTML = `
            <div class="auth-error-content">
                <h2>🔒 Accès Restreint</h2>
                <p>Vous devez être connecté pour accéder à l'Hôtel des Ventes.</p>
                <p>Redirection vers la page de connexion...</p>
                <div class="auth-error-loader"></div>
            </div>
        `;
        
        // Styles inline pour l'erreur d'authentification
        authError.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Exo 2', sans-serif;
        `;
        
        document.body.appendChild(authError);
    }

    // Méthode helper pour récupérer l'utilisateur connecté.
    // SÉCURITÉ: cette valeur sert UNIQUEMENT à l'affichage et au filtrage
    // local. Elle peut provenir du cache/localStorage et n'est donc PAS une
    // source d'identité fiable (localStorage est modifiable par l'utilisateur).
    // Toute action sensible (insert/delete d'ordres, historique) doit s'appuyer
    // sur la session Supabase authentifiée (hdvSupabaseManager.getCurrentUser →
    // supabase.auth.getUser()) et la propriété des lignes doit être imposée par
    // les policies RLS côté serveur (user_id = auth.uid()). Voir
    // docs/SUPABASE_RLS_CHECKLIST.md.
    getCurrentUserInfo() {
        try {
            // console.log('🔍 HDV - Vérification utilisateur...');
            
            // Essayer d'abord avec le profil Supabase (contient le username)
            if (window.getUserProfile) {
                const profile = window.getUserProfile();
                // console.log('🟣 Supabase profile:', profile);
                if (profile && profile.username) {
                    // console.log('✅ Profil Supabase trouvé:', profile.username);
                    return {
                        id: profile.id,
                        username: profile.username,
                        email: profile.email || ''
                    };
                }
            }
            
            // Essayer avec getCurrentUser (objet Supabase brut)
            if (window.getCurrentUser) {
                const user = window.getCurrentUser();
                // console.log('🔵 Supabase user:', user);
                if (user) {
                    // Chercher username dans différentes propriétés possibles
                    const username = user.username || 
                                   user.user_metadata?.username || 
                                   user.user_metadata?.name ||
                                   user.email?.split('@')[0];
                    
                    if (username) {
                        // console.log('✅ Utilisateur Supabase trouvé:', username);
                        return {
                            id: user.id,
                            username: username,
                            email: user.email || ''
                        };
                    }
                }
            }
            
            // Vérifier window.currentUserProfile si c'est différent
            if (window.currentUserProfile && window.currentUserProfile.username) {
                // console.log('🟣 CurrentUserProfile trouvé:', window.currentUserProfile.username);
                return {
                    id: window.currentUserProfile.id || 'profile_' + Date.now(),
                    username: window.currentUserProfile.username,
                    email: window.currentUserProfile.email || ''
                };
            }
            
            // Fallback vers localStorage
            const currentUserJSON = localStorage.getItem('currentUser');
            // console.log('💾 localStorage currentUser:', currentUserJSON);
            
            if (currentUserJSON) {
                const currentUser = JSON.parse(currentUserJSON);
                // console.log('🟡 localStorage user:', currentUser);
                if (currentUser && (currentUser.username || currentUser.email)) {
                    // console.log('✅ Utilisateur localStorage trouvé:', currentUser.username || currentUser.email);
                    return {
                        id: currentUser.id || 'local_' + Date.now(),
                        username: currentUser.username || currentUser.email,
                        email: currentUser.email || ''
                    };
                }
            }
            
            // Essayer avec le système d'authentification global
            if (window.currentUser && (window.currentUser.username || window.currentUser.email)) {
                // console.log('🟢 Global currentUser trouvé:', window.currentUser);
                return {
                    id: window.currentUser.id || 'global_' + Date.now(),
                    username: window.currentUser.username || window.currentUser.email,
                    email: window.currentUser.email || ''
                };
            }
            
            // Si on a un profil actif (d'après les logs on voit "Elessarh" quelque part)
            // Essayons de chercher dans d'autres variables globales
            if (window.userProfile && window.userProfile.username) {
                // console.log('🟦 UserProfile trouvé:', window.userProfile.username);
                return {
                    id: window.userProfile.id || 'userprofile_' + Date.now(),
                    username: window.userProfile.username,
                    email: window.userProfile.email || ''
                };
            }
            
            // Vérifier s'il y a un token d'authentification
            const authToken = localStorage.getItem('supabase.auth.token') || 
                            localStorage.getItem('authToken') || 
                            localStorage.getItem('token');
            
            if (authToken) {
                // console.log('🔑 Token trouvé, création utilisateur temporaire');
                // Si on a un token mais pas d'info utilisateur, créer un utilisateur temporaire
                return {
                    id: 'token_user_' + Date.now(),
                    username: 'Utilisateur Connecté',
                    email: ''
                };
            }
            
            // console.log('❌ Aucun utilisateur trouvé');
            
            // Utilisateur non connecté - rediriger vers la connexion
            return null;
        } catch (error) {
            // console.error('❌ Erreur récupération utilisateur:', error);
            return null;
        }
    }

    initializeEventListeners() {
        // Onglets
        document.querySelectorAll('.hdv-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Filtres
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.applyFilters();
        });

        document.getElementById('type-filter')?.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.applyFilters();
        });

        document.getElementById('rarity-filter')?.addEventListener('change', (e) => {
            this.filters.rarity = e.target.value;
            this.applyFilters();
        });

        // Recherche d'items
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        
        if (searchInput) {
            // Recherche en temps réel
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase().trim();
                this.applyFilters();
            });
            
            // Recherche au focus perdu
            searchInput.addEventListener('blur', (e) => {
                this.filters.search = e.target.value.toLowerCase().trim();
                this.applyFilters();
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                if (searchInput) {
                    this.filters.search = searchInput.value.toLowerCase().trim();
                    this.applyFilters();
                }
            });
        }

        // Types d'ordre (vente/achat)
        document.querySelectorAll('.order-type-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectOrderType(e.currentTarget.dataset.type);
            });
        });

        // Initialisation du sélecteur d'items
        this.itemSelector = new ItemSelector();
        
        // Bouton pour ouvrir le sélecteur d'items
        const openSelectorBtn = document.getElementById('open-item-selector');
        if (openSelectorBtn) {
            openSelectorBtn.addEventListener('click', () => {
                this.openItemSelector();
            });
        }

        // Bouton pour changer l'item sélectionné
        const changeItemBtn = document.getElementById('change-item');
        if (changeItemBtn) {
            changeItemBtn.addEventListener('click', () => {
                this.openItemSelector();
            });
        }

        // Bouton refresh du marketplace
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadMarketplace();
                this.showNotification('🔄 Marché actualisé', 'info');
            });
        }

        // Soumission de formulaire
        document.getElementById('create-order-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createOrder();
        });

        // Bouton annuler
        document.querySelector('.cancel-btn')?.addEventListener('click', () => {
            this.resetCreateOrderForm();
        });

        // Délégation globale des actions HDV (remplace les onclick inline)
        this.setupHdvActionDelegation();
    }

    // Un seul listener délégué pour toutes les actions HDV. Les boutons portent
    // data-hdv-action (+ data-order-id / data-suggestion-key). Aucune donnée
    // utilisateur n'est jamais placée dans un handler ni dans un attribut JS.
    setupHdvActionDelegation() {
        if (this._hdvDelegationBound) return;
        this._hdvDelegationBound = true;
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-hdv-action]');
            if (!el) return;
            const action = el.dataset.hdvAction;
            const orderId = el.dataset.orderId;
            switch (action) {
                case 'create-order': this.switchTab('create-order'); break;
                case 'refresh-my-orders': this.loadMyOrders(); break;
                case 'refresh-history': this.loadPurchaseHistory(); break;
                case 'delete-order': this.deleteOrder(orderId); break;
                case 'delete-order-mp': this.deleteOrderFromMarketplace(orderId); break;
                case 'finalize': this.openFinalizeModal(orderId); break;
                case 'cancel-finalize': this.cancelFinalization(orderId); break;
                case 'contact': this.contactTraderById(orderId); break;
                case 'confirm-finalize':
                    if (this.pendingFinalize) {
                        this.confirmFinalization(this.pendingFinalize.orderId, this.pendingFinalize.itemName, this.pendingFinalize.orderType);
                    }
                    break;
                case 'send-custom-message':
                    if (this.pendingContact) {
                        this.sendCustomMessage(this.pendingContact.traderName, this.pendingContact.itemName);
                    }
                    break;
                case 'suggestion': this.applySuggestion(el.dataset.suggestionKey); break;
                case 'close-overlay': {
                    const ov = el.closest('.finalize-modal-overlay, .contact-modal-overlay');
                    if (ov) ov.remove();
                    break;
                }
            }
        });

        // Fallback image sans onerror inline. Les erreurs d'<img> ne bouillonnent
        // pas, mais atteignent la phase de capture au niveau du document.
        document.addEventListener('error', (e) => {
            const t = e.target;
            if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fallback === 'item' && !t.dataset.fallbackApplied) {
                t.dataset.fallbackApplied = '1';
                t.src = '../assets/items/default.png';
            }
        }, true);
    }

    // Construire une suggestion de message depuis le contexte de contact courant
    // (les pseudos/items restent en JS, jamais réinjectés dans du HTML).
    applySuggestion(key) {
        const c = this.pendingContact;
        if (!c) return;
        const price = c.order ? c.order.price : 0;
        let text = '';
        switch (key) {
            case 'interest': text = `Bonjour ${c.traderName}, je suis intéressé par votre ${c.itemName}. Êtes-vous disponible pour discuter ?`; break;
            case 'accept-price': text = `Votre prix de ${price} cols me convient. Quand pouvons-nous nous retrouver en jeu ?`; break;
            case 'negotiate': text = `Pourriez-vous accepter ${Math.floor(price * 0.9)} cols au lieu de ${price} ? Je suis très intéressé.`; break;
            case 'ingame': text = 'Pouvez-vous me contacter en jeu ? Mon pseudo est [VOTRE_PSEUDO]. Merci !'; break;
        }
        if (text) this.addSuggestion(text);
    }

    async switchTab(tabName) {
        // Mise à jour des onglets
        document.querySelectorAll('.hdv-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const tabElement = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // Mise à jour des panneaux
        document.querySelectorAll('.hdv-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(tabName);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        this.currentTab = tabName;

        // Chargement spécifique selon l'onglet (maintenant asynchrone)
        switch (tabName) {
            case 'marketplace':
                await this.loadMarketplace();
                break;
            case 'my-orders':
                await this.loadMyOrders();
                break;
            case 'history':
                await this.loadPurchaseHistory();
                break;
            case 'create-order':
                this.resetCreateOrderForm();
                break;
        }
    }

    async loadMarketplace() {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        // Charger les ordres depuis le stockage (maintenant asynchrone)
        await this.loadOrdersFromStorage();
        
        // Mettre à jour le compteur d'ordres
        this.updateOrdersCount(this.orders.length);
        
        // Afficher tous les ordres dans le marketplace
        this.displayOrders(this.orders);
    }

    // Mettre à jour le compteur d'ordres
    updateOrdersCount(count) {
        const ordersCountEl = document.getElementById('orders-count');
        if (ordersCountEl) {
            ordersCountEl.textContent = `${count} ordre${count !== 1 ? 's' : ''}`;
        }
    }

    async loadMyOrders() {
        const myOrdersList = document.getElementById('my-orders-list');
        if (!myOrdersList) return;

        // Charger les ordres depuis le stockage (maintenant asynchrone)
        await this.loadOrdersFromStorage();

        const userInfo = this.getCurrentUserInfo();

        // Filtrer les ordres de l'utilisateur actuel
        const userOrders = this.myOrders.filter(order => 
            order.creator === userInfo.username || order.creatorId === userInfo.id
        );

        if (userOrders.length === 0) {
            myOrdersList.innerHTML = `
                <div class="empty-state">
                    <h3>📋 Vos Ordres</h3>
                    <p>Vous n'avez pas encore créé d'ordres.</p>
                    <button class="btn btn-primary" data-hdv-action="create-order">
                        ➕ Créer votre premier ordre
                    </button>
                </div>
            `;
            return;
        }

        myOrdersList.innerHTML = `
            <div class="my-orders-header">
                <h3>📋 Mes Ordres (${userOrders.length})</h3>
                <button class="refresh-btn" data-hdv-action="refresh-my-orders">
                    🔄 Actualiser
                </button>
            </div>
            <div class="orders-container">
                ${userOrders.map(order => `
                    <div class="order-card ${order.type} my-order">
                        <div class="order-header">
                            <span class="order-type ${order.type}">
                                ${order.type === 'sell' ? '🔴 VENTE' : '🔵 ACHAT'}
                                <span class="order-date">${this.formatOrderDate(order)}</span>
                            </span>
                            <span class="order-time">${this.formatTime(order.timestamp)}</span>
                            <button class="delete-order-btn" data-hdv-action="delete-order" data-order-id="${_hdvEscA(order.id)}" title="Supprimer cet ordre">
                                🗑️
                            </button>
                        </div>
                        
                        <div class="order-content">
                            <div class="order-item">
                                <img src="../assets/items/${_hdvEscA(order.item.image)}" alt="${_hdvEscA(order.item.name)}" data-fallback="item">
                                <div class="order-item-info">
                                    <h5>${_hdvEsc(order.item.name)}</h5>
                                    <span class="item-category">${this.getItemCategory(order.item)}</span>
                                </div>
                            </div>
                            
                            <div class="order-details">
                                <div class="order-quantity">
                                    <span>Quantité: <strong>${order.quantity}</strong></span>
                                </div>
                                <div class="order-price">
                                    <span>Prix: <strong>${order.price} cols</strong></span>
                                </div>
                                <div class="order-status">
                                    <span class="status-active">🟢 Actif</span>
                                </div>
                                <div class="order-actions-my">
                                    <button class="btn btn-success btn-small" data-hdv-action="finalize" data-order-id="${_hdvEscA(order.id)}" title="Transaction terminée">
                                        ✅ Vendu/Acheté
                                    </button>
                                    <button class="btn btn-danger btn-small" data-hdv-action="delete-order" data-order-id="${_hdvEscA(order.id)}" title="Supprimer cet ordre sans historique" style="background: #e74c3c; margin-top: 0.5rem;">
                                        🗑️ Supprimer l'ordre
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async deleteOrder(orderId) {
        if (!confirm('❓ Êtes-vous sûr de vouloir supprimer cet ordre ?')) return;

        try {
            let orderDeleted = false;
            
            // Essayer de supprimer de Supabase d'abord
            if (window.hdvSupabaseManager && window.hdvSupabaseManager.isSupabaseAvailable()) {
                try {
                    // console.log('🗑️ Suppression ordre de Supabase...');
                    const success = await window.hdvSupabaseManager.deleteOrderFromSupabase(orderId);
                    if (success) {
                        // console.log('✅ Ordre supprimé de Supabase');
                        orderDeleted = true;
                    }
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec suppression Supabase, suppression locale uniquement:', supabaseError);
                }
            }

            // Supprimer des listes locales (toujours nécessaire)
            this.orders = this.orders.filter(order => String(order.id) !== String(orderId));
            this.myOrders = this.myOrders.filter(order => String(order.id) !== String(orderId));

            // Sauvegarder les modifications en local
            localStorage.setItem('hdv_orders', JSON.stringify(this.orders));
            localStorage.setItem('hdv_my_orders', JSON.stringify(this.myOrders));

            // Invalider le cache
            this.cache.lastUpdate = null;

            // Recharger l'affichage
            this.loadMyOrders();
            
            this.showNotification('✅ Ordre supprimé avec succès', 'success');
        } catch (error) {
            // console.error('❌ Erreur lors de la suppression:', error);
            this.showNotification('❌ Erreur lors de la suppression: ' + error.message, 'error');
        }
    }

    // Vérifier si un ordre appartient à l'utilisateur connecté
    isMyOrder(order) {
        const userInfo = this.getCurrentUserInfo();
        const isOwner = userInfo && (order.creator === userInfo.username || order.creatorId === userInfo.id);
        return isOwner;
    }

    // Charger l'historique des transactions
    async loadPurchaseHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        const userInfo = this.getCurrentUserInfo();
        if (!userInfo) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <h3>🔒 Connexion requise</h3>
                    <p>Vous devez être connecté pour voir votre historique</p>
                </div>
            `;
            return;
        }

        try {
            let history = [];

            // Essayer de charger depuis Supabase d'abord
            if (window.hdvSupabaseManager && window.hdvSupabaseManager.isSupabaseAvailable()) {
                try {
                    // console.log('📥 Chargement historique depuis Supabase...');
                    history = await window.hdvSupabaseManager.getUserPurchaseHistory(userInfo.id);
                    // console.log('✅ Historique chargé:', history);
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec chargement Supabase, fallback localStorage:', supabaseError);
                }
            }

            // Fallback vers localStorage
            if (history.length === 0) {
                const localHistory = localStorage.getItem('hdv_purchase_history');
                if (localHistory) {
                    history = JSON.parse(localHistory);
                    // Filtrer pour l'utilisateur actuel
                    history = history.filter(t => 
                        t.sellerId === userInfo.id || t.buyerId === userInfo.id ||
                        t.seller_id === userInfo.id || t.buyer_id === userInfo.id
                    );
                }
            }

            if (history.length === 0) {
                historyList.innerHTML = `
                    <div class="empty-state">
                        <h3>📜 Historique vide</h3>
                        <p>Aucune transaction finalisée pour le moment</p>
                        <p>Les transactions que vous finalisez via "Vendu/Acheté" apparaîtront ici</p>
                    </div>
                `;
                return;
            }

            // Afficher l'historique
            historyList.innerHTML = `
                <div class="history-header">
                    <h3>📜 Historique des Transactions (${history.length})</h3>
                    <button class="refresh-btn" data-hdv-action="refresh-history">
                        🔄 Actualiser
                    </button>
                </div>
                <div class="history-container">
                    ${history.map(transaction => {
                        const isSeller = transaction.seller_id === userInfo.id || transaction.sellerId === userInfo.id;
                        const otherParty = isSeller ? 
                            (transaction.buyer_name || transaction.buyerName) : 
                            (transaction.seller_name || transaction.sellerName);
                        const transactionType = isSeller ? 'vente' : 'achat';
                        const transactionIcon = isSeller ? '🔴' : '🔵';
                        
                        return `
                            <div class="history-card ${transactionType}">
                                <div class="history-header-card">
                                    <span class="history-type ${transactionType}">
                                        ${transactionIcon} ${transactionType.toUpperCase()}
                                        <span class="history-date">${new Date(transaction.created_at || transaction.timestamp).toLocaleDateString('fr-FR')}</span>
                                    </span>
                                    <span class="history-time">${new Date(transaction.created_at || transaction.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                
                                <div class="history-content">
                                    <div class="history-item">
                                        <img src="../assets/items/${_hdvEscA(transaction.item_image || transaction.itemImage)}"
                                             alt="${_hdvEscA(transaction.item_name || transaction.itemName)}"
                                             data-fallback="item">
                                        <div class="history-item-info">
                                            <h5>${_hdvEsc(transaction.item_name || transaction.itemName)}</h5>
                                            <span class="item-category">${_hdvEsc(transaction.item_category || transaction.itemCategory || 'Catégorie inconnue')}</span>
                                        </div>
                                    </div>
                                    
                                    <div class="history-details">
                                        <div class="history-party">
                                            <span>${isSeller ? 'Acheteur' : 'Vendeur'}: <strong>${_hdvEsc(otherParty)}</strong></span>
                                        </div>
                                        <div class="history-quantity">
                                            <span>Quantité: <strong>${transaction.quantity}</strong></span>
                                        </div>
                                        <div class="history-price">
                                            <span>Prix total: <strong>${transaction.total_price || transaction.totalPrice} cols</strong></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (error) {
            // console.error('❌ Erreur chargement historique:', error);
            historyList.innerHTML = `
                <div class="empty-state">
                    <h3>❌ Erreur</h3>
                    <p>Impossible de charger l'historique</p>
                    <p>${_hdvEsc(error.message)}</p>
                </div>
            `;
        }
    }

    // Supprimer un ordre depuis le marketplace
    async deleteOrderFromMarketplace(orderId) {
        // console.log('🗑️ Tentative de suppression ordre ID:', orderId, 'Type:', typeof orderId);
        
        if (!confirm('❓ Êtes-vous sûr de vouloir supprimer cet ordre ?')) return;

        try {
            let orderDeleted = false;
            
            // Utiliser l'ID tel quel (UUID ou numérique)
            // console.log('🗑️ ID à supprimer:', orderId);
            
            // Essayer de supprimer de Supabase d'abord
            if (window.hdvSupabaseManager && window.hdvSupabaseManager.isSupabaseAvailable()) {
                try {
                    // console.log('🗑️ Suppression ordre de Supabase...');
                    const success = await window.hdvSupabaseManager.deleteOrderFromSupabase(orderId);
                    if (success) {
                        // console.log('✅ Ordre supprimé de Supabase');
                        orderDeleted = true;
                    }
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec suppression Supabase, suppression locale uniquement:', supabaseError);
                }
            }

            // Supprimer des listes locales (toujours nécessaire)
            // Comparer les IDs en tant que string pour compatibilité UUID/numérique
            this.orders = this.orders.filter(order => String(order.id) !== String(orderId));
            this.myOrders = this.myOrders.filter(order => String(order.id) !== String(orderId));

            // Sauvegarder en local
            localStorage.setItem('hdv_orders', JSON.stringify(this.orders));
            localStorage.setItem('hdv_my_orders', JSON.stringify(this.myOrders));

            // Recharger l'affichage du marketplace
            this.loadMarketplace();
            
            this.showNotification('✅ Ordre supprimé avec succès', 'success');
        } catch (error) {
            // console.error('❌ Erreur lors de la suppression:', error);
            this.showNotification('❌ Erreur lors de la suppression: ' + error.message, 'error');
        }
    }

    // Finaliser une transaction (vente terminée)
    async finalizeTransaction(orderId, itemName, orderType) {
        const actionText = orderType === 'sell' ? 'vente' : 'achat';
        if (!confirm(`✅ Êtes-vous sûr que cette ${actionText} de "${itemName}" est terminée ?\n\nL'ordre sera supprimé automatiquement dans 1 minute.`)) {
            return;
        }

        try {
            // Marquer l'ordre comme finalisé avec un état temporaire
            const orderElement = document.querySelector(`[data-order-id="${orderId}"]`);
            if (orderElement) {
                // Ajouter un indicateur visuel
                const actions = orderElement.querySelector('.order-actions');
                actions.innerHTML = `
                    <div class="transaction-finalized">
                        <span class="finalized-text">✅ Transaction finalisée</span>
                        <span class="countdown-text">Suppression dans <span id="countdown-${orderId}">60</span>s</span>
                        <button class="btn btn-small btn-secondary" data-hdv-action="cancel-finalize" data-order-id="${_hdvEscA(orderId)}">
                            ↩️ Annuler
                        </button>
                    </div>
                `;
                
                // Ajouter une classe pour le style
                orderElement.classList.add('order-finalized');
            }

            this.showNotification(`✅ ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} de "${itemName}" finalisée ! Suppression automatique dans 1 minute.`, 'success');

            // Démarrer le compte à rebours
            this.startDeletionCountdown(orderId, itemName, orderType);

        } catch (error) {
            // console.error('❌ Erreur lors de la finalisation:', error);
            this.showNotification('❌ Erreur lors de la finalisation', 'error');
        }
    }

    // Démarrer le compte à rebours de suppression
    startDeletionCountdown(orderId, itemName, orderType) {
        let timeLeft = 60; // 60 secondes
        const countdownElement = document.getElementById(`countdown-${orderId}`);
        
        const countdownInterval = setInterval(() => {
            timeLeft--;
            
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                this.executeAutoDeletion(orderId, itemName, orderType);
            }
        }, 1000);
        
        // Stocker l'interval pour pouvoir l'annuler
        if (!this.deletionTimers) this.deletionTimers = new Map();
        this.deletionTimers.set(orderId, countdownInterval);
    }

    // Annuler la finalisation
    cancelFinalization(orderId) {
        // Arrêter le timer
        if (this.deletionTimers && this.deletionTimers.has(orderId)) {
            clearInterval(this.deletionTimers.get(orderId));
            this.deletionTimers.delete(orderId);
        }

        // Restaurer l'affichage normal
        const orderElement = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderElement) {
            orderElement.classList.remove('order-finalized');
            // Recharger l'affichage du marketplace pour restaurer les boutons
            this.loadMarketplace();
        }

        this.showNotification('↩️ Finalisation annulée', 'info');
    }

    // Exécuter la suppression automatique
    async executeAutoDeletion(orderId, itemName, orderType) {
        const actionText = orderType === 'sell' ? 'vente' : 'achat';
        
        try {
            // Supprimer l'ordre
            await this.deleteOrderFromMarketplace(orderId);
            this.showNotification(`🗑️ ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} de "${itemName}" automatiquement supprimée`, 'info');
            
            // Nettoyer le timer
            if (this.deletionTimers) {
                this.deletionTimers.delete(orderId);
            }
        } catch (error) {
            // console.error('❌ Erreur suppression auto:', error);
            this.showNotification('❌ Erreur lors de la suppression automatique', 'error');
        }
    }

    // Ouvrir la modal de finalisation de transaction
    openFinalizeModal(orderId, itemName, orderType) {
        // Appel par délégation avec seulement l'ID: déduire item/type de l'ordre.
        if (itemName === undefined || orderType === undefined) {
            const order = this.orders.find(o => String(o.id) === String(orderId)) ||
                          this.myOrders.find(o => String(o.id) === String(orderId));
            if (!order) { this.showNotification('❌ Ordre non trouvé', 'error'); return; }
            itemName = order.item.name;
            orderType = order.type;
        }
        // Contexte mémorisé pour la confirmation (jamais réinjecté dans le DOM).
        this.pendingFinalize = { orderId: orderId, itemName: itemName, orderType: orderType };

        const actionText = orderType === 'sell' ? 'vendu' : 'acheté';
        const otherParty = orderType === 'sell' ? 'acheteur' : 'vendeur';
        
        const modal = document.createElement('div');
        modal.className = 'finalize-modal-overlay';
        modal.innerHTML = `
            <div class="finalize-modal">
                <div class="finalize-header">
                    <h3>✅ Finaliser la transaction</h3>
                    <p>Vous avez <strong>${_hdvEsc(actionText)}</strong> : <strong>${_hdvEsc(itemName)}</strong></p>
                    <button class="close-modal" data-hdv-action="close-overlay">❌</button>
                </div>
                
                <div class="finalize-content">
                    <div class="form-group">
                        <label for="other-party-name">À qui avez-vous ${actionText} cet item ?</label>
                        <input 
                            type="text" 
                            id="other-party-name" 
                            placeholder="Nom du ${otherParty}"
                            maxlength="50"
                            required
                        >
                        <p class="hint">Cette information sera sauvegardée dans l'historique pour les deux parties.</p>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-secondary" data-hdv-action="close-overlay">
                            ↩️ Annuler
                        </button>
                        <button class="btn btn-success" data-hdv-action="confirm-finalize">
                            ✅ Confirmer la transaction
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus sur l'input
        setTimeout(() => {
            const input = document.getElementById('other-party-name');
            if (input) input.focus();
        }, 100);
        
        // Fermer avec Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Permettre de valider avec Enter
        const enterHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.confirmFinalization(orderId, itemName, orderType);
            }
        };
        const input = document.getElementById('other-party-name');
        if (input) {
            input.addEventListener('keypress', enterHandler);
        }
    }

    // Confirmer la finalisation avec le nom de l'autre partie
    async confirmFinalization(orderId, itemName, orderType) {
        const otherPartyInput = document.getElementById('other-party-name');
        if (!otherPartyInput) {
            this.showNotification('❌ Erreur: Champ non trouvé', 'error');
            return;
        }

        const otherPartyName = otherPartyInput.value.trim();
        
        if (!otherPartyName) {
            this.showNotification('❌ Veuillez entrer le nom de l\'autre partie', 'error');
            otherPartyInput.focus();
            return;
        }

        // Fermer la modal
        document.querySelector('.finalize-modal-overlay')?.remove();

        // Procéder à la finalisation
        await this.finalizeTransactionInstant(orderId, itemName, orderType, otherPartyName);
    }

    // Finaliser une transaction instantanément (depuis Mes Ordres)
    async finalizeTransactionInstant(orderId, itemName, orderType, otherPartyName = null) {
        const actionText = orderType === 'sell' ? 'vente' : 'achat';
        
        try {
            // console.log('⚡ Finalisation instantanée:', { orderId, itemName, orderType, otherPartyName });
            
            // Récupérer l'ordre complet pour avoir toutes les informations
            const order = this.orders.find(o => String(o.id) === String(orderId)) || 
                         this.myOrders.find(o => String(o.id) === String(orderId));
            
            if (!order) {
                throw new Error('Ordre non trouvé');
            }

            // Obtenir l'utilisateur actuel
            const currentUser = this.getCurrentUserInfo();
            if (!currentUser) {
                throw new Error('Utilisateur non connecté');
            }

            // Déterminer qui est le vendeur et qui est l'acheteur
            let sellerName, sellerId, buyerName, buyerId;
            
            if (orderType === 'sell') {
                // L'utilisateur actuel est le vendeur
                sellerName = currentUser.username;
                sellerId = currentUser.id;
                // L'acheteur est la personne spécifiée
                buyerName = otherPartyName || 'Acheteur inconnu';
                buyerId = 'unknown'; // On n'a pas l'ID de l'acheteur
            } else {
                // L'utilisateur actuel est l'acheteur
                buyerName = currentUser.username;
                buyerId = currentUser.id;
                // Le vendeur est la personne spécifiée
                sellerName = otherPartyName || 'Vendeur inconnu';
                sellerId = 'unknown'; // On n'a pas l'ID du vendeur
            }

            // Préparer les données pour l'historique
            const transactionData = {
                orderId: order.id,
                sellerName: sellerName,
                sellerId: sellerId,
                buyerName: buyerName,
                buyerId: buyerId,
                itemName: order.item.name,
                itemImage: order.item.image,
                itemCategory: this.getItemCategory(order.item),
                quantity: order.quantity,
                price: order.price,
                totalPrice: order.total || (order.price * order.quantity),
                transactionType: orderType
            };

            // console.log('📊 Données transaction pour historique:', transactionData);

            // Sauvegarder dans l'historique (Supabase + localStorage)
            let historySaved = false;
            
            // Essayer de sauvegarder dans Supabase d'abord
            if (window.hdvSupabaseManager && window.hdvSupabaseManager.isSupabaseAvailable()) {
                try {
                    // console.log('💾 Sauvegarde transaction dans l\'historique Supabase...');
                    await window.hdvSupabaseManager.saveTransactionToHistory(transactionData);
                    // console.log('✅ Transaction sauvegardée dans l\'historique Supabase');
                    historySaved = true;
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec sauvegarde historique Supabase:', supabaseError);
                }
            }

            // Sauvegarder en localStorage comme fallback
            if (!historySaved) {
                // console.log('💾 Sauvegarde transaction dans localStorage...');
                const history = JSON.parse(localStorage.getItem('hdv_purchase_history') || '[]');
                history.push({
                    ...transactionData,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('hdv_purchase_history', JSON.stringify(history));
                // console.log('✅ Transaction sauvegardée dans localStorage');
            }

            // Supprimer immédiatement l'ordre
            let orderDeleted = false;
            
            // Essayer de supprimer de Supabase d'abord
            if (window.hdvSupabaseManager && window.hdvSupabaseManager.isSupabaseAvailable()) {
                try {
                    // console.log('🗑️ Suppression ordre de Supabase...');
                    const success = await window.hdvSupabaseManager.deleteOrderFromSupabase(orderId);
                    if (success) {
                        // console.log('✅ Ordre supprimé de Supabase');
                        orderDeleted = true;
                    }
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec suppression Supabase, suppression locale uniquement:', supabaseError);
                }
            }

            // Supprimer des listes locales (toujours nécessaire)
            this.orders = this.orders.filter(order => String(order.id) !== String(orderId));
            this.myOrders = this.myOrders.filter(order => String(order.id) !== String(orderId));

            // Sauvegarder en local
            localStorage.setItem('hdv_orders', JSON.stringify(this.orders));
            localStorage.setItem('hdv_my_orders', JSON.stringify(this.myOrders));

            // Recharger les affichages
            this.loadMyOrders();      // Recharger Mes Ordres
            this.loadMarketplace();   // Recharger Marketplace

            this.showNotification(`🎉 ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} de "${itemName}" finalisée et sauvegardée dans l'historique !`, 'success');

        } catch (error) {
            // console.error('❌ Erreur lors de la finalisation instantanée:', error);
            this.showNotification('❌ Erreur lors de la finalisation: ' + error.message, 'error');
        }
    }

    displayOrders(orders) {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        // Vérifier que orders est défini et est un tableau
        if (!orders || !Array.isArray(orders)) {
            // console.warn('⚠️ displayOrders: orders non défini ou pas un tableau:', orders);
            orders = [];
        }

        if (orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <h3>🏪 Place du Marché</h3>
                    <p>Aucun ordre disponible pour le moment.</p>
                    <p>Soyez le premier à créer un ordre d'achat ou de vente !</p>
                    <button class="btn btn-primary" data-hdv-action="create-order">
                        ➕ Créer un ordre
                    </button>
                </div>
            `;
            return;
        }

        // Optimisation : Utiliser DocumentFragment pour un rendu plus rapide
        const fragment = document.createDocumentFragment();
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'marketplace-header';
        headerDiv.innerHTML = `
            <h3>🏪 Place du Marché (${orders.length} ordre${orders.length > 1 ? 's' : ''})</h3>
            <p>💡 <strong>Astuce:</strong> Vous pouvez supprimer vos propres ordres en cliquant sur le bouton "🗑️ Supprimer"</p>
        `;
        fragment.appendChild(headerDiv);

        const ordersGrid = document.createElement('div');
        ordersGrid.className = 'orders-grid';

        // Limiter l'affichage initial à 20 ordres pour accélérer le rendu
        const maxInitialDisplay = 20;
        const ordersToDisplay = orders.slice(0, maxInitialDisplay);
        const remainingOrders = orders.slice(maxInitialDisplay);

        // Afficher les premiers ordres immédiatement
        ordersToDisplay.forEach(order => {
            ordersGrid.appendChild(this.createOrderCard(order));
        });

        fragment.appendChild(ordersGrid);
        
        // Vider et afficher
        ordersList.innerHTML = '';
        ordersList.appendChild(fragment);

        // Charger les ordres restants progressivement (lazy loading)
        if (remainingOrders.length > 0) {
            setTimeout(() => {
                const batchSize = 10;
                let currentIndex = 0;

                const loadNextBatch = () => {
                    const batch = remainingOrders.slice(currentIndex, currentIndex + batchSize);
                    const ordersGridElement = ordersList.querySelector('.orders-grid');
                    
                    if (ordersGridElement && batch.length > 0) {
                        batch.forEach(order => {
                            ordersGridElement.appendChild(this.createOrderCard(order));
                        });
                    }

                    currentIndex += batchSize;

                    if (currentIndex < remainingOrders.length) {
                        requestAnimationFrame(loadNextBatch);
                    }
                };

                loadNextBatch();
            }, 100);
        }
    }

    createOrderCard(order) {
        const card = document.createElement('div');
        card.className = `order-card ${order.type}`;
        card.setAttribute('data-order-id', order.id);

        card.innerHTML = `
            <!-- Header: Image + Nom + Prix -->
            <div class="order-header">
                <img src="../assets/items/${_hdvEscA(order.item.image)}"
                     alt="${_hdvEscA(order.item.name)}"
                     class="order-item-image"
                     data-fallback="item"
                     loading="lazy">
                <div class="order-details">
                    <h3 class="order-item-name">${_hdvEsc(order.item.name)}</h3>
                    <div class="order-tags">
                        <span class="item-category">${this.getItemCategory(order.item)}</span>
                        <span class="item-rarity" style="color: ${this.getRarityColor(order.item)}">${this.getRarityDisplayName(order.item)}</span>
                    </div>
                </div>
                <div class="order-price">${order.price} <small>cols</small></div>
            </div>
            
            <!-- Footer: Meta + Actions -->
            <div class="order-footer">
                <div class="order-meta">
                    <span class="meta-tag ${order.type}">${order.type === 'sell' ? '🔴 Vente' : '🔵 Achat'}</span>
                    <span>📦 ${order.quantity}</span>
                    <span>👤 ${_hdvEsc(order.creator || order.seller || order.buyer || 'Anonyme')}</span>
                </div>
                <div class="order-actions">
                    <button class="contact-btn" data-hdv-action="contact" data-order-id="${_hdvEscA(order.id)}">
                        💬 Contacter
                    </button>
                    ${this.isMyOrder(order) ? `
                        <button class="delete-btn" data-hdv-action="delete-order-mp" data-order-id="${_hdvEscA(order.id)}">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        return card;
    }

    // Ouvrir le sélecteur d'items avec images
    openItemSelector() {
        this.itemSelector.open((selectedItem) => {
            this.selectItem(selectedItem);
        });
    }

    // Sélectionner un item depuis le sélecteur
    selectItem(item) {
        this.selectedItem = item;

        // Mise à jour de l'affichage
        const selectedItemContainer = document.getElementById('selected-item');
        const openSelectorBtn = document.getElementById('open-item-selector');
        
        if (selectedItemContainer && item) {
            selectedItemContainer.style.display = 'block';
            
            const itemImg = document.getElementById('selected-item-img');
            const itemName = document.getElementById('selected-item-name');
            
            if (itemImg) {
                itemImg.src = `../assets/items/${item.image}`;
                itemImg.alt = item.name;
                itemImg.onerror = function() { this.src = '../assets/items/default.png'; };
            }
            
            if (itemName) {
                itemName.textContent = item.name;
            }
        }

        if (openSelectorBtn) {
            openSelectorBtn.style.display = 'none';
        }

        // console.log('Item sélectionné:', item);
    }

    // Effacer la sélection d'item
    clearSelectedItem() {
        this.selectedItem = null;
        
        const selectedItemContainer = document.getElementById('selected-item');
        const openSelectorBtn = document.getElementById('open-item-selector');
        
        if (selectedItemContainer) {
            selectedItemContainer.style.display = 'none';
        }
        
        if (openSelectorBtn) {
            openSelectorBtn.style.display = 'block';
        }
    }

    clearSelectedItem() {
        this.selectedItem = null;
        
        const selectedItemContainer = document.getElementById('selected-item');
        const openSelectorBtn = document.getElementById('open-item-selector');
        
        if (selectedItemContainer) {
            selectedItemContainer.style.display = 'none';
        }
        
        if (openSelectorBtn) {
            openSelectorBtn.style.display = 'block';
        }
    }

    selectOrderType(type) {
        this.orderType = type;
        
        // Mise à jour visuelle des cartes
        document.querySelectorAll('.order-type-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        
        // Afficher le formulaire
        const form = document.getElementById('create-order-form');
        if (form) {
            form.style.display = 'block';
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Mise à jour du label
        const orderTypeLabel = document.getElementById('order-type-label');
        if (orderTypeLabel) {
            orderTypeLabel.textContent = type === 'sell' ? '🔴 VENTE' : '🔵 ACHAT';
            orderTypeLabel.className = `order-type-label ${type}`;
        }

        // Notification supprimée pour éviter le spam
    }

    async createOrder() {
        // Vérification obligatoire de l'authentification
        const userInfo = this.getCurrentUserInfo();
        if (!userInfo) {
            this.showNotification('❌ Vous devez être connecté pour créer un ordre', 'error');
            this.redirectToLogin();
            return;
        }

        if (!this.selectedItem) {
            this.showNotification('❌ Veuillez sélectionner un item', 'error');
            return;
        }

        if (!this.orderType) {
            this.showNotification('❌ Veuillez sélectionner le type d\'ordre (vente/achat)', 'error');
            return;
        }

        const quantity = parseInt(document.getElementById('quantity').value);
        const price = parseInt(document.getElementById('price').value);
        const notes = document.getElementById('notes').value.trim(); // Récupération des notes

        if (!quantity || quantity <= 0) {
            this.showNotification('❌ Quantité invalide', 'error');
            return;
        }

        if (!price || price <= 0) {
            this.showNotification('❌ Prix invalide', 'error');
            return;
        }

        // Enrichir l'item avec catégorie et rareté automatiques
        const enrichedItem = {
            ...this.selectedItem,
            category: this.getItemCategory(this.selectedItem),
            rarity: this.getItemRarity(this.selectedItem)
        };

        // Création de l'ordre
        const newOrder = {
            id: Date.now(),
            type: this.orderType,
            item: enrichedItem,
            quantity: quantity,
            price: price,
            total: quantity * price,
            notes: notes || null, // Ajout des notes à l'ordre
            seller: this.orderType === 'sell' ? userInfo.username : null,
            buyer: this.orderType === 'buy' ? userInfo.username : null,
            sellerId: this.orderType === 'sell' ? userInfo.id : null,
            buyerId: this.orderType === 'buy' ? userInfo.id : null,
            timestamp: new Date(),
            creator: userInfo.username,
            creatorId: userInfo.id,
            username: userInfo.username
        };

        try {
            let orderSaved = false;
            
            // Essayer de sauvegarder dans Supabase d'abord
            if (window.hdvSupabaseManager && window.hdvSupabaseManager.isSupabaseAvailable()) {
                try {
                    // console.log('💾 Sauvegarde ordre dans Supabase...');
                    const savedOrder = await window.hdvSupabaseManager.saveOrderToSupabase(newOrder);
                    newOrder.id = savedOrder.id; // Utiliser l'ID généré par Supabase
                    // console.log('✅ Ordre sauvegardé dans Supabase avec ID:', savedOrder.id);
                    orderSaved = true;
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec sauvegarde Supabase, basculement vers localStorage:', supabaseError);
                }
            }
            
            // Fallback vers localStorage si Supabase a échoué ou n'est pas disponible
            if (!orderSaved) {
                // console.log('💾 Sauvegarde locale dans localStorage...');
                this.orders.push(newOrder);
                this.myOrders.push(newOrder);
                localStorage.setItem('hdv_orders', JSON.stringify(this.orders));
                localStorage.setItem('hdv_my_orders', JSON.stringify(this.myOrders));
                // console.log('✅ Ordre sauvegardé localement');
            }

            // Invalider le cache
            this.cache.lastUpdate = null;

            this.showNotification('✅ Ordre créé avec succès !', 'success');
            this.resetCreateOrderForm();
            
            // Retour à l'onglet marketplace pour voir l'ordre créé
            await this.switchTab('marketplace');
            
            // Recharger les données pour inclure le nouvel ordre
            setTimeout(async () => {
                await this.loadOrdersFromStorage();
                await this.loadMarketplace();
            }, 500);
            
        } catch (error) {
            // console.error('❌ Erreur lors de la création de l\'ordre:', error);
            this.showNotification('❌ Erreur lors de la création de l\'ordre: ' + error.message, 'error');
        }
    }

    async saveOrdersToStorage() {
        // Nouvelle version avec Supabase - ne fait plus rien en local
        // Les ordres sont maintenant sauvegardés directement dans Supabase lors de leur création
        // console.log('ℹ️ saveOrdersToStorage: Les ordres sont maintenant gérés par Supabase');
    }

    async loadOrdersFromStorage() {
        try {
            // 1. Charger depuis localStorage IMMÉDIATEMENT pour affichage rapide
            const localOrders = localStorage.getItem('hdv_orders');
            const localMyOrders = localStorage.getItem('hdv_my_orders');
            
            if (localOrders) {
                this.orders = JSON.parse(localOrders);
                this.myOrders = localMyOrders ? JSON.parse(localMyOrders) : [];
                // console.log('⚡ Affichage rapide depuis localStorage:', this.orders.length, 'ordres');
                
                // Mettre à jour l'affichage immédiatement
                if (this.currentTab === 'marketplace') {
                    this.displayOrders(this.orders);
                }
            }

            // 2. Vérifier le cache en mémoire
            const now = Date.now();
            if (this.cache.orders && this.cache.lastUpdate && (now - this.cache.lastUpdate < this.cache.cacheTimeout)) {
                // console.log('📦 Utilisation du cache mémoire (frais)');
                return;
            }

            // 3. Charger depuis Supabase en arrière-plan pour mise à jour
            // console.log('� Mise à jour depuis Supabase en arrière-plan...');
            
            if (!window.hdvSupabaseManager || !window.hdvSupabaseManager.isSupabaseAvailable()) {
                // console.warn('⚠️ HDV Supabase Manager non disponible, utilisation données locales');
                return;
            }

            const { orders, myOrders } = await window.hdvSupabaseManager.loadOrdersFromSupabase();
            
            // Vérifier si les données ont changé
            const hasChanged = JSON.stringify(orders) !== JSON.stringify(this.orders);
            
            if (hasChanged) {
                // console.log('🆕 Nouvelles données détectées, mise à jour...');
                this.orders = orders;
                this.myOrders = myOrders;
                
                // Mettre à jour localStorage
                localStorage.setItem('hdv_orders', JSON.stringify(orders));
                localStorage.setItem('hdv_my_orders', JSON.stringify(myOrders));
                
                // Mettre à jour le cache
                this.cache.orders = orders;
                this.cache.myOrders = myOrders;
                this.cache.lastUpdate = now;
                
                // Rafraîchir l'affichage si on est sur le marketplace
                if (this.currentTab === 'marketplace') {
                    this.displayOrders(this.orders);
                }
            } else {
                // console.log('✅ Données à jour depuis Supabase');
                // Mettre à jour le cache quand même
                this.cache.orders = orders;
                this.cache.myOrders = myOrders;
                this.cache.lastUpdate = now;
            }
            
        } catch (error) {
            // console.error('❌ Erreur chargement:', error);
            // En cas d'erreur, on garde les données locales déjà chargées
        }
    }

    // Fonction de fallback pour localStorage
    loadOrdersFromLocalStorage() {
        const savedOrders = localStorage.getItem('hdv_orders');
        const savedMyOrders = localStorage.getItem('hdv_my_orders');
        
        if (savedOrders) {
            this.orders = JSON.parse(savedOrders);
        }
        
        if (savedMyOrders) {
            this.myOrders = JSON.parse(savedMyOrders);
        }
        
        // console.log('📦 Données chargées depuis localStorage (fallback)');
    }

    resetCreateOrderForm() {
        this.selectedItem = null;
        this.orderType = null;
        
        // Réinitialiser le sélecteur d'items
        this.clearSelectedItem();
        
        // Réinitialiser les autres champs
        document.getElementById('quantity').value = '1';
        document.getElementById('price').value = '';
        document.getElementById('notes').value = '';
        
        // Réinitialiser les cartes de type d'ordre
        document.querySelectorAll('.order-type-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Réinitialiser le label du type d'ordre
        const orderTypeLabel = document.getElementById('order-type-label');
        if (orderTypeLabel) {
            orderTypeLabel.textContent = 'Sélectionnez le type d\'ordre';
            orderTypeLabel.className = 'order-type-label';
        }
        
        // Masquer le formulaire
        const form = document.getElementById('order-form');
        if (form) {
            form.style.display = 'none';
        }
    }

    applyFilters() {
        let filteredOrders = [...this.orders];

        // Filtre par type
        if (this.filters.type !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.type === this.filters.type);
        }

        // Filtre par catégorie
        if (this.filters.category !== 'all') {
            filteredOrders = filteredOrders.filter(order => 
                this.getItemCategory(order.item).toLowerCase().includes(this.filters.category.toLowerCase())
            );
        }

        // Filtre par rareté
        if (this.filters.rarity !== 'all') {
            filteredOrders = filteredOrders.filter(order => 
                this.getItemRarity(order.item) === this.filters.rarity
            );
        }

        // Filtre par recherche textuelle
        if (this.filters.search && this.filters.search.length > 0) {
            filteredOrders = filteredOrders.filter(order => {
                const itemName = order.item.name.toLowerCase();
                const itemCategory = this.getItemCategory(order.item).toLowerCase();
                const creatorName = (order.creator || order.seller || order.buyer || '').toLowerCase();
                const notes = (order.notes || '').toLowerCase();
                
                return itemName.includes(this.filters.search) ||
                       itemCategory.includes(this.filters.search) ||
                       creatorName.includes(this.filters.search) ||
                       notes.includes(this.filters.search);
            });
        }

        this.displayOrders(filteredOrders);
    }

    // Contacter un trader à partir de l'ID de l'ordre (délégation). Évite de
    // faire transiter pseudo/nom d'item par un attribut ou un handler.
    contactTraderById(orderId) {
        const order = this.orders.find(o => String(o.id) === String(orderId)) ||
                      this.myOrders.find(o => String(o.id) === String(orderId));
        if (!order) {
            this.showNotification('❌ Impossible de trouver les détails de l\'ordre', 'error');
            return;
        }
        const traderName = order.creator || order.seller || order.buyer || '';
        this.contactTrader(traderName, order.item.name);
    }

    contactTrader(traderName, itemName) {
        const currentUser = this.getCurrentUserInfo();
        
        
        // Vérifier l'authentification
        if (!currentUser) {
            this.showNotification('❌ Vous devez être connecté pour contacter un trader !', 'error');
            this.redirectToLogin();
            return;
        }
        
        // Comparaison des utilisateurs
        if (traderName === currentUser.username) {
            this.showNotification('❌ Vous ne pouvez pas vous contacter vous-même !', 'error');
            return;
        }

        // Trouver l'ordre correspondant pour obtenir plus d'infos
        const order = this.orders.find(o => 
            (o.seller === traderName || o.buyer === traderName || o.creator === traderName) && 
            o.item.name === itemName
        );
        
        if (!order) {
            // console.warn('❌ Ordre non trouvé pour le contact');
            this.showNotification('❌ Impossible de trouver les détails de l\'ordre', 'error');
            return;
        }

        // Ouvrir directement l'interface de composition de message personnalisé
        this.openCustomMessageModal(traderName, itemName, order);
    }

    openCustomMessageModal(traderName, itemName, order) {
        // Contexte mémorisé en JS pour les suggestions et l'envoi (jamais
        // réinjecté dans un onclick ni un attribut).
        this.pendingContact = { traderName: traderName, itemName: itemName, order: order };

        const modal = document.createElement('div');
        modal.className = 'contact-modal-overlay';
        modal.innerHTML = `
            <div class="contact-modal">
                <div class="contact-header">
                    <h3>💬 Contacter ${_hdvEsc(traderName)}</h3>
                    <p>Concernant: <strong>${order.type === 'sell' ? '🔴 Vente' : '🔵 Achat'} - ${_hdvEsc(itemName)}</strong></p>
                    <p class="order-details">Prix: <strong>${order.price} cols</strong> • Quantité: <strong>${order.quantity}</strong></p>
                    <button class="close-modal" data-hdv-action="close-overlay">❌</button>
                </div>
                
                <div class="message-compose-area">
                    <div class="compose-form">
                        <div class="form-group">
                            <label for="message-subject">📋 Sujet du message</label>
                            <input 
                                type="text" 
                                id="message-subject" 
                                value="${order.type === 'sell' ? '🔴 Intéressé par votre vente' : '🔵 Proposition pour votre achat'} - ${_hdvEscA(itemName)}"
                                maxlength="100"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="custom-message-content">✏️ Votre message personnalisé</label>
                            <textarea 
                                id="custom-message-content" 
                                placeholder="Écrivez votre message personnalisé ici...
                                
Exemples:
• Bonjour, je suis intéressé par votre ${_hdvEscA(itemName)}. Êtes-vous disponible pour un échange ?
• Votre prix me convient parfaitement. Quand pouvons-nous nous retrouver en jeu ?
• Je propose ${Math.floor(order.price * 0.9)} cols au lieu de ${order.price}. Qu'en pensez-vous ?"
                                rows="8"
                                maxlength="1000"
                            ></textarea>
                            <div class="char-counter">
                                <span id="char-count">0</span>/1000 caractères
                            </div>
                        </div>
                        
                        <div class="quick-suggestions">
                            <h4>💡 Suggestions rapides (cliquez pour ajouter) :</h4>
                            <button class="suggestion-btn" type="button" data-hdv-action="suggestion" data-suggestion-key="interest">
                                💬 Intérêt général
                            </button>
                            <button class="suggestion-btn" type="button" data-hdv-action="suggestion" data-suggestion-key="accept-price">
                                ✅ Accepter le prix
                            </button>
                            <button class="suggestion-btn" type="button" data-hdv-action="suggestion" data-suggestion-key="negotiate">
                                💸 Négocier le prix
                            </button>
                            <button class="suggestion-btn" type="button" data-hdv-action="suggestion" data-suggestion-key="ingame">
                                🎮 Contact en jeu
                            </button>
                        </div>
                        
                        <div class="form-actions">
                            <button class="btn btn-secondary" data-hdv-action="close-overlay">
                                ↩️ Annuler
                            </button>
                            <button class="btn btn-primary" data-hdv-action="send-custom-message">
                                📤 Envoyer le message
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Gestion du compteur de caractères
        const messageContent = document.getElementById('custom-message-content');
        const charCount = document.getElementById('char-count');
        
        messageContent.addEventListener('input', () => {
            const length = messageContent.value.length;
            charCount.textContent = length;
            charCount.parentElement.style.color = length > 900 ? '#ff6b6b' : length > 700 ? '#ffa500' : '#4CAF50';
        });

        // Focus sur le textarea
        messageContent.focus();
        
        // Fermer avec Escape
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    addSuggestion(text) {
        const messageContent = document.getElementById('custom-message-content');
        if (messageContent) {
            const currentText = messageContent.value;
            const newText = currentText ? currentText + '\n\n' + text : text;
            messageContent.value = newText;
            
            // Trigger le compteur de caractères
            messageContent.dispatchEvent(new Event('input'));
            
            // Focus et positionner le curseur à la fin
            messageContent.focus();
            messageContent.setSelectionRange(newText.length, newText.length);
        }
    }

    async sendCustomMessage(traderName, itemName) {
        const subjectInput = document.getElementById('message-subject');
        const contentInput = document.getElementById('custom-message-content');
        
        if (!subjectInput || !contentInput) {
            this.showNotification('❌ Erreur: Champs de message non trouvés', 'error');
            return;
        }
        
        const subject = subjectInput.value.trim();
        const content = contentInput.value.trim();
        
        if (!subject) {
            this.showNotification('❌ Veuillez entrer un sujet pour votre message', 'error');
            subjectInput.focus();
            return;
        }
        
        if (!content) {
            this.showNotification('❌ Veuillez écrire votre message', 'error');
            contentInput.focus();
            return;
        }
        
        if (content.length < 10) {
            this.showNotification('❌ Votre message doit faire au moins 10 caractères', 'error');
            contentInput.focus();
            return;
        }

        try {
            const currentUser = this.getCurrentUserInfo();
            
            // Créer l'objet message
            const message = {
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                from: currentUser.username,
                to: traderName,
                subject: subject,
                content: content,
                timestamp: new Date().toISOString(),
                read: false,
                relatedItem: itemName
            };
            
            // console.log('📤 Envoi message personnalisé:', message);
            
            // Essayer d'envoyer via Supabase d'abord
            let messageSent = false;
            if (window.mailboxSystem && window.mailboxSystem.sendMessage) {
                try {
                    const success = await window.mailboxSystem.sendMessage(message.to, message.subject, message.content);
                    if (success) {
                        messageSent = true;
                        // console.log('✅ Message envoyé via système Supabase');
                    }
                } catch (supabaseError) {
                    // console.warn('⚠️ Échec envoi Supabase, sauvegarde locale:', supabaseError);
                }
            }
            
            // Sauvegarder en local en fallback
            if (!messageSent) {
                const messages = JSON.parse(localStorage.getItem('hdv_messages') || '[]');
                messages.push(message);
                localStorage.setItem('hdv_messages', JSON.stringify(messages));
                // console.log('💾 Message sauvegardé localement');
            }
            
            // Fermer la modal
            document.querySelector('.contact-modal-overlay')?.remove();
            
            this.showNotification(`✅ Message envoyé à ${traderName} avec succès !`, 'success');
            
        } catch (error) {
            // console.error('❌ Erreur envoi message:', error);
            this.showNotification('❌ Erreur lors de l\'envoi du message: ' + error.message, 'error');
        }
    }

    // Méthode pour formater la date des ordres
    formatOrderDate(order) {
        if (!order.timestamp) return '';
        
        const orderDate = new Date(order.timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - orderDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Aujourd\'hui';
        } else if (diffDays === 2) {
            return 'Hier';
        } else if (diffDays <= 7) {
            return `Il y a ${diffDays - 1} jours`;
        } else {
            return orderDate.toLocaleDateString('fr-FR');
        }
    }

    // Méthode pour formater l'heure
    formatTime(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Méthode pour afficher les notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `hdv-notification ${type}`;
        notification.textContent = message;
        
        // Styles inline pour les notifications
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            z-index: 10001;
            font-family: 'Exo 2', sans-serif;
            font-size: 0.95rem;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Méthode pour formater la date des ordres
    formatOrderDate(order) {
        if (!order.timestamp) return '';
        
        const orderDate = new Date(order.timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - orderDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Aujourd\'hui';
        } else if (diffDays === 2) {
            return 'Hier';
        } else if (diffDays <= 7) {
            return `Il y a ${diffDays - 1} jours`;
        } else {
            return orderDate.toLocaleDateString('fr-FR');
        }
    }

    // Méthode pour formater l'heure
    formatTime(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialisation globale pour éviter les conflits
window.HDVSystem = HDVSystem;
