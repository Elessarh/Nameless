// Mailbox.js - Système de messagerie avec Supabase pour Iron Oath
class MailboxSystem {
    constructor() {
        this.messages = [];
        this.receivedMessages = [];
        this.sentMessages = [];
        this.deletedMessageIds = new Set(); // Cache des messages supprimés
        this.currentUser = null;
        this.supabaseManager = null;
        this.initializeSupabase();
        this.initializeEventListeners();
        this.startAutoRefresh();
    }

    // Initialiser Supabase
    async initializeSupabase() {
        // Attendre que le gestionnaire Supabase soit disponible
        while (!window.mailboxSupabaseManager) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.supabaseManager = window.mailboxSupabaseManager;
        // console.log('✅ Mailbox Supabase Manager connecté');
        
        // Charger les messages initiaux
        await this.loadMessages();
    }

    // Démarrer l'auto-actualisation
    startAutoRefresh() {
        // console.log('📬 Démarrage auto-actualisation boîte mail (15s)');
        
        // Actualiser toutes les 15 secondes
        this.refreshInterval = setInterval(async () => {
            // console.log('📬 Auto-actualisation boîte mail...');
            const previousMessageCount = this.messages.length;
            
            // Sauvegarder les IDs des messages actuellement supprimés localement
            const currentMessageIds = new Set(this.messages.map(msg => msg.id));
            
            await this.loadMessages();
            
            // Après le rechargement, vérifier si de nouveaux messages sont apparus
            const newMessageCount = this.messages.length;
            if (newMessageCount !== previousMessageCount) {
                // console.log(`📊 Messages: ${previousMessageCount} → ${newMessageCount}`);
            }
            
            await this.updateUnreadCount();
            
            // Vérifier les nouveaux messages pour notifications HDV
            this.checkForNewItemMessages(previousMessageCount);
            
            // Nettoyer le cache périodiquement (toutes les 10 actualisation = ~2.5 min)
            if (Math.random() < 0.1) {
                this.cleanDeletedMessagesCache();
            }
        }, 15000);
        
        // Nettoyer l'intervalle si on quitte la page
        window.addEventListener('beforeunload', () => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
        });
    }
    
    // Vérifier les nouveaux messages liés aux items et afficher des notifications
    checkForNewItemMessages(previousCount) {
        if (this.messages.length > previousCount) {
            const newMessages = this.messages.slice(0, this.messages.length - previousCount);
            
            newMessages.forEach(message => {
                // Vérifier si c'est un message reçu (pas envoyé) et lié à un item
                if (message.recipient_id === this.currentUser?.id && 
                    (message.subject?.includes('🔴') || message.subject?.includes('🔵'))) {
                    this.showItemContactNotification(message);
                }
            });
        }
    }
    
    // Afficher une notification visuelle pour un contact d'item
    showItemContactNotification(message) {
        // Créer une notification flottante
        const notification = document.createElement('div');
        notification.className = 'item-contact-notification';
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-icon">💬</span>
                <span class="notification-title">Contact pour item!</span>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-content">
                <strong>De:</strong> ${this.escapeHtml(message.sender_username || 'Joueur')}<br>
                <strong>Sujet:</strong> ${this.escapeHtml(message.subject || 'Message HDV')}
            </div>
            <div class="notification-actions">
                <button class="notification-btn view-message">
                    📖 Voir message
                </button>
                <button class="notification-btn dismiss">
                    ✖️ Ignorer
                </button>
            </div>
        `;
        
        // Styles CSS inline pour la notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
            border: 2px solid #00a8ff;
        `;
        
        // Ajouter l'animation CSS
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .item-contact-notification {
                    font-family: 'Exo 2', sans-serif;
                }
                .notification-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    font-weight: 600;
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                }
                .notification-content {
                    font-size: 14px;
                    margin-bottom: 10px;
                    line-height: 1.4;
                }
                .notification-actions {
                    display: flex;
                    gap: 10px;
                }
                .notification-btn {
                    padding: 5px 10px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                }
                .notification-btn.view-message {
                    background: #2ed573;
                    color: white;
                }
                .notification-btn.dismiss {
                    background: #ff4757;
                    color: white;
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Ajouter la notification au DOM
        document.body.appendChild(notification);
        
        // Jouer le son de notification
        this.playNotificationSound();
        
        // Bouton fermer
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // Boutons d'action (remplacent les onclick inline; l'id reste dans une
        // closure JS, jamais réinjecté dans une string HTML).
        const viewBtn = notification.querySelector('.view-message');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                if (window.mailboxSystem && window.mailboxSystem.openMessage) {
                    window.mailboxSystem.openMessage(message.id);
                }
            });
        }
        const dismissBtn = notification.querySelector('.dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => notification.remove());
        }
        
        // Auto-suppression après 10 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }

    // Actualisation manuelle
    async refreshMessages() {
        // console.log('🔄 Actualisation manuelle de la boîte mail...');
        await this.loadMessages();
        await this.updateUnreadCount();
        
        // Mettre à jour l'affichage si la boîte mail est ouverte
        const modal = document.querySelector('.mailbox-modal');
        if (modal) {
            await this.refreshMailboxDisplay(modal);
        }
        
        // Feedback visuel
        this.showNotification('🔄 Boîte mail actualisée', 'info');
    }

    // Rafraîchir l'affichage de la boîte mail
    async refreshMailboxDisplay(modal) {
        if (!this.supabaseManager) return;

        const receivedPanel = modal.querySelector('#received .messages-list');
        const sentPanel = modal.querySelector('#sent .messages-list');
        
        if (receivedPanel) {
            const receivedMessages = await this.supabaseManager.loadReceivedMessages();
            receivedPanel.innerHTML = receivedMessages.length > 0 ? 
                receivedMessages.map(msg => this.renderMessage(msg, 'received')).join('') :
                '<div class="no-messages">📭 Aucun message reçu</div>';
        }
        
        if (sentPanel) {
            const sentMessages = await this.supabaseManager.loadSentMessages();
            sentPanel.innerHTML = sentMessages.length > 0 ?
                sentMessages.map(msg => this.renderMessage(msg, 'sent')).join('') :
                '<div class="no-messages">📭 Aucun message envoyé</div>';
        }
    }

    // Charger les messages depuis Supabase
    async loadMessages() {
        if (!this.supabaseManager) {
            // console.log('⏳ Attente Supabase Manager...');
            return;
        }

        try {
            // console.log('📥 Chargement messages depuis Supabase...');
            
            // Charger tous les messages (reçus et envoyés)
            const [receivedMessages, sentMessages] = await Promise.all([
                this.supabaseManager.loadReceivedMessages(),
                this.supabaseManager.loadSentMessages()
            ]);
            
            // Filtrer les messages supprimés localement
            const filteredReceived = receivedMessages.filter(msg => !this.deletedMessageIds.has(msg.id));
            const filteredSent = sentMessages.filter(msg => !this.deletedMessageIds.has(msg.id));
            
            // Mettre à jour TOUS les tableaux pour maintenir la cohérence
            this.receivedMessages = filteredReceived;
            this.sentMessages = filteredSent;
            
            // Combiner et trier par date
            this.messages = [...filteredReceived, ...filteredSent]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            const totalFromDb = receivedMessages.length + sentMessages.length;
            const totalFiltered = this.messages.length;
            
            if (this.deletedMessageIds.size > 0) {
                // console.log(`✅ ${totalFiltered} messages chargés depuis Supabase (${totalFromDb} total, ${this.deletedMessageIds.size} filtrés)`);
            } else {
                // console.log(`✅ ${totalFiltered} messages chargés depuis Supabase (${filteredReceived.length} reçus, ${filteredSent.length} envoyés)`);
            }
            
        } catch (error) {
            // console.error('❌ Erreur chargement messages:', error);
            this.messages = [];
            this.receivedMessages = [];
            this.sentMessages = [];
        }
    }

    // Obtenir l'utilisateur connecté via Supabase
    async getCurrentUser() {
        // Solution de contournement direct sans passer par getUserProfile
        try {
            if (!this.supabaseManager || !this.supabaseManager.supabase) {
                // console.error('❌ Supabase non disponible pour mailbox');
                return null;
            }

            // Récupérer directement l'utilisateur authentifié
            const { data: { user }, error } = await this.supabaseManager.supabase.auth.getUser();
            if (error || !user) {
                // console.error('❌ Erreur récupération utilisateur auth:', error);
                return null;
            }

            // Récupérer le profil directement depuis user_profiles
            const { data: profile, error: profileError } = await this.supabaseManager.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                // console.error('❌ Erreur profil user_profiles:', profileError);
                return null;
            }

            // console.log('✅ Profil mailbox récupéré:', profile);
            return {
                id: profile.id,
                username: profile.username,
                email: profile.email || user.email || ''
            };
        } catch (error) {
            // console.error('❌ Erreur getCurrentUser mailbox:', error);
            return null;
        }
    }

    // Sauvegarder les messages (non utilisé avec Supabase)
    saveMessages() {
        // Méthode conservée pour compatibilité mais non utilisée avec Supabase
        // console.log('💾 Méthode saveMessages() non utilisée avec Supabase');
    }

    // Sauvegarder utilisateur pour autocomplétion
    saveUserForAutocomplete(username) {
        if (!username) return;
        
        const savedUsers = JSON.parse(localStorage.getItem('knownUsers') || '[]');
        if (!savedUsers.includes(username)) {
            savedUsers.push(username);
            localStorage.setItem('knownUsers', JSON.stringify(savedUsers));
        }
    }

    // Envoyer un message via Supabase
    async sendMessage(to, subject, content, orderItem = null) {
        if (!this.supabaseManager) {
            this.showNotification('❌ Système de messagerie non disponible', 'error');
            return false;
        }

        try {
            const messageType = orderItem ? 'order' : 'user';
            const orderId = orderItem ? orderItem.orderId : null;
            
            await this.supabaseManager.sendMessage(to, subject, content, messageType, orderId);
            
            // Actualiser les messages après envoi
            await this.loadMessages();
            
            // Sauvegarder pour autocomplétion
            this.saveUserForAutocomplete(to);
            
            this.showNotification(`✅ Message envoyé à ${to}`, 'success');
            // this.showContactNotification(this.currentUser?.username || 'Vous', to, subject, orderItem); // Suppression des messages automatiques
            
            return true;
            
        } catch (error) {
            // console.error('❌ Erreur envoi message:', error);
            this.showNotification('❌ Erreur lors de l\'envoi du message', 'error');
            return false;
        }
    }

    // Envoyer un message de trading spécifique
    async sendTradeMessage(recipientUsername, itemName, orderType, price) {
        try {
            // console.log('📤 Envoi message de trading:', { recipientUsername, itemName, orderType, price });
            
            // S'assurer que l'utilisateur actuel est récupéré
            this.currentUser = await this.getCurrentUser();
            if (!this.currentUser) {
                throw new Error('Utilisateur non connecté');
            }
            
            const subject = `${orderType === 'sell' ? '🔴 Intérêt pour votre vente' : '🔵 Proposition pour votre achat'} - ${itemName}`;
            const content = `Bonjour ${recipientUsername},

Je suis intéressé(e) par votre ${orderType === 'sell' ? 'offre de vente' : 'demande d\'achat'} pour ${itemName} au prix de ${price} cols.

Pouvez-vous me confirmer si l'item est toujours disponible ?

Cordialement,
${this.currentUser.username || 'Un aventurier'}`;

            const success = await this.sendMessage(recipientUsername, subject, content);
            
            if (success) {
                // console.log('✅ Message de trading envoyé avec succès');
            }
            
            return success;
            
        } catch (error) {
            // console.error('❌ Erreur envoi message trading:', error);
            this.showNotification('❌ Erreur lors de l\'envoi du message de trading', 'error');
            return false;
        }
    }

    // Afficher notification de contact
    showContactNotification(from, to, subject, orderItem = null) {
        const notification = document.createElement('div');
        notification.className = 'contact-notification';
        
        let itemInfo = '';
        if (orderItem) {
            itemInfo = `<div class="order-info">
                <img src="${this.escapeAttribute(orderItem.image)}" alt="${this.escapeAttribute(orderItem.name)}" class="item-icon">
                <span>${this.escapeHtml(orderItem.name)}</span>
            </div>`;
        }
        
        notification.innerHTML = `
            <div class="notification-content">
                <h4>💬 Message envoyé</h4>
                <p><strong>De:</strong> ${this.escapeHtml(from)}</p>
                <p><strong>À:</strong> ${this.escapeHtml(to)}</p>
                <p><strong>Sujet:</strong> ${this.escapeHtml(subject)}</p>
                ${itemInfo}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Afficher notification push
    showPushNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `push-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Notification générale
    showNotification(message, type = 'info') {
        // console.log(`📢 ${message}`);
        
        // Essayer d'afficher dans l'interface si disponible
        const notificationArea = document.querySelector('.notification-area');
        if (notificationArea) {
            const notif = document.createElement('div');
            notif.className = `notification ${type}`;
            notif.textContent = message;
            notificationArea.appendChild(notif);
            
            setTimeout(() => {
                notif.remove();
            }, 3000);
        }
        
        // Jouer un son pour certains types
        if (type === 'success' || type === 'message') {
            this.playNotificationSound();
        }
    }

    // Jouer son de notification
    playNotificationSound() {
        try {
            // Son de notification doux et agréable - petite mélodie subtile
            const audio = new Audio('data:audio/wav;base64,UklGRlYMAABXQVZFZm10IBAAAAABAAEAgLcAAGGuAQACABAAZGF0YTIMAABNhJaRhJOOhZCJgY+BgoyEhIaFhomCiYOHh4WJhoeJh4iGiYaJh4SJgoiGhYeEhoeChIZ/hYJ+hYB9hH19g3p9gnh9gXh9gHd8fnh7fXZ7fHR7end7eHd6d3Z6dXZ5c3d4cnh3cXd2cHZ1bnV0bHVybXJxbHFwa3BvZ29uZW5tY21rYGprXWlpWmlnV2hnVGVlUWRjTmJhS2FfSF9dRV1bQltYP1lWPFdUOVVSOVNRP1JOPlBMPE5KOU1IR0tFREpCQUhAPUY9O0Q6NkI3MkAvLz4sLDsqKTgnJjYjJTQhIjMeIDEdHTEbGS8ZGC0WFS0UEysSDioQECkODisJDysIDiwICi0ICS4KCi4KCi4LDC4ODy4QES8SFS8UFy8VGS8VGy8VHC8UHi8THi8SHi8RHy8QHy8OHy8LHy8IIC8FIC8CIC8AIC8AHy8AHi8AHS8AHC8AGy8AGS8AGC8AFy8AFi8AFi8AFy8AGC8AGy8AHC8AHy8AJC8AKC8ALi8ANS8AOy8AQi8ASS8AUC8AVC8AXS8AZC8AZi8AaS8AaS8AZi8AYi8AXS8AVi8ATy8ARy8APy8ANi8ALy8AKC8AIS8AGi8AFi8AFS8AFy8AHC8AIS8AKC8ALS8ANS8APS8ARS8ATi8AVi8AXy8AaC8Abi8AdC8Aei8Aey8Aei8Ady8Aci8AaS8AXi8AUS8AQy8ANS8AKC8AGy8AEC8AGy8AKC8ANS8AQy8AUS8AXi8AaS8Aci8Ady8Aei8Aey8Aei8AdC8Abi8AaC8AXy8AVi8ATi8ARS8APS8ANS8ALS8AKC8AIS8AHC8AFy8AFS8AFi8AGi8AIS8AKC8ALy8ANi8APy8ARy8ATy8AVi8AXS8AYi8AZi8AaS8AaS8AZi8AZC8AXS8AVC8AUC8ASS8AQi8AOy8ANS8ALi8AKC8AJC8AHy8AHC8AGy8AGS8AFy8AFi8AFi8AFy8AGC8AGy8AHC8AHy8AIC8AIC8AIC8AIC8AHy8AHi8AHS8AHC8AGy8AGS8AFy8AFi8AFi8AFy8AGC8AGy8AHC8AHS8AHi8AHy8AIC8AIC8AIC8AIC8A=');
            audio.volume = 0.08; // Volume encore plus bas
            audio.play().catch(() => {}); // Ignorer les erreurs de lecture
        } catch (error) {
            // Ignorer les erreurs audio
        }
    }

    // Ouvrir un message spécifique (pour les notifications)
    openMessage(messageId) {
        // console.log('📖 Ouverture du message:', messageId);
        
        // Si on est dans le HDV, basculer vers l'onglet boîte mail
        if (window.hdvSystem && window.hdvSystem.switchTab) {
            window.hdvSystem.switchTab('mailbox');
        }
        
        // Attendre que l'interface soit chargée puis sélectionner le message
        setTimeout(() => {
            const message = this.messages.find(m => m.id === messageId);
            if (message) {
                this.selectMessage(message);
            }
        }, 100);
    }

    // Obtenir messages pour un utilisateur
    getMessagesForUser(username) {
        if (!this.currentUser) return [];
        
        return this.messages.filter(msg => 
            (msg.sender_username === this.currentUser.username && msg.recipient_username === username) ||
            (msg.sender_username === username && msg.recipient_username === this.currentUser.username)
        );
    }

    // Marquer un message comme lu
    async markAsRead(messageId) {
        if (!this.supabaseManager) return;
        
        try {
            await this.supabaseManager.markAsRead(messageId);
            await this.updateUnreadCount();
        } catch (error) {
            // console.error('❌ Erreur marquage lecture:', error);
        }
    }

    // Supprimer un message
    async deleteMessage(messageId) {
        if (!this.supabaseManager) return;
        
        try {
            await this.supabaseManager.deleteMessage(messageId);
            await this.loadMessages();
            this.showNotification('✅ Message supprimé', 'success');
        } catch (error) {
            // console.error('❌ Erreur suppression message:', error);
            this.showNotification('❌ Erreur lors de la suppression', 'error');
        }
    }

    // Ouvrir la boîte mail
    async openMailbox() {
        this.currentUser = await this.getCurrentUser();
        if (!this.currentUser) {
            this.showNotification('❌ Vous devez être connecté pour accéder à la boîte mail', 'error');
            return;
        }

        // Créer et afficher l'interface immédiatement avec les données en cache
        const modal = document.createElement('div');
        modal.className = 'mailbox-modal';
        modal.innerHTML = this.getMailboxHTML();
        
        document.body.appendChild(modal);
        
        // Ajouter les écouteurs d'événements
        this.setupMailboxEventListeners(modal);
        
        // Afficher les messages reçus par défaut avec les données existantes
        this.showTab('received', modal);
        
        // Mettre à jour les compteurs avec les données en cache (rapide)
        this.updateTabCountsFromCache(modal);
        
        // Charger les nouvelles données en arrière-plan (lent mais non bloquant)
        this.refreshDataInBackground(modal);
    }

    // Nouvelle méthode pour mettre à jour depuis le cache (instantané)
    updateTabCountsFromCache(modal) {
        if (!modal) return;
        
        // Utiliser les données déjà chargées
        const receivedCount = this.receivedMessages ? this.receivedMessages.length : 0;
        const sentCount = this.sentMessages ? this.sentMessages.length : 0;
        const unreadCount = this.receivedMessages ? 
            this.receivedMessages.filter(msg => !msg.read_at).length : 0;
        
        // Mettre à jour les compteurs instantanément
        const receivedTab = modal.querySelector('[data-tab="received"]');
        const sentTab = modal.querySelector('[data-tab="sent"]');
        
        if (receivedTab) {
            receivedTab.textContent = `📥 Reçus (${receivedCount})`;
        }
        if (sentTab) {
            sentTab.textContent = `📤 Envoyés (${sentCount})`;
        }
        
        // console.log(`📊 Compteurs mis à jour (cache): ${receivedCount} reçus, ${sentCount} envoyés, ${unreadCount} non lus`);
    }

    // Nouvelle méthode pour actualiser en arrière-plan
    async refreshDataInBackground(modal) {
        try {
            // Actualiser les données depuis Supabase en arrière-plan
            await this.loadMessages();
            
            // Mettre à jour l'affichage avec les nouvelles données
            await this.updateTabCounts(modal);
            
            // Actualiser l'onglet actuel si nécessaire
            const activeTab = modal.querySelector('.mailbox-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                this.showTab(tabName, modal);
            }
            
            // console.log('📬 Données actualisées en arrière-plan');
        } catch (error) {
            // console.error('❌ Erreur actualisation arrière-plan:', error);
        }
    }

    // Mettre à jour les compteurs des onglets
    async updateTabCounts(modal) {
        if (!this.supabaseManager || !modal) return;
        
        try {
            const [receivedMessages, sentMessages, unreadCount] = await Promise.all([
                this.supabaseManager.loadReceivedMessages(),
                this.supabaseManager.loadSentMessages(),
                this.supabaseManager.getUnreadCount()
            ]);
            
            // Mettre à jour les compteurs
            const receivedCountEl = modal.querySelector('#received-count');
            const sentCountEl = modal.querySelector('#sent-count');
            const headerUnreadEl = modal.querySelector('#header-unread');
            
            if (receivedCountEl) {
                receivedCountEl.textContent = receivedMessages.length;
                receivedCountEl.style.display = receivedMessages.length > 0 ? 'block' : 'none';
            }
            
            if (sentCountEl) {
                sentCountEl.textContent = sentMessages.length;
                sentCountEl.style.display = sentMessages.length > 0 ? 'block' : 'none';
            }
            
            if (headerUnreadEl) {
                if (unreadCount > 0) {
                    headerUnreadEl.textContent = `${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''}`;
                    headerUnreadEl.style.display = 'block';
                } else {
                    headerUnreadEl.style.display = 'none';
                }
            }
        } catch (error) {
            // console.error('❌ Erreur mise à jour compteurs:', error);
        }
    }

    // Configuration des écouteurs d'événements
    setupMailboxEventListeners(modal) {
        // Fermer la modal
        modal.querySelector('.close-mailbox').addEventListener('click', () => {
            this.closeMailbox(modal);
        });

        // Onglets de navigation
        modal.querySelectorAll('.mailbox-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.mailbox-tab').dataset.tab;
                this.showTab(tab, modal);
            });
        });

        // Bouton actualiser dans le header
        modal.querySelector('.refresh-mailbox').addEventListener('click', async () => {
            await this.refreshMessages();
            await this.updateTabCounts(modal);
            
            // Actualiser l'onglet actuel
            const activeTab = modal.querySelector('.mailbox-tab.active');
            if (activeTab) {
                const tabName = activeTab.dataset.tab;
                await this.showTab(tabName, modal);
            }
        });

        // Bouton marquer tout comme lu
        const markAllReadBtn = modal.querySelector('.mark-all-read');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async () => {
                await this.markAllAsRead();
                await this.refreshMailboxDisplay(modal);
            });
        }

        // Fermer en cliquant à l'extérieur
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeMailbox(modal);
            }
        });

        // Fermer avec la touche Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.parentNode) {
                this.closeMailbox(modal);
            }
        });
    }

    // Méthode centralisée pour fermer la boîte mail
    closeMailbox(modal) {
        // Animation de fermeture
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
            
            // S'assurer que l'interface HDV reste visible et fonctionnelle
            const hdvContainer = document.querySelector('.main-content');
            if (hdvContainer) {
                hdvContainer.style.display = 'block';
            }
            
            // Réactiver les onglets HDV si nécessaire
            const hdvTabs = document.querySelectorAll('.hdv-tab:not(.mailbox-tab)');
            hdvTabs.forEach(tab => {
                tab.style.pointerEvents = 'auto';
                tab.style.opacity = '1';
            });
            
            // Revenir à l'onglet actif précédent ou par défaut à la place du marché
            const activeTab = document.querySelector('.hdv-tab.active:not(.mailbox-tab)');
            if (!activeTab) {
                // Si aucun onglet n'est actif, activer la place du marché par défaut
                const marketTab = document.querySelector('.hdv-tab[data-tab="place-marche"]');
                if (marketTab && window.hdvSystem && window.hdvSystem.showTab) {
                    window.hdvSystem.showTab('place-marche');
                }
            }
            
            // console.log('📬 Boîte mail fermée - retour à l\'interface HDV');
        }, 300);
    }

    // Afficher un onglet spécifique
    // Afficher un onglet
    async showTab(tabName, modal) {
        // Activer l'onglet
        modal.querySelectorAll('.mailbox-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        modal.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Afficher le panneau correspondant
        modal.querySelectorAll('.mailbox-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = modal.querySelector(`#${tabName}`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        // Charger le contenu selon l'onglet
        if (tabName === 'received') {
            await this.loadReceivedMessages(modal);
        } else if (tabName === 'sent') {
            await this.loadSentMessages(modal);
        } else if (tabName === 'compose') {
            await this.showComposeFormInPanel(modal);
        }
    }

    // Charger les messages reçus
    async loadReceivedMessages(modal) {
        const messagesList = modal.querySelector('#received .messages-list');
        if (!messagesList) return;

        // Afficher le loading
        messagesList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Chargement des messages reçus...</p>
            </div>
        `;

        try {
            const messages = await this.supabaseManager.loadReceivedMessages();
            this.receivedMessages = messages; // Sauvegarder en mémoire
            
            if (messages.length > 0) {
                messagesList.innerHTML = messages.map(msg => this.renderMessage(msg, 'received')).join('');
                
                // Mettre à jour le compteur
                const receivedCount = modal.querySelector('#received-count');
                if (receivedCount) {
                    receivedCount.textContent = messages.length;
                }
            } else {
                // Debug: afficher plus d'informations
                const userInfo = await this.getCurrentUser();
                messagesList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h4>Aucun message reçu</h4>
                        <p>Votre boîte de réception est vide</p>
                        <div class="empty-info">
                            <small>Utilisateur connecté: ${this.escapeHtml(userInfo?.username || 'Non identifié')}</small><br>
                            <small>ID utilisateur: ${this.escapeHtml(userInfo?.id || 'N/A')}</small>
                        </div>
                        <div class="empty-actions">
                            <button class="btn btn-primary empty-compose-btn">
                                ✉️ Écrire un message
                            </button>
                        </div>
                    </div>
                `;
                const emptyComposeBtn = messagesList.querySelector('.empty-compose-btn');
                if (emptyComposeBtn) {
                    emptyComposeBtn.addEventListener('click', () => this.openComposeTab(modal));
                }
            }
        } catch (error) {
            // console.error('❌ Erreur chargement messages reçus:', error);
            messagesList.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h4>Erreur de chargement</h4>
                    <p>Impossible de charger les messages reçus</p>
                    <button class="btn btn-secondary retry-received-btn">Réessayer</button>
                </div>
            `;
            const retryReceivedBtn = messagesList.querySelector('.retry-received-btn');
            if (retryReceivedBtn) {
                retryReceivedBtn.addEventListener('click', () => this.loadReceivedMessages(modal));
            }
        }
    }

    // Charger les messages envoyés
    async loadSentMessages(modal) {
        const messagesList = modal.querySelector('#sent .messages-list');
        if (!messagesList) return;

        // Afficher le loading
        messagesList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Chargement des messages envoyés...</p>
            </div>
        `;

        try {
            const messages = await this.supabaseManager.loadSentMessages();
            this.sentMessages = messages; // Sauvegarder en mémoire
            
            if (messages.length > 0) {
                messagesList.innerHTML = messages.map(msg => this.renderMessage(msg, 'sent')).join('');
                
                // Mettre à jour le compteur
                const sentCount = modal.querySelector('#sent-count');
                if (sentCount) {
                    sentCount.textContent = messages.length;
                }
            } else {
                messagesList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📤</div>
                        <h4>Aucun message envoyé</h4>
                        <p>Vous n'avez envoyé aucun message</p>
                    </div>
                `;
            }
        } catch (error) {
            // console.error('❌ Erreur chargement messages envoyés:', error);
            messagesList.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h4>Erreur de chargement</h4>
                    <p>Impossible de charger les messages envoyés</p>
                    <button class="btn btn-secondary retry-sent-btn">Réessayer</button>
                </div>
            `;
            const retrySentBtn = messagesList.querySelector('.retry-sent-btn');
            if (retrySentBtn) {
                retrySentBtn.addEventListener('click', () => this.loadSentMessages(modal));
            }
        }
    }

    // Afficher le formulaire de composition dans le panneau dédié
    async showComposeFormInPanel(modal) {
        const composeContainer = modal.querySelector('#compose .compose-container');
        if (!composeContainer) return;

        // Récupérer la liste des utilisateurs depuis la base de données
        let allUsers = [];
        try {
            if (this.supabaseManager) {
                const { data, error } = await this.supabaseManager.supabase
                    .from('user_profiles')
                    .select('username')
                    .order('username');
                    
                if (!error && data) {
                    allUsers = data.map(user => user.username);
                }
            }
        } catch (error) {
            // console.log('⚠️ Impossible de charger la liste des utilisateurs:', error);
        }
        
        // Combiner utilisateurs connus et tous les utilisateurs
        const knownUsers = JSON.parse(localStorage.getItem('knownUsers') || '[]');
        
        // Ajouter automatiquement les expéditeurs des messages reçus et envoyés
        // Vérification de sécurité pour éviter l'erreur 'undefined reading map'
        const messages = this.messages || [];
        
        const messagesSenders = [
            ...messages.filter(msg => msg.sender_username).map(msg => msg.sender_username),
            ...messages.filter(msg => msg.recipient_username).map(msg => msg.recipient_username)
        ].filter(Boolean);
        
        // Combiner toutes les sources d'utilisateurs
        const availableUsers = [...new Set([...knownUsers, ...allUsers, ...messagesSenders])];
        
        // console.log('👥 Utilisateurs disponibles:', availableUsers);
        
        composeContainer.innerHTML = `
            <div class="compose-form-panel">
                <div class="form-section">
                    <div class="form-group">
                        <label>Destinataire <span class="required">*</span></label>
                        <div class="input-wrapper">
                            <input type="text" id="compose-to" placeholder="Saisissez le nom d'utilisateur..." autocomplete="off">
                            <div class="autocomplete-suggestions"></div>
                        </div>
                        <div class="user-validation" id="user-validation"></div>
                    </div>
                    
                    <div class="form-group">
                        <label>Sujet <span class="required">*</span></label>
                        <div class="input-wrapper">
                            <input type="text" id="compose-subject" placeholder="Sujet de votre message" maxlength="100">
                            <div class="char-count"><span id="subject-count">0</span>/100</div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Message <span class="required">*</span></label>
                        <div class="input-wrapper">
                            <textarea id="compose-content" rows="8" placeholder="Rédigez votre message..." maxlength="1000"></textarea>
                            <div class="char-count"><span id="content-count">0</span>/1000</div>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions-panel">
                    <button class="btn btn-primary" id="send-message-btn" disabled>
                        <span class="btn-icon">📤</span>
                        <span class="btn-text">Envoyer le message</span>
                    </button>
                    <button class="btn btn-secondary" id="clear-form-btn">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">Effacer</span>
                    </button>
                </div>
            </div>
        `;
        
        // Initialiser l'autocomplétion et la validation
        this.setupComposeFormEvents(availableUsers);
        
        // Ajouter l'événement pour effacer le formulaire
        const clearBtn = modal.querySelector('#clear-form-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.resetComposeForm();
            });
        }
    }

    // Ajouter fonction pour marquer tous les messages comme lus
    async markAllAsRead() {
        if (!this.supabaseManager) {
            this.showNotification('❌ Service non disponible', 'error');
            return;
        }

        try {
            const user = await this.supabaseManager.getCurrentUser();
            if (!user) return;

            // Marquer tous les messages non lus comme lus
            const { error } = await this.supabaseManager.supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('recipient_id', user.id)
                .is('read_at', null);

            if (error) {
                throw error;
            }

            await this.updateUnreadCount();
            this.showNotification('✅ Tous les messages marqués comme lus', 'success');
        } catch (error) {
            // console.error('❌ Erreur marquage global:', error);
            this.showNotification('❌ Erreur lors du marquage', 'error');
        }
    }

    // Rendu d'un message
    renderMessage(message, type) {
        const isUnread = !message.read_at && type === 'received';
        const date = new Date(message.created_at);
        const formattedDate = date.toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Calculer le temps écoulé
        const timeAgo = this.getTimeAgo(date);
        
        return `
            <div class="message-item ${isUnread ? 'unread' : ''}" data-message-id="${message.id}">
                <div class="message-header">
                    <div class="message-info">
                        <div class="message-user-line">
                            <span class="message-from">
                                ${type === 'received' ? '📥 De' : '📤 À'}: 
                                <strong>${this.escapeHtml(type === 'received' ? message.sender_username : message.recipient_username)}</strong>
                            </span>
                            ${isUnread ? '<span class="unread-badge">Nouveau</span>' : ''}
                            ${message.message_type === 'order' ? '<span class="trade-badge">📦 Commande</span>' : ''}
                        </div>
                        <div class="message-time-line">
                            <span class="message-date" title="${formattedDate}">${timeAgo}</span>
                        </div>
                    </div>
                    <div class="message-actions">
                        ${type === 'received' ? `<button class="btn-small reply-btn" data-message-id="${message.id}" data-sender="${this.escapeAttribute(message.sender_username)}" data-subject="${this.escapeAttribute(message.subject)}">↩️ Répondre</button>` : ''}
                        ${isUnread ? `<button class="btn-small mark-read-btn" data-message-id="${message.id}">✓ Lu</button>` : ''}
                        <button class="btn-small delete-btn" data-message-id="${message.id}">🗑️</button>
                    </div>
                </div>
                <div class="message-subject">
                    <h4>${this.escapeHtml(message.subject)}</h4>
                </div>
                <div class="message-content">
                    <p>${this.escapeHtml(message.content).replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `;
    }

    // Calculer le temps écoulé depuis un message
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays} jours`;
        
        return date.toLocaleDateString('fr-FR');
    }

    // Échapper le HTML pour éviter les injections (délègue au helper
    // centralisé, qui échappe aussi les guillemets et backticks).
    escapeHtml(text) {
        if (window.NamelessSecurity && window.NamelessSecurity.escapeHtml) {
            return window.NamelessSecurity.escapeHtml(text);
        }
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Échapper spécifiquement pour les attributs HTML
    escapeAttribute(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Décoder les attributs HTML échappés
    unescapeAttribute(text) {
        if (!text) return '';
        return text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }

    // Afficher le formulaire de composition (méthode héritée - redirige vers le panneau)
    async showComposeForm(modal) {
        // Rediriger vers l'onglet composition
        this.showTab('compose', modal);
    }

    // Configurer les événements du formulaire de composition
    setupComposeFormEvents(availableUsers) {
        const toInput = document.getElementById('compose-to');
        const subjectInput = document.getElementById('compose-subject');
        const contentTextarea = document.getElementById('compose-content');
        const sendBtn = document.getElementById('send-message-btn');
        const suggestions = document.querySelector('.autocomplete-suggestions');
        const userValidation = document.getElementById('user-validation');

        // Autocomplétion utilisateurs
        let currentSuggestionIndex = -1;
        
        toInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            
            if (value.length > 0) {
                const matches = availableUsers.filter(user => 
                    user.toLowerCase().includes(value)
                ).slice(0, 5);
                
                if (matches.length > 0) {
                    suggestions.innerHTML = matches.map((user, index) => 
                        `<div class="autocomplete-suggestion" data-index="${index}">${this.escapeHtml(user)}</div>`
                    ).join('');
                    suggestions.style.display = 'block';
                } else {
                    suggestions.style.display = 'none';
                }
            } else {
                suggestions.style.display = 'none';
            }
            
            // Validation utilisateur
            this.validateUser(e.target.value.trim(), availableUsers);
            this.validateForm();
        });

        // Navigation clavier dans les suggestions
        toInput.addEventListener('keydown', (e) => {
            const suggestionItems = suggestions.querySelectorAll('.autocomplete-suggestion');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, suggestionItems.length - 1);
                this.updateSuggestionSelection(suggestionItems, currentSuggestionIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
                this.updateSuggestionSelection(suggestionItems, currentSuggestionIndex);
            } else if (e.key === 'Enter' && currentSuggestionIndex >= 0) {
                e.preventDefault();
                const selectedSuggestion = suggestionItems[currentSuggestionIndex];
                if (selectedSuggestion) {
                    toInput.value = selectedSuggestion.textContent;
                    suggestions.style.display = 'none';
                    currentSuggestionIndex = -1;
                    this.validateUser(toInput.value, availableUsers);
                    this.validateForm();
                }
            } else if (e.key === 'Escape') {
                suggestions.style.display = 'none';
                currentSuggestionIndex = -1;
            }
        });

        // Clic sur une suggestion
        suggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('autocomplete-suggestion')) {
                toInput.value = e.target.textContent;
                suggestions.style.display = 'none';
                this.validateUser(toInput.value, availableUsers);
                this.validateForm();
            }
        });

        // Masquer suggestions en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!toInput.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
                currentSuggestionIndex = -1;
            }
        });

        // Compteurs de caractères
        subjectInput.addEventListener('input', () => {
            const count = subjectInput.value.length;
            document.getElementById('subject-count').textContent = count;
            document.getElementById('subject-count').style.color = count > 90 ? '#ff6666' : '#00a8ff';
            this.validateForm();
        });

        contentTextarea.addEventListener('input', () => {
            const count = contentTextarea.value.length;
            document.getElementById('content-count').textContent = count;
            document.getElementById('content-count').style.color = count > 950 ? '#ff6666' : '#00a8ff';
            this.validateForm();
        });

        // Bouton d'envoi
        sendBtn.addEventListener('click', () => this.sendComposeMessage());
    }

    // Mettre à jour la sélection des suggestions
    updateSuggestionSelection(suggestions, index) {
        suggestions.forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Valider l'utilisateur
    validateUser(username, availableUsers) {
        const userValidation = document.getElementById('user-validation');
        
        if (!username) {
            userValidation.innerHTML = '';
            return false;
        }
        
        // Mode ultra-tolérant : accepter tous les utilisateurs avec validation minimale
        if (username.trim().length >= 2) {
            userValidation.innerHTML = '<div class="validation-success">✅ Prêt à envoyer</div>';
            return true;
        } else {
            userValidation.innerHTML = '<div class="validation-error">❌ Nom d\'utilisateur trop court (min. 2 caractères)</div>';
            return false;
        }
    }

    // Valider le formulaire complet
    validateForm() {
        const toInput = document.getElementById('compose-to');
        const subjectInput = document.getElementById('compose-subject');
        const contentTextarea = document.getElementById('compose-content');
        const sendBtn = document.getElementById('send-message-btn');
        
        if (!toInput || !subjectInput || !contentTextarea || !sendBtn) {
            return; // Les éléments ne sont pas encore chargés
        }
        
        // Récupérer la liste des utilisateurs disponibles
        const knownUsers = JSON.parse(localStorage.getItem('knownUsers') || '[]');
        
        const isUserValid = this.validateUser(toInput.value.trim(), knownUsers);
        const isSubjectValid = subjectInput.value.trim().length > 0;
        const isContentValid = contentTextarea.value.trim().length > 0;
        
        const isFormValid = isUserValid && isSubjectValid && isContentValid;
        
        sendBtn.disabled = !isFormValid;
        sendBtn.style.opacity = isFormValid ? '1' : '0.5';
    }

    // Masquer le formulaire de composition (méthode héritée - pour compatibilité)
    hideComposeForm() {
        // Cette méthode est conservée pour compatibilité mais non utilisée avec la nouvelle interface
        // console.log('📝 hideComposeForm() appelée (compatibilité)');
    }

    // Envoyer le message composé
    async sendComposeMessage() {
        const to = document.getElementById('compose-to').value.trim();
        const subject = document.getElementById('compose-subject').value.trim();
        const content = document.getElementById('compose-content').value.trim();
        const sendBtn = document.getElementById('send-message-btn');
        
        // Validation finale
        if (!to || !subject || !content) {
            this.showNotification('❌ Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }
        
        // Vérifier la longueur
        if (subject.length > 100) {
            this.showNotification('❌ Le sujet est trop long (max 100 caractères)', 'error');
            return;
        }
        
        if (content.length > 1000) {
            this.showNotification('❌ Le message est trop long (max 1000 caractères)', 'error');
            return;
        }
        
        // Vérifier que l'utilisateur existe
        try {
            const { data: recipientData, error } = await this.supabaseManager.supabase
                .from('user_profiles')
                .select('username')
                .eq('username', to)
                .single();
                
            if (error || !recipientData) {
                this.showNotification(`❌ L'utilisateur "${to}" n'existe pas`, 'error');
                return;
            }
        } catch (error) {
            this.showNotification('❌ Erreur lors de la vérification du destinataire', 'error');
            return;
        }
        
        // Désactiver le bouton pendant l'envoi
        sendBtn.disabled = true;
        sendBtn.textContent = '⏳ Envoi en cours...';
        
        try {
            const success = await this.sendMessage(to, subject, content);
            if (success) {
                this.resetComposeForm();
                // Actualiser les compteurs et l'affichage
                const modal = document.querySelector('.mailbox-modal');
                if (modal) {
                    await this.updateTabCounts(modal);
                    // Basculer vers les messages envoyés pour voir le message
                    await this.showTab('sent', modal);
                }
                this.showNotification('✅ Message envoyé avec succès !', 'success');
            }
        } catch (error) {
            // console.error('❌ Erreur envoi message:', error);
            this.showNotification('❌ Erreur lors de l\'envoi du message', 'error');
        } finally {
            // Réactiver le bouton
            sendBtn.disabled = false;
            sendBtn.textContent = '📤 Envoyer';
        }
    }

    // Nettoyer le formulaire de composition
    resetComposeForm() {
        const toInput = document.getElementById('compose-to');
        const subjectInput = document.getElementById('compose-subject');
        const contentTextarea = document.getElementById('compose-content');
        
        if (toInput) toInput.value = '';
        if (subjectInput) subjectInput.value = '';
        if (contentTextarea) contentTextarea.value = '';
        
        // Réinitialiser les compteurs
        const subjectCount = document.getElementById('subject-count');
        const contentCount = document.getElementById('content-count');
        if (subjectCount) subjectCount.textContent = '0';
        if (contentCount) contentCount.textContent = '0';
        
        // Masquer les suggestions
        const suggestions = document.querySelector('.autocomplete-suggestions');
        if (suggestions) suggestions.style.display = 'none';
        
        // Nettoyer la validation
        const userValidation = document.getElementById('user-validation');
        if (userValidation) userValidation.innerHTML = '';
    }

    // Marquer un message comme lu
    async markAsRead(messageId) {
        if (!this.supabaseManager) {
            this.showNotification('❌ Service non disponible', 'error');
            return;
        }

        try {
            const success = await this.supabaseManager.markAsRead(messageId);
            if (success) {
                // Mettre à jour l'affichage
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    messageElement.classList.remove('unread');
                    const readBtn = messageElement.querySelector('.btn-read');
                    if (readBtn) {
                        readBtn.remove();
                    }
                }
                
                // Mettre à jour le compteur
                await this.updateUnreadCount();
                this.showNotification('✅ Message marqué comme lu', 'success');
            }
        } catch (error) {
            // console.error('❌ Erreur marquage lecture:', error);
            this.showNotification('❌ Erreur lors du marquage', 'error');
        }
    }

    // Supprimer un message
    async deleteMessage(messageId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
            return;
        }

        if (!this.supabaseManager) {
            this.showNotification('❌ Service non disponible', 'error');
            return;
        }

        try {
            // console.log('🗑️ Demande suppression message:', messageId);
            const success = await this.supabaseManager.deleteMessage(messageId);
            
            if (success) {
                // console.log('✅ Suppression Supabase réussie, mise à jour interface...');
                
                // Initialiser le cache s'il n'existe pas
                if (!this.deletedMessageIds) {
                    this.deletedMessageIds = new Set();
                    // console.log('🔧 Cache des messages supprimés initialisé');
                }
                
                // Ajouter au cache des messages supprimés pour éviter qu'il réapparaisse
                this.deletedMessageIds.add(messageId);
                // console.log('🚫 Message ajouté au cache des supprimés:', messageId);
                
                // Supprimer des données en mémoire (avec vérification d'existence)
                try {
                    if (this.receivedMessages && Array.isArray(this.receivedMessages)) {
                        this.receivedMessages = this.receivedMessages.filter(msg => msg.id !== messageId);
                        // console.log('✅ Supprimé des messages reçus');
                    } else {
                        // console.warn('⚠️ receivedMessages non initialisé ou pas un tableau');
                        this.receivedMessages = [];
                    }
                    
                    if (this.sentMessages && Array.isArray(this.sentMessages)) {
                        this.sentMessages = this.sentMessages.filter(msg => msg.id !== messageId);
                        // console.log('✅ Supprimé des messages envoyés');
                    } else {
                        // console.warn('⚠️ sentMessages non initialisé ou pas un tableau');
                        this.sentMessages = [];
                    }
                    
                    if (this.messages && Array.isArray(this.messages)) {
                        this.messages = this.messages.filter(msg => msg.id !== messageId);
                        // console.log('✅ Supprimé des messages généraux');
                    } else {
                        // console.warn('⚠️ messages non initialisé ou pas un tableau');
                        this.messages = [];
                    }
                    
                } catch (filterError) {
                    // console.error('❌ Erreur lors du filtrage des tableaux:', filterError);
                    // Réinitialiser les tableaux en cas d'erreur
                    this.receivedMessages = [];
                    this.sentMessages = [];
                    this.messages = [];
                }
                
                // Retirer l'élément de l'affichage
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    // Récupérer la liste parent avant animation
                    const messagesList = messageElement.closest('.messages-list');
                    
                    messageElement.style.animation = 'slideOutRight 0.3s ease-out';
                    setTimeout(() => {
                        messageElement.remove();
                        
                        // Vérifier s'il reste des messages (seulement si messagesList existe)
                        if (messagesList) {
                            const remainingMessages = messagesList.querySelectorAll('.message-item');
                            if (remainingMessages.length === 0) {
                                messagesList.innerHTML = '<div class="no-messages">📭 Aucun message</div>';
                            }
                        }
                    }, 300);
                }
                
                // Mettre à jour le compteur
                await this.updateUnreadCount();
                this.showNotification('✅ Message supprimé définitivement', 'success');
                
                // Ne pas recharger automatiquement - les données en mémoire sont déjà mises à jour
                // console.log('📝 Suppression terminée, données en mémoire mises à jour');
                
            } else {
                // console.error('❌ Échec suppression Supabase');
                this.showNotification('❌ Impossible de supprimer le message de la base de données', 'error');
            }
        } catch (error) {
            // console.error('❌ Erreur suppression message:', error);
            this.showNotification('❌ Erreur lors de la suppression', 'error');
        }
    }

    // Répondre à un message
    async replyToMessage(messageId, originalSender, originalSubject) {
        // console.log('📧 replyToMessage appelée avec:', { messageId, originalSender, originalSubject });
        
        // Ajouter l'expéditeur aux utilisateurs connus pour validation
        if (originalSender) {
            const knownUsers = JSON.parse(localStorage.getItem('knownUsers') || '[]');
            if (!knownUsers.includes(originalSender)) {
                knownUsers.push(originalSender);
                localStorage.setItem('knownUsers', JSON.stringify(knownUsers));
                // console.log('👥 Utilisateur ajouté aux connus:', originalSender);
            }
        }
        
        const modal = document.querySelector('.mailbox-modal');
        if (!modal) {
            // console.error('❌ Modal mailbox non trouvée');
            return;
        }

        // Basculer vers l'onglet composition
        await this.showTab('compose', modal);
        
        // Attendre que le formulaire soit chargé
        setTimeout(() => {
            // Pré-remplir les champs
            const toInput = document.getElementById('compose-to');
            const subjectInput = document.getElementById('compose-subject');
            
            if (toInput) {
                toInput.value = originalSender;
                // Déclencher la validation
                const event = new Event('input', { bubbles: true });
                toInput.dispatchEvent(event);
            }
            
            if (subjectInput) {
                const replySubject = originalSubject.startsWith('Re: ') ? 
                    originalSubject : `Re: ${originalSubject}`;
                subjectInput.value = replySubject;
                // Déclencher la validation
                const event = new Event('input', { bubbles: true });
                subjectInput.dispatchEvent(event);
            }
            
            // Donner le focus au champ message
            const contentTextarea = document.getElementById('compose-content');
            if (contentTextarea) {
                contentTextarea.focus();
            }
        }, 100);
    }

    // Mettre à jour le compteur de messages non lus
    async updateUnreadCount() {
        if (!this.supabaseManager) return;
        
        try {
            const count = await this.supabaseManager.getUnreadCount();
            
            // Mettre à jour l'affichage du compteur
            const counters = document.querySelectorAll('.unread-count, .mail-count');
            counters.forEach(counter => {
                counter.textContent = count > 0 ? count : '';
                counter.style.display = count > 0 ? 'inline' : 'none';
            });
            
            // Mettre à jour l'icône de la boîte mail
            const mailIcons = document.querySelectorAll('.mail-icon');
            mailIcons.forEach(icon => {
                if (count > 0) {
                    icon.classList.add('has-unread');
                } else {
                    icon.classList.remove('has-unread');
                }
            });
            
        } catch (error) {
            // console.error('❌ Erreur mise à jour compteur:', error);
        }
    }

    // Version synchrone pour compatibilité (retourne 0 par défaut)
    getUnreadCount() {
        // Cette méthode est gardée pour compatibilité avec l'ancien code
        // La vraie logique est dans updateUnreadCount() qui est async
        // console.log('📬 getUnreadCount() appelée (compatibilité)');
        return 0; // Retourne 0 par défaut, la vraie valeur sera mise à jour par updateUnreadCount()
    }

    // Obtenir le HTML de la boîte mail
    getMailboxHTML() {
        return `
            <div class="mailbox-content">
                <div class="mailbox-header">
                    <div class="mailbox-title">
                        <h2>📬 Boîte Mail</h2>
                        <div class="mailbox-user">
                            <span class="user-name">${this.escapeHtml(this.currentUser?.username || 'Utilisateur')}</span>
                            <span class="unread-indicator" id="header-unread"></span>
                        </div>
                    </div>
                    <div class="mailbox-header-actions">
                        <button class="refresh-mailbox" title="Actualiser la boîte mail">
                            🔄 <span class="btn-text">Actualiser</span>
                        </button>
                        <button class="close-mailbox" title="Fermer la boîte mail">✖</button>
                    </div>
                </div>

                <div class="mailbox-navigation">
                    <div class="mailbox-tabs">
                        <button class="mailbox-tab active" data-tab="received">
                            <span class="tab-icon">📥</span>
                            <span class="tab-label">Messages reçus</span>
                            <span class="tab-count" id="received-count"></span>
                        </button>
                        <button class="mailbox-tab" data-tab="sent">
                            <span class="tab-icon">📤</span>
                            <span class="tab-label">Messages envoyés</span>
                            <span class="tab-count" id="sent-count"></span>
                        </button>
                        <button class="mailbox-tab" data-tab="compose">
                            <span class="tab-icon">✉️</span>
                            <span class="tab-label">Nouveau message</span>
                        </button>
                    </div>
                </div>
                
                <div class="mailbox-panels">
                    <div id="received" class="mailbox-panel active">
                        <div class="panel-header">
                            <h3>📥 Messages reçus</h3>
                            <div class="panel-actions">
                                <button class="btn-small mark-all-read" title="Marquer tout comme lu">
                                    ✓ Tout marquer comme lu
                                </button>
                            </div>
                        </div>
                        <div class="messages-container">
                            <div class="messages-list">
                                <div class="loading-state">
                                    <div class="loading-spinner"></div>
                                    <p>Chargement des messages reçus...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="sent" class="mailbox-panel">
                        <div class="panel-header">
                            <h3>📤 Messages envoyés</h3>
                        </div>
                        <div class="messages-container">
                            <div class="messages-list">
                                <div class="loading-state">
                                    <div class="loading-spinner"></div>
                                    <p>Chargement des messages envoyés...</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="compose" class="mailbox-panel">
                        <div class="panel-header">
                            <h3>✉️ Nouveau message</h3>
                        </div>
                        <div class="compose-container">
                            <!-- Le formulaire sera inséré ici -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Initialiser les écouteurs d'événements
    initializeEventListeners() {
        // Écouter les clics sur l'icône de boîte mail
        document.addEventListener('click', (e) => {
            if (e.target.matches('.mail-icon, .mailbox-btn')) {
                e.preventDefault();
                this.openMailbox();
            }
            
            // Gestionnaire pour boutons de réponse
            if (e.target.matches('.reply-btn')) {
                e.preventDefault();
                // console.log('🔄 Clic sur bouton répondre détecté');
                const messageId = e.target.getAttribute('data-message-id');
                const sender = this.unescapeAttribute(e.target.getAttribute('data-sender'));
                const subject = this.unescapeAttribute(e.target.getAttribute('data-subject'));
                // console.log('📧 Données récupérées:', { messageId, sender, subject });
                this.replyToMessage(messageId, sender, subject);
            }
            
            // Gestionnaire pour boutons marquer comme lu
            if (e.target.matches('.mark-read-btn')) {
                e.preventDefault();
                // console.log('✅ Clic sur bouton marquer comme lu');
                const messageId = e.target.getAttribute('data-message-id');
                this.markAsRead(messageId);
            }
            
            // Gestionnaire pour boutons de suppression
            if (e.target.matches('.delete-btn')) {
                e.preventDefault();
                const messageId = e.target.getAttribute('data-message-id');
                this.deleteMessage(messageId);
            }
        });
        
        // Écouter les touches de raccourci
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.openMailbox();
            }
        });
    }

    // Test complet du système de messagerie
    async testMailboxSystem() {
        // console.log('🧪 === TEST SYSTÈME MESSAGERIE ===');
        
        try {
            // Test de la connectivité Supabase
            if (!this.supabaseManager) {
                throw new Error('Supabase Manager non disponible');
            }
            
            const connectivityOk = await this.supabaseManager.testConnectivity();
            if (!connectivityOk) {
                throw new Error('Test de connectivité échoué');
            }

            // Test de récupération de l'utilisateur actuel
            this.currentUser = await this.getCurrentUser();
            if (!this.currentUser) {
                throw new Error('Impossible de récupérer l\'utilisateur actuel');
            }
            // console.log('✅ Utilisateur actuel:', this.currentUser.username);

            // Test de chargement des messages
            await this.loadMessages();
            // console.log(`✅ Messages chargés: ${this.messages.length} total`);

            // Test de comptage des non lus
            await this.updateUnreadCount();
            // console.log('✅ Compteur de messages non lus mis à jour');

            // console.log('🎉 === TOUS LES TESTS RÉUSSIS ===');
            this.showNotification('🎉 Système de messagerie opérationnel !', 'success');
            return true;

        } catch (error) {
            // console.error('❌ === ÉCHEC DU TEST ===', error);
            this.showNotification(`❌ Erreur système: ${error.message}`, 'error');
            return false;
        }
    }

    // Fonction de diagnostic rapide
    async diagnoseMailboxIssues() {
        // console.log('🔍 === DIAGNOSTIC MESSAGERIE ===');
        
        const issues = [];
        
        // Vérifier Supabase
        if (!supabase && !window._dbRef) {
            issues.push('❌ supabase non disponible');
        } else {
            // console.log('✅ supabase disponible');
        }
        
        // Vérifier MailboxSupabaseManager
        if (!window.mailboxSupabaseManager) {
            issues.push('❌ window.mailboxSupabaseManager non disponible');
        } else {
            // console.log('✅ window.mailboxSupabaseManager disponible');
        }
        
        // Vérifier l'authentification
        try {
            const _sb = supabase || window._dbRef;
            const { data: { user } } = await _sb.auth.getUser();
            if (!user) {
                issues.push('❌ Utilisateur non connecté');
            } else {
                // console.log('✅ Utilisateur connecté:', user.email);
            }
        } catch (error) {
            issues.push(`❌ Erreur authentification: ${error.message}`);
        }
        
        if (issues.length === 0) {
            // console.log('✅ === DIAGNOSTIC RÉUSSI - AUCUN PROBLÈME ===');
            return true;
        } else {
            // console.log('❌ === PROBLÈMES DÉTECTÉS ===');
            issues.forEach(issue => console.log(issue));
            return false;
        }
    }

    // Ouvrir l'onglet de composition depuis l'état vide
    openComposeTab(modal) {
        if (modal) {
            this.showTab('compose', modal);
        }
    }

    // Créer des messages de test pour le debug
    async createTestMessages() {
        if (!this.supabaseManager) {
            this.showNotification('❌ Système Supabase non disponible', 'error');
            return;
        }

        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) {
                this.showNotification('❌ Vous devez être connecté pour créer des messages de test', 'error');
                return;
            }

            // Créer quelques messages de test
            const testMessages = [
                {
                    sender_id: 'test_user_1',
                    sender_username: 'TestTrader1',
                    recipient_id: currentUser.id,
                    recipient_username: currentUser.username,
                    subject: '🔴 Intéressé par votre vente - Épée de feu',
                    content: 'Bonjour ! Je suis très intéressé par votre épée de feu. Votre prix me convient parfaitement. Pouvons-nous nous retrouver en jeu pour l\'échange ?',
                    read: false
                },
                {
                    sender_id: 'test_user_2',
                    sender_username: 'MarchandNinja',
                    recipient_id: currentUser.id,
                    recipient_username: currentUser.username,
                    subject: '🔵 Proposition pour votre achat - Cristal magique',
                    content: 'Salut ! J\'ai vu que tu cherches des cristaux magiques. J\'en ai plusieurs disponibles. Nous pourrions négocier le prix si tu en prends plusieurs. Contacte-moi en jeu !',
                    read: false
                },
                {
                    sender_id: 'test_user_3',
                    sender_username: 'GuildeLeader',
                    recipient_id: currentUser.id,
                    recipient_username: currentUser.username,
                    subject: '🎯 Invitation guilde Iron Oath',
                    content: 'Salut ! Nous avons remarqué tes compétences et aimerions t\'inviter à rejoindre notre guilde Iron Oath. Nous sommes une guilde active avec de nombreux avantages. Que dis-tu ?',
                    read: false
                }
            ];

            let successCount = 0;
            for (const testMsg of testMessages) {
                try {
                    const success = await this.supabaseManager.sendMessage(
                        testMsg.recipient_id,
                        testMsg.subject,
                        testMsg.content,
                        testMsg.sender_id,
                        testMsg.sender_username
                    );
                    if (success) successCount++;
                } catch (error) {
                    // console.warn('❌ Erreur création message test:', error);
                }
            }

            if (successCount > 0) {
                this.showNotification(`✅ ${successCount} message(s) de test créé(s) !`, 'success');
                
                // Actualiser les messages
                await this.loadMessages();
                
                // Recharger l'onglet reçu si la modal est ouverte
                const modal = document.querySelector('.mailbox-modal');
                if (modal) {
                    await this.loadReceivedMessages(modal);
                }
            } else {
                this.showNotification('❌ Échec création des messages de test', 'error');
            }

        } catch (error) {
            // console.error('❌ Erreur création messages de test:', error);
            this.showNotification('❌ Erreur lors de la création des messages de test', 'error');
        }
    }

    // Nettoyer le cache des messages supprimés (appelé périodiquement)
    cleanDeletedMessagesCache() {
        // Garder seulement les 100 derniers IDs supprimés pour éviter une accumulation excessive
        if (this.deletedMessageIds.size > 100) {
            const idsArray = Array.from(this.deletedMessageIds);
            const recentIds = idsArray.slice(-50); // Garder les 50 plus récents
            this.deletedMessageIds = new Set(recentIds);
            // console.log('🧹 Cache des messages supprimés nettoyé, gardé:', recentIds.length);
        }
    }
}

