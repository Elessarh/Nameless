/* guild-chat.js - Gestion du chat de la guilde */

let chatOpen = false;
let replyingToMessage = null;
let lastMessageId = null;
let lastMessageTime = null;
let chatSubscription = null;
let selectedImage = null; // Image sélectionnée pour upload
let userRole = null; // Rôle de l'utilisateur (admin ou membre)
let guildMembers = []; // Liste des membres de la guilde pour les mentions
let chatInitialized = false;
// Cache messageId -> { author, content } pour répondre sans injecter le
// contenu brut dans le DOM/onclick (voir replyToMessage).
let messageCache = {};

// Nom public affiché dans le chat :
// 1. minecraft_username si présent ;
// 2. username seulement s'il est personnalisé (pas le fallback technique
//    Joueur_xxxxxx généré à l'inscription Microsoft) ;
// 3. « Joueur inconnu ». Jamais d'email ni d'UUID.
function getChatDisplayName(profile) {
    if (!profile) return 'Joueur inconnu';
    if (profile.minecraft_username) return profile.minecraft_username;

    const username = String(profile.username || '').trim();
    if (username && !/^Joueur_[A-Za-z0-9]{6}$/.test(username)) return username;

    return 'Joueur inconnu';
}

// Helper d'échappement centralisé (fallback si security-utils absent).
function chatEscapeHtml(text) {
    if (window.NamelessSecurity && window.NamelessSecurity.escapeHtml) {
        return window.NamelessSecurity.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

// Initialisation du chat
async function initGuildChat() {
    if (chatInitialized) return;
    // console.log('[CHAT] Initialisation du chat de la guilde...');
    
    // Attendre que l'utilisateur soit connecté
    await waitForChatAuth();
    
    // Vérifier si l'utilisateur est membre
    if (await isGuildMemberForChat()) {
        initializeChat();
    }
}

function destroyGuildChat() {
    chatInitialized = false;
    if (chatSubscription && typeof supabase !== 'undefined' && supabase && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(chatSubscription);
    }
    chatSubscription = null;
}

window.NamelessGuildChat = {
    init: initGuildChat,
    destroy: destroyGuildChat
};

document.addEventListener('DOMContentLoaded', initGuildChat);

// Attendre l'authentification
function waitForChatAuth() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkAuth = setInterval(() => {
            attempts++;
            
            if (typeof supabase !== 'undefined' && window.currentUser) {
                clearInterval(checkAuth);
                // console.log('[CHAT] Auth prête');
                resolve();
            } else if ((window.namelessAuthReady && !window.currentUser) || attempts >= maxAttempts) {
                clearInterval(checkAuth);
                // console.log('[CHAT] Timeout auth');
                resolve();
            }
        }, 100);
    });
}

// Vérifier si l'utilisateur est membre de la guilde
async function isGuildMemberForChat() {
    try {
        if (!window.currentUser) return false;
        
        const { data, error } = await supabase.rpc('current_user_role');
        if (error) throw error;
        
        const role = String(data || '').trim();
        userRole = role; // Stocker le rôle
        return role === 'membre' || role === 'admin';
    } catch (error) {
        // console.error('[CHAT] Erreur vérification membre:', error);
        return false;
    }
}

// Initialiser le chat
function initializeChat() {
    if (chatInitialized) return;
    // console.log('[CHAT] Initialisation des événements...');
    
    // Afficher le bouton flottant
    const chatBtn = document.getElementById('chat-toggle-btn');
    if (!chatBtn) return;
    chatInitialized = true;
    chatBtn.style.display = 'flex';
    
    // Event listeners pour les onglets
    document.getElementById('tab-general-btn').addEventListener('click', () => switchChatTab('general'));
    document.getElementById('tab-private-btn').addEventListener('click', () => switchChatTab('private'));
    
    // Event listeners du chat général
    document.getElementById('chat-toggle-btn').addEventListener('click', toggleChat);
    document.getElementById('chat-close-btn').addEventListener('click', closeChat);
    document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);
    
    // Event listeners pour les images
    document.getElementById('chat-image-btn').addEventListener('click', function() {
        document.getElementById('chat-image-input').click();
    });
    document.getElementById('chat-image-input').addEventListener('change', handleImageSelect);

    // Délégation d'événements pour les actions des messages (répondre,
    // supprimer, ouvrir image). Remplace les onclick inline: le conteneur
    // #chat-messages persiste entre les rendus, le listener reste valide.
    document.getElementById('chat-messages').addEventListener('click', handleChatMessagesClick);

    // Charger les messages initiaux
    loadMessages();
    
    // S'abonner aux nouveaux messages en temps réel
    subscribeToMessages();
    
    // Charger les membres de la guilde pour les mentions
    loadGuildMembers();
    
    // Initialiser l'autocomplete pour les mentions
    initializeMentions();
}

