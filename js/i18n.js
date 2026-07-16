/* ============================================================
   NAMELESS - Internationalisation FR / EN
   - Translations are local: no third-party API call.
   - The visitor's choice is persisted in localStorage.
   - Newly-rendered SPA and JavaScript content is translated too.
   ============================================================ */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'nameless-language';
    var DEFAULT_LANGUAGE = 'fr';
    var SUPPORTED_LANGUAGES = ['fr', 'en'];
    var originalText = new WeakMap();
    var originalAttributes = new WeakMap();
    var observer = null;
    var applying = false;
    var currentLanguage = DEFAULT_LANGUAGE;
    var translatableAttributes = ['aria-label', 'aria-description', 'placeholder', 'title', 'alt', 'content'];
    var ignoredTags = { SCRIPT: true, STYLE: true, NOSCRIPT: true, CODE: true, PRE: true, TEXTAREA: true };
    var dynamicCatalog = {
        'Reprendre': 'Resume',
        'Aucune créature trouvée': 'No creatures found',
        'Modifie ta recherche ou tes filtres.': 'Adjust your search or filters.',
        'Aucun butin connu.': 'No known loot.',
        'Aucun item trouvé': 'No items found',
        'Aucun résultat trouvé': 'No results found',
        'Aucune quête trouvée': 'No quests found',
        'Les quêtes de ce palier arrivent bientôt. Paliers disponibles : 1 et 2.': 'Quests for this floor are coming soon. Available floors: 1 and 2.',
        'Cliquez pour discuter': 'Click to chat',
        'Aucun message pour le moment.': 'No messages yet.',
        'Soyez le premier à écrire !': 'Be the first to write!',
        'Aucun message. Soyez le premier à écrire !': 'No messages. Be the first to write!',
        'Erreur de chargement des messages.': 'Unable to load messages.',
        'Aucun destinataire sélectionné': 'No recipient selected',
        'Supprimer ce message ?': 'Delete this message?',
        'Erreur de chargement du planning.': 'Unable to load the schedule.',
        'Erreur technique lors du chargement du planning.': 'A technical error occurred while loading the schedule.',
        'Aucun evenement planifie': 'No scheduled events',
        'Erreur de chargement des objectifs.': 'Unable to load objectives.',
        'Erreur technique lors du chargement des objectifs.': 'A technical error occurred while loading objectives.',
        'Aucun objectif defini pour cette semaine': 'No objectives set for this week',
        'Erreur de chargement des presences': 'Unable to load attendance.',
        'Aucune presence enregistree aujourd hui': 'No attendance recorded today',
        'Erreur de chargement des profils': 'Unable to load profiles.',
        'Erreur technique lors du chargement': 'A technical error occurred while loading.',
        'Erreur de chargement du mur d’activité.': 'Unable to load the activity feed.',
        'Erreur technique lors du chargement du mur d’activité.': 'A technical error occurred while loading the activity feed.',
        'Aucun utilisateur trouvé': 'No users found',
        'Modifier rôle': 'Edit role',
        'Aucun événement planifié': 'No scheduled events',
        'Aucun objectif défini': 'No objectives set',
        "Aucune présence enregistrée aujourd'hui": 'No attendance recorded today',
        'Sélectionner un membre': 'Select a member',
        'Aucun membre dans la guilde': 'No guild members',
        'Publication en cours...': 'Publishing...',
        'Modifier la Publication': 'Edit post',
        'Nouvelle Publication': 'New post',
        'Vous devez être connecté pour voir votre profil.': 'You must be signed in to view your profile.',
        'Association...': 'Linking...',
        'Associer ce pseudo': 'Link this username',
        'Minecraft détecté : profil public associé à ton compte.': 'Minecraft detected: public profile linked to your account.',
        'Impossible de charger votre profil. Veuillez reessayer.': 'Unable to load your profile. Please try again.',
        'Impossible de creer votre fiche joueur. Veuillez reessayer.': 'Unable to create your player profile. Please try again.',
        'Une erreur technique est survenue.': 'A technical error occurred.',
        'Date inconnue': 'Unknown date',
        'Le niveau doit être entre 1 et 100.': 'Level must be between 1 and 100.',
        'Impossible de sauvegarder vos modifications.': 'Unable to save your changes.',
        'Modifications sauvegardées avec succès !': 'Changes saved successfully!'
    };

    function getEnglishCatalog() {
        return (global.NamelessTranslations && global.NamelessTranslations.en) || {};
    }

    function normalize(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function withOriginalWhitespace(original, translated) {
        var leading = (original.match(/^\s*/) || [''])[0];
        var trailing = (original.match(/\s*$/) || [''])[0];
        return leading + translated + trailing;
    }

    function interpolate(value, variables) {
        if (!variables) return value;
        return value.replace(/\{(\w+)\}/g, function (_, key) {
            return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : '{' + key + '}';
        });
    }

    function translateDynamic(source) {
        var match;
        var rules = [
            [/^Page (\d+) \/ (\d+) \((\d+) utilisateurs?\)$/, 'Page {1} / {2} ({3} users)'],
            [/^Page (\d+) sur (\d+) \((\d+) quêtes?\)$/, 'Page {1} of {2} ({3} quests)'],
            [/^Affichage de (\d+)-(\d+) sur (\d+) créatures$/, 'Showing {1}-{2} of {3} creatures'],
            [/^Affichage de (\d+)-(\d+) sur (\d+) items$/, 'Showing {1}-{2} of {3} items'],
            [/^(\d+) résultat(?:s)?$/, '{1} results'],
            [/^(\d+) créature(?:s)?$/, '{1} creatures'],
            [/^(\d+) item(?:s)?$/, '{1} items'],
            [/^Niveau (\d+)$/, 'Level {1}'],
            [/^Palier (\d+)$/, 'Floor {1}'],
            [/^Palier (\d+) sélectionné$/, 'Floor {1} selected'],
            [/^Palier (\d+) en préparation$/, 'Floor {1} in preparation'],
            [/^Aucun résultat pour « (.+) » au palier (\d+)\.$/, 'No results for “{1}” on floor {2}.'],
            [/^Il y a (\d+) min$/, '{1} min ago'],
            [/^Il y a (\d+)h$/, '{1}h ago'],
            [/^Il y a (\d+)j$/, '{1}d ago'],
            [/^Il y a (\d+) jours$/, '{1} days ago'],
            [/^Il y a (\d+) semaines$/, '{1} weeks ago'],
            [/^Il y a (\d+) mois$/, '{1} months ago'],
            [/^Il y a (\d+) ans$/, '{1} years ago'],
            [/^(\d+) sur (\d+)$/, '{1} of {2}']
        ];

        for (var i = 0; i < rules.length; i += 1) {
            match = source.match(rules[i][0]);
            if (match) {
                return rules[i][1].replace(/\{(\d+)\}/g, function (_, index) {
                    return match[Number(index)] || '';
                });
            }
        }
        return null;
    }

    function translate(source, variables) {
        var clean = normalize(source);
        if (!clean) return source;
        if (currentLanguage === 'fr') return interpolate(clean, variables);

        var catalog = getEnglishCatalog();
        var translated = dynamicCatalog[clean] || catalog[clean] || translateDynamic(clean) || clean;
        return interpolate(translated, variables);
    }

    function shouldIgnore(element) {
        if (!element) return false;
        if (ignoredTags[element.tagName]) return true;
        return !!(element.closest && element.closest('[data-i18n-ignore]'));
    }

    function applyTextNode(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE || shouldIgnore(node.parentElement)) return;

        if (!originalText.has(node)) originalText.set(node, node.nodeValue);
        var source = originalText.get(node);
        var clean = normalize(source);
        if (!clean) return;

        if (currentLanguage === 'fr') {
            if (node.nodeValue !== source) node.nodeValue = source;
            return;
        }

        var translated = translate(clean);
        if (translated !== clean) {
            var nextValue = withOriginalWhitespace(source, translated);
            if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
        }
    }

    function rememberAttribute(element, attribute) {
        var values = originalAttributes.get(element);
        if (!values) {
            values = {};
            originalAttributes.set(element, values);
        }
        if (!Object.prototype.hasOwnProperty.call(values, attribute)) {
            values[attribute] = element.getAttribute(attribute);
        }
        return values[attribute];
    }

    function applyAttributes(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || shouldIgnore(element)) return;

        translatableAttributes.forEach(function (attribute) {
            if (!element.hasAttribute(attribute)) return;
            if (attribute === 'content') {
                var metaKey = (element.getAttribute('name') || element.getAttribute('property') || '').toLowerCase();
                if (!/^(description|keywords|og:title|og:description|twitter:title|twitter:description)$/.test(metaKey)) return;
            }
            var source = rememberAttribute(element, attribute);
            if (source == null) return;
            var nextValue = currentLanguage === 'fr' ? source : translate(source);
            if (element.getAttribute(attribute) !== nextValue) element.setAttribute(attribute, nextValue);
        });
    }

    function applyRoot(root) {
        if (!root) return;
        applying = true;
        try {
            if (root.nodeType === Node.TEXT_NODE) {
                applyTextNode(root);
                return;
            }

            if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
            if (root.nodeType === Node.ELEMENT_NODE) applyAttributes(root);

            var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
            var node;
            while ((node = walker.nextNode())) {
                if (node.nodeType === Node.TEXT_NODE) applyTextNode(node);
                else applyAttributes(node);
            }
        } finally {
            applying = false;
        }
    }

    function updateSwitcher() {
        document.querySelectorAll('.language-switcher').forEach(function (switcher) {
            switcher.setAttribute('aria-label', currentLanguage === 'fr' ? 'Choisir la langue' : 'Choose language');
        });
        document.querySelectorAll('[data-language-option]').forEach(function (button) {
            var active = button.dataset.languageOption === currentLanguage;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function createSwitcher() {
        if (document.querySelector('.language-switcher')) return;
        var navActions = document.querySelector('.nav-connexion');
        if (!navActions) return;

        var group = document.createElement('div');
        group.className = 'language-switcher';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', currentLanguage === 'fr' ? 'Choisir la langue' : 'Choose language');
        group.setAttribute('data-i18n-ignore', '');

        SUPPORTED_LANGUAGES.forEach(function (language) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'language-option';
            button.dataset.languageOption = language;
            button.textContent = language.toUpperCase();
            button.title = language === 'fr' ? 'Français' : 'English';
            button.addEventListener('click', function () { setLanguage(language); });
            group.appendChild(button);
        });

        navActions.insertBefore(group, navActions.firstChild);
        updateSwitcher();
    }

    function setLanguage(language, options) {
        options = options || {};
        if (SUPPORTED_LANGUAGES.indexOf(language) === -1) language = DEFAULT_LANGUAGE;
        currentLanguage = language;

        if (!options.skipPersist) {
            try { localStorage.setItem(STORAGE_KEY, language); } catch (error) { /* Storage may be disabled. */ }
        }

        document.documentElement.lang = language;
        applyRoot(document.documentElement);
        createSwitcher();
        updateSwitcher();

        document.dispatchEvent(new CustomEvent('nameless:languagechange', {
            detail: { language: language }
        }));
    }

    function preferredLanguage() {
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (error) { /* Storage may be disabled. */ }
        if (SUPPORTED_LANGUAGES.indexOf(saved) !== -1) return saved;
        return String(navigator.language || '').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
    }

    function observeChanges() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(function (mutations) {
            if (applying) return;
            mutations.forEach(function (mutation) {
                if (mutation.type === 'characterData') applyTextNode(mutation.target);
                mutation.addedNodes.forEach(function (node) { applyRoot(node); });
            });
            createSwitcher();
            updateSwitcher();
        });
        observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    }

    function boot() {
        currentLanguage = preferredLanguage();
        createSwitcher();
        setLanguage(currentLanguage, { skipPersist: true });
        observeChanges();
    }

    global.NamelessI18n = {
        getLanguage: function () { return currentLanguage; },
        getLocale: function () { return currentLanguage === 'en' ? 'en-GB' : 'fr-FR'; },
        setLanguage: setLanguage,
        translate: translate,
        apply: applyRoot,
        supportedLanguages: SUPPORTED_LANGUAGES.slice()
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})(window);