// Initialiser le système de messagerie
document.addEventListener('DOMContentLoaded', () => {
    window.mailboxSystem = new MailboxSystem();
});

// Fonctions globales pour les tests (accessibles depuis la console)
window.testMailbox = async () => {
    if (window.mailboxSystem) {
        return await window.mailboxSystem.testMailboxSystem();
    } else {
        // console.error('❌ Mailbox System non initialisé');
        return false;
    }
};

window.testDeleteMessage = async (messageId) => {
    if (window.mailboxSupabaseManager) {
        // console.log('🧪 Test suppression message:', messageId);
        await window.mailboxSupabaseManager.testDeletePermissions(messageId);
        const result = await window.mailboxSupabaseManager.deleteMessage(messageId);
        // console.log('🧪 Résultat suppression:', result);
        return result;
    } else {
        // console.error('❌ Mailbox Supabase Manager non initialisé');
        return false;
    }
};

window.diagnoseMailbox = async () => {
    if (window.mailboxSystem) {
        return await window.mailboxSystem.diagnoseMailboxIssues();
    } else {
        // console.error('❌ Mailbox System non initialisé');
        return false;
    }
};

// Fonction pour envoyer un message de test
window.sendTestMessage = async (toUsername, subject = 'Message de test', content = 'Ceci est un message de test pour vérifier le système de messagerie.') => {
    if (window.mailboxSystem) {
        return await window.mailboxSystem.sendMessage(toUsername, subject, content);
    } else {
        // console.error('❌ Mailbox System non initialisé');
        return false;
    }
};

// Fonction pour voir l'état du cache de suppression
window.checkDeletedCache = () => {
    if (window.mailboxSystem) {
        // console.log('🗑️ Messages supprimés en cache:', Array.from(window.mailboxSystem.deletedMessageIds));
        // console.log('📊 Nombre total en cache:', window.mailboxSystem.deletedMessageIds.size);
        return Array.from(window.mailboxSystem.deletedMessageIds);
    } else {
        // console.error('❌ Mailbox System non initialisé');
        return [];
    }
};

// console.log('📬 Mailbox System chargé. Utilisez testMailbox(), diagnoseMailbox() ou sendTestMessage() pour tester.');