// Changer d'onglet
function switchChatTab(tabName) {
    // console.log('[CHAT] Changement d\'onglet:', tabName);
    
    // Retirer active de tous les boutons et contenus
    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.chat-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activer le bon onglet
    document.querySelector(`.chat-tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`chat-${tabName}-content`).classList.add('active');
    
    // Si on ouvre les DMs, charger les membres
    if (tabName === 'private' && typeof loadDmMembers === 'function') {
        loadDmMembers();
    }
}
window.switchChatTab = switchChatTab;

// Basculer l'ouverture/fermeture du chat
function toggleChat() {
    const chatContainer = document.getElementById('guild-chat');
    chatOpen = !chatOpen;
    
    if (chatOpen) {
        chatContainer.classList.add('open');
        loadMessages(); // Recharger les messages à l'ouverture
        scrollToBottom();
        
        // Marquer les messages comme lus
        markMessagesAsRead();
    } else {
        chatContainer.classList.remove('open');
    }
}

// Fermer le chat
function closeChat() {
    chatOpen = false;
    document.getElementById('guild-chat').classList.remove('open');
}

// Charger les messages
async function loadMessages() {
    try {
        // console.log('[CHAT] Chargement des messages...');
        
        // Uniquement les messages publics
        const { data: messages, error } = await supabase
            .from('guild_chat')
            .select('*')
            .eq('is_private', false)
            .order('created_at', { ascending: true })
            .limit(100);
        
        if (error) {
            // console.error('[CHAT] Erreur chargement messages:', error);
            displayError();
            return;
        }
        
        if (!messages || messages.length === 0) {
            displayNoMessages();
            return;
        }
        
        // Récupérer les profils des auteurs (pseudo Minecraft prioritaire)
        const userIds = [...new Set(messages.map(m => m.user_id))];
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, minecraft_username')
            .in('id', userIds);

        const profileMap = {};
        (profiles || []).forEach(p => {
            profileMap[p.id] = getChatDisplayName(p);
        });
        
        displayMessages(messages, profileMap);
        // console.log('[CHAT] Messages chargés:', messages.length);
        
        // Stocker le dernier message affiché (repère pour le badge)
        if (messages.length > 0) {
            lastMessageId = messages[messages.length - 1].id;
            lastMessageTime = messages[messages.length - 1].created_at;
        }
        
    } catch (error) {
        // console.error('[CHAT] Erreur:', error);
        displayError();
    }
}

// Afficher les messages — construction 100% DOM (aucune donnée utilisateur
// injectée via innerHTML). Les actions passent par des data-* + délégation.
function displayMessages(messages, profileMap) {
    const container = document.getElementById('chat-messages');
    const isAdmin = userRole && userRole.toLowerCase() === 'admin';

    container.innerHTML = '';       // vide le conteneur (aucune donnée)
    messageCache = {};              // reconstruit le cache à chaque rendu

    messages.forEach(msg => {
        const isOwnMessage = msg.user_id === window.currentUser.id;
        const author = profileMap[msg.user_id] || 'Inconnu';
        const time = formatChatTime(msg.created_at);
        const content = msg.content || '';

        // Mémoriser pour replyToMessage (pas de contenu brut dans le DOM/onclick)
        messageCache[msg.id] = { author: author, content: content };

        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message'
            + (isOwnMessage ? ' own-message' : '')
            + (msg.reply_to_message_id ? ' reply-message' : '')
            + (isAdmin ? ' admin-view' : '');
        messageEl.dataset.messageId = msg.id;

        // --- En-tête (auteur, heure, bouton supprimer admin) ---
        const header = document.createElement('div');
        header.className = 'message-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author';
        authorSpan.textContent = author;
        header.appendChild(authorSpan);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = time;
        header.appendChild(timeSpan);

        if (isAdmin) {
            const delHeaderBtn = document.createElement('button');
            delHeaderBtn.className = 'delete-msg-btn';
            delHeaderBtn.title = 'Supprimer';
            delHeaderBtn.textContent = '🗑️';
            delHeaderBtn.dataset.action = 'delete';
            delHeaderBtn.dataset.messageId = msg.id;
            header.appendChild(delHeaderBtn);
        }
        messageEl.appendChild(header);

        // --- Aperçu de réponse ---
        if (msg.reply_to_message_id) {
            const replyMsg = messages.find(m => m.id === msg.reply_to_message_id);
            if (replyMsg) {
                const replyAuthor = profileMap[replyMsg.user_id] || 'Inconnu';
                const replyContent = replyMsg.content || '';

                const replyWrap = document.createElement('div');
                replyWrap.className = 'message-reply-to';

                const ra = document.createElement('div');
                ra.className = 'reply-to-author';
                ra.textContent = '↩️ ' + replyAuthor;
                replyWrap.appendChild(ra);

                const rc = document.createElement('div');
                rc.className = 'reply-to-content';
                rc.textContent = replyContent.substring(0, 50) + (replyContent.length > 50 ? '...' : '');
                replyWrap.appendChild(rc);

                messageEl.appendChild(replyWrap);
            }
        }

        // --- Contenu du message (avec mentions rendues en <span> sûrs) ---
        if (content) {
            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            appendParsedMentions(contentEl, content);
            messageEl.appendChild(contentEl);
        }

        // --- Image (URL validée: https + whitelist, sinon ignorée) ---
        if (msg.image_url) {
            const safeUrl = window.NamelessSecurity
                ? window.NamelessSecurity.sanitizeImageUrl(msg.image_url)
                : '';
            if (safeUrl) {
                const img = document.createElement('img');
                img.src = safeUrl;
                img.alt = 'Image';
                img.className = 'message-image';
                img.dataset.action = 'open-image';
                img.dataset.url = safeUrl;
                messageEl.appendChild(img);
            }
            // URL rejetée -> aucune image, le reste du message s'affiche
        }

        // --- Actions (répondre / supprimer) ---
        const showReply = !isOwnMessage;
        if (showReply || isAdmin) {
            const actions = document.createElement('div');
            actions.className = 'message-actions' + (isAdmin ? ' has-admin-btn' : '');

            if (showReply) {
                const replyBtn = document.createElement('button');
                replyBtn.className = 'action-btn reply-btn';
                replyBtn.textContent = '↩️ Répondre';
                replyBtn.dataset.action = 'reply';
                replyBtn.dataset.messageId = msg.id;
                actions.appendChild(replyBtn);
            }

            if (isAdmin) {
                const delBtn = document.createElement('button');
                delBtn.className = 'action-btn delete-btn admin-delete-btn';
                delBtn.title = 'Supprimer ce message';
                delBtn.textContent = '🗑️';
                delBtn.dataset.action = 'delete';
                delBtn.dataset.messageId = msg.id;
                actions.appendChild(delBtn);
            }

            messageEl.appendChild(actions);
        }

        container.appendChild(messageEl);
    });

    scrollToBottom();
}

// Délégation des clics sur la liste des messages.
function handleChatMessagesClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'reply') {
        replyToMessage(actionEl.dataset.messageId);
    } else if (action === 'delete') {
        deleteMessage(actionEl.dataset.messageId);
    } else if (action === 'open-image') {
        const url = actionEl.dataset.url;
        if (url) window.open(url, '_blank', 'noopener');
    }
}

// Afficher "Aucun message"
function displayNoMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = `
        <div class="chat-no-messages">
            <div class="chat-no-messages-icon">💬</div>
            <p class="chat-no-messages-text">Aucun message pour le moment.<br>Soyez le premier à écrire !</p>
        </div>
    `;
}

// Afficher une erreur
function displayError() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = `
        <div class="chat-no-messages">
            <div class="chat-no-messages-icon">⚠️</div>
            <p class="chat-no-messages-text">Erreur de chargement des messages.</p>
        </div>
    `;
}

// Envoyer un message
async function sendMessage() {
    try {
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        
        if (!content && !selectedImage) return;
        
        const sendBtn = document.getElementById('chat-send-btn');
        sendBtn.disabled = true;
        
        let imageUrl = null;
        
        // Upload de l'image si sélectionnée
        if (selectedImage) {
            imageUrl = await uploadChatImage(selectedImage);
            if (!imageUrl) {
                alert('Erreur lors de l\'upload de l\'image.');
                sendBtn.disabled = false;
                return;
            }
        }
        
        const messageData = {
            user_id: window.currentUser.id,
            content: content || '',
            reply_to_message_id: replyingToMessage,
            image_url: imageUrl,
            is_private: false,
            recipient_id: null
        };
        
        const { error } = await supabase
            .from('guild_chat')
            .insert([messageData]);
        
        if (error) {
            // console.error('[CHAT] Erreur envoi message:', error);
            alert('Erreur lors de l\'envoi du message.');
            sendBtn.disabled = false;
            return;
        }
        
        // Réinitialiser
        input.value = '';
        sendBtn.disabled = false;
        cancelReply();
        clearImagePreview();
        
        // console.log('[CHAT] Message envoyé');
        
    } catch (error) {
        // console.error('[CHAT] Erreur:', error);
        document.getElementById('chat-send-btn').disabled = false;
    }
}

// Répondre à un message — on ne passe que l'ID; auteur/contenu sont
// lus depuis messageCache (jamais réinjectés depuis un attribut HTML).
window.replyToMessage = function(messageId) {
    const cached = messageCache[messageId];
    if (!cached) return;

    replyingToMessage = messageId;

    const content = cached.content || '';
    document.getElementById('reply-to-author').textContent = cached.author;
    document.getElementById('reply-to-preview').textContent = content.substring(0, 80) + (content.length > 80 ? '...' : '');
    document.getElementById('chat-replying-to').classList.add('active');
    
    // Focus sur l'input et s'assurer qu'il est activé
    const chatInput = document.getElementById('chat-input');
    chatInput.disabled = false;
    chatInput.readOnly = false;
    chatInput.focus();
    
    // Scroll vers l'input si nécessaire
    chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Annuler la réponse
function cancelReply() {
    replyingToMessage = null;
    document.getElementById('chat-replying-to').classList.remove('active');
    
    // S'assurer que l'input est actif et focusable
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.readOnly = false;
    }
}
window.cancelReply = cancelReply;

// S'abonner aux nouveaux messages en temps réel
function subscribeToMessages() {
    // console.log('[CHAT] Abonnement aux nouveaux messages...');
    
    chatSubscription = supabase
        .channel('guild-chat')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'guild_chat'
        }, (payload) => {
            // console.log('[CHAT] Nouveau message reçu:', payload.new);
            
            // Recharger les messages si le chat est ouvert
            if (chatOpen) {
                loadMessages();
            } else {
                // Afficher un badge de nouveau message
                updateChatBadge();
            }
        })
        .subscribe();
}

// Mettre à jour le badge de nouveaux messages
async function updateChatBadge() {
    try {
        // Les id sont des uuid : le repère de nouveauté est created_at.
        const { count } = await supabase
            .from('guild_chat')
            .select('*', { count: 'exact', head: true })
            .eq('is_private', false)
            .gt('created_at', lastMessageTime || new Date(0).toISOString());

        const badge = document.getElementById('chat-badge');
        const chatBtn = document.getElementById('chat-toggle-btn');
        
        if (count && count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
            chatBtn.classList.add('has-new-messages');
        }
    } catch (error) {
        // console.error('[CHAT] Erreur badge:', error);
    }
}

// Marquer les messages comme lus
function markMessagesAsRead() {
    const badge = document.getElementById('chat-badge');
    const chatBtn = document.getElementById('chat-toggle-btn');
    
    badge.style.display = 'none';
    chatBtn.classList.remove('has-new-messages');
}

// Scroller vers le bas
function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// Formater l'heure
function formatChatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes}min`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(window.NamelessI18n ? window.NamelessI18n.getLocale() : 'fr-FR', options);
}

// Échapper le HTML (délègue au helper centralisé, échappe aussi les quotes).
function escapeHtml(text) {
    return chatEscapeHtml(text);
}

// Gérer la sélection d'image
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('L\'image est trop volumineuse (max 5MB)');
        event.target.value = '';
        return;
    }
    
    // Vérifier le type
    if (!file.type.startsWith('image/')) {
        alert('Seules les images sont autorisées');
        event.target.value = '';
        return;
    }
    
    selectedImage = file;
    
    // Afficher l'aperçu
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('chat-image-preview');
        preview.innerHTML = '';

        // e.target.result = data URL du fichier local choisi par l'utilisateur
        // (sa propre image), affiché en aperçu. Construit en DOM, pas d'inline.
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Preview';
        preview.appendChild(img);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', clearImagePreview);
        preview.appendChild(removeBtn);

        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Effacer l'aperçu de l'image
function clearImagePreview() {
    selectedImage = null;
    document.getElementById('chat-image-input').value = '';
    const preview = document.getElementById('chat-image-preview');
    preview.innerHTML = '';
    preview.style.display = 'none';
}
window.clearImagePreview = clearImagePreview; // Rendre accessible globalement

// Upload de l'image
async function uploadChatImage(file) {
    try {
        const fileExt = String(file.name.split('.').pop() || '').toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp'].indexOf(fileExt) === -1) {
            alert('Formats acceptés : png, jpg, jpeg, webp.');
            return null;
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        // Chemin imposé par la policy storage : chat/<user_id>/<fichier>.
        const filePath = `chat/${window.currentUser.id}/${fileName}`;

        const { error } = await supabase.storage
            .from('iron-oath-storage')
            .upload(filePath, file);

        if (error) {
            console.warn('[Nameless chat] image_upload_failed', {
                code: error.statusCode || error.code || null,
                message: error.message || String(error)
            });
            return null;
        }

        // Bucket privé : URL signée longue durée. Fallback URL publique si le
        // bucket est resté public (ancienne configuration).
        const { data: signed } = await supabase.storage
            .from('iron-oath-storage')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 5);

        if (signed && signed.signedUrl) return signed.signedUrl;

        const { data: urlData } = supabase.storage
            .from('iron-oath-storage')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    } catch (error) {
        console.warn('[Nameless chat] image_upload_failed', {
            message: error && error.message ? error.message : String(error)
        });
        return null;
    }
}

// Charger les membres de la guilde (pour les mentions @pseudo)
async function loadGuildMembers() {
    try {
        const { data: members, error } = await supabase
            .from('user_profiles')
            .select('id, username, minecraft_username')
            .in('role', ['membre', 'admin'])
            .order('username');

        if (error) throw error;

        // Les mentions utilisent le nom public ; les profils sans nom
        // exploitable (fallback technique) sont exclus de l'autocomplete.
        guildMembers = (members || [])
            .map(member => ({ id: member.id, username: getChatDisplayName(member) }))
            .filter(member => member.username !== 'Joueur inconnu');
        // console.log('[CHAT] Membres chargés:', guildMembers.length);
    } catch (error) {
        // console.error('[CHAT] Erreur chargement membres:', error);
    }
}

// Initialiser l'autocomplete pour les mentions
function initializeMentions() {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages-container');
    
    // Créer le conteneur d'autocomplete s'il n'existe pas
    let autocompleteDiv = document.getElementById('mention-autocomplete');
    if (!autocompleteDiv) {
        autocompleteDiv = document.createElement('div');
        autocompleteDiv.id = 'mention-autocomplete';
        autocompleteDiv.className = 'mention-autocomplete';
        container.appendChild(autocompleteDiv);
    }

    // Sélection d'une mention par clic (remplace l'onclick inline).
    autocompleteDiv.addEventListener('click', function(e) {
        const item = e.target.closest('.mention-item');
        if (item && typeof item.dataset.username === 'string') {
            insertMention(item.dataset.username);
        }
    });
    
    input.addEventListener('input', function(e) {
        const text = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        // Chercher un @ avant le curseur
        const beforeCursor = text.substring(0, cursorPos);
        const match = beforeCursor.match(/@(\w*)$/);
        
        if (match) {
            const search = match[1].toLowerCase();
            const filtered = guildMembers.filter(m => 
                m.username.toLowerCase().startsWith(search)
            ).slice(0, 5);
            
            if (filtered.length > 0) {
                showMentionSuggestions(filtered, match.index);
            } else {
                hideMentionSuggestions();
            }
        } else {
            hideMentionSuggestions();
        }
    });
    
    // Gérer les touches fléchées et entrée pour l'autocomplete
    input.addEventListener('keydown', function(e) {
        const autocomplete = document.getElementById('mention-autocomplete');
        if (!autocomplete || autocomplete.style.display === 'none') return;
        
        const items = autocomplete.querySelectorAll('.mention-item');
        const selected = autocomplete.querySelector('.mention-item.selected');
        let selectedIndex = -1;
        
        if (selected) {
            selectedIndex = Array.from(items).indexOf(selected);
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(selectedIndex + 1, items.length - 1);
            items.forEach((item, i) => {
                item.classList.toggle('selected', i === nextIndex);
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = Math.max(selectedIndex - 1, 0);
            items.forEach((item, i) => {
                item.classList.toggle('selected', i === prevIndex);
            });
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (selected) {
                e.preventDefault();
                selected.click();
            }
        } else if (e.key === 'Escape') {
            hideMentionSuggestions();
        }
    });
}

// Afficher les suggestions de mention
function showMentionSuggestions(members, atPosition) {
    const autocomplete = document.getElementById('mention-autocomplete');

    // Construction DOM: le pseudo passe par textContent + data-username,
    // jamais dans du HTML ni un onclick inline.
    autocomplete.innerHTML = '';
    members.forEach((member, index) => {
        const item = document.createElement('div');
        item.className = 'mention-item' + (index === 0 ? ' selected' : '');
        item.dataset.username = member.username;
        item.textContent = '👤 ' + member.username;
        autocomplete.appendChild(item);
    });

    autocomplete.style.display = 'block';
}

// Masquer les suggestions
function hideMentionSuggestions() {
    const autocomplete = document.getElementById('mention-autocomplete');
    if (autocomplete) {
        autocomplete.style.display = 'none';
    }
}

// Insérer une mention
window.insertMention = function(username) {
    const input = document.getElementById('chat-input');
    const text = input.value;
    const cursorPos = input.selectionStart;
    
    // Trouver le @ avant le curseur
    const beforeCursor = text.substring(0, cursorPos);
    const match = beforeCursor.match(/@\w*$/);
    
    if (match) {
        const start = match.index;
        const newText = text.substring(0, start) + '@' + username + ' ' + text.substring(cursorPos);
        input.value = newText;
        input.focus();
        input.setSelectionRange(start + username.length + 2, start + username.length + 2);
    }
    
    hideMentionSuggestions();
};

// Ajoute le contenu d'un message dans `container` en transformant les
// mentions @pseudo en <span class="mention"> SÛRS: le texte passe par des
// text nodes (aucune interprétation HTML possible), les spans sont créés
// via createElement. Remplace l'ancien parseMentions basé sur innerHTML.
function appendParsedMentions(container, text) {
    const regex = /@(\w+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.className = 'mention';
        span.textContent = '@' + match[1];
        container.appendChild(span);
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
}

// Supprimer un message (admin uniquement)
window.deleteMessage = async function(messageId) {
    // Vérification souple du rôle admin
    const isAdmin = userRole && userRole.toLowerCase() === 'admin';
    
    console.log('[CHAT] Tentative suppression message:', messageId, 'userRole:', userRole, 'isAdmin:', isAdmin);
    
    if (!isAdmin) {
        alert('Vous n\'avez pas les droits pour supprimer ce message.');
        return;
    }
    
    if (!confirm('Supprimer ce message ?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('guild_chat')
            .delete()
            .eq('id', messageId);
        
        if (error) {
            console.error('[CHAT] Erreur suppression:', error);
            throw error;
        }
        
        console.log('[CHAT] Message supprimé avec succès:', messageId);
        
        // Recharger les messages
        loadMessages();
        
    } catch (error) {
        console.error('[CHAT] Erreur suppression message:', error);
        alert('Erreur lors de la suppression du message: ' + error.message);
    }
};

// console.log('✅ Module guild-chat.js chargé');
