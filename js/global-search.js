/* Public search, loaded on demand. Favorites contain public entity IDs only. */
(function (global) {
    'use strict';
    var script = document.currentScript;
    var indexUrl = new URL('../assets/search-index.json', script ? script.src : new URL('/js/global-search.js', location.href)).href;
    var indexPromise = null, entries = [], results = [], dialog, input, list, status, opener, favoriteFilter, favoriteLabel, favoriteCount, indexMeta, clearQuery;
    var favoritesOnly = false, loading = false;
    var key = 'nameless-public-favorites-v1';
    var favorites = [];
    var groups = {boss: ['Boss', 'Bosses'], creature: ['Bestiaire', 'Creatures'], item: ['Objets', 'Items'], quest: ['Quêtes', 'Quests'], location: ['Lieux', 'Locations'], npc: ['PNJ', 'NPCs'], wiki: ['Wiki & guides', 'Wiki & guides'], action: ['Accès rapides', 'Quick navigation']};
    try {
        var stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) favorites = stored.filter(function (id) {return typeof id === 'string' && id.length < 120;}).slice(0, 100);
    } catch (_) {}
    function english() { return global.NamelessI18n && global.NamelessI18n.getLanguage() === 'en'; }
    function label(fr, en) { return english() ? en : fr; }
    function icon(name, filled) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false'); svg.setAttribute('fill', filled ? 'currentColor' : 'none');
        svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
        svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var paths = {
            star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
            close: 'm6 6 12 12M18 6 6 18', search: 'm16.5 16.5 4 4',
            book: 'M12 5v15M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z',
            map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15',
            user: 'M5 21v-2a7 7 0 0 1 14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
            arrow: 'M5 12h14m-6-6 6 6-6 6',
            quest: 'M6 3h12v18H6Zm4 5h4m-4 4h4m-4 4h2'
        };
        path.setAttribute('d', paths[name] || paths.book);
        if (name === 'search') {
            var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '10.5'); circle.setAttribute('cy', '10.5'); circle.setAttribute('r', '7'); svg.appendChild(circle);
        }
        svg.appendChild(path); return svg;
    }
    function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
    function entityKey(entry) { return entry.kind + ':' + entry.id; }
    function getIndex() {
        if (!indexPromise) {
            indexPromise = fetch(indexUrl, {credentials: 'omit'}).then(function (response) {
                if (!response.ok) throw new Error('Index unavailable');
                return response.json();
            }).then(function (data) {
                if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid index');
                entries = data.entries.filter(function (entry) {
                    return entry && groups[entry.kind] && typeof entry.id === 'string' && typeof entry.title === 'string'
                        && typeof entry.url === 'string' && (/^\/(bestiaire|items|quetes|carte|wiki)(?:[?#]|$)/.test(entry.url) || /^\/boss\/[a-z0-9-]+$/.test(entry.url));
                });
                return entries;
            }).catch(function (error) {indexPromise = null; throw error;});
        }
        return indexPromise;
    }
    function actions() {
        return [
            {kind:'action', id:'wiki', title:label('Explorer le wiki','Explore the wiki'), url:'/wiki'},
            {kind:'action', id:'map', title:label("Ouvrir la carte d’Aincrad",'Open the Aincrad map'), url:'/carte'},
            {kind:'action', id:'profile', title:label('Mon profil','My profile'), url:'/profil'},
            {kind:'action', id:'guild', title:label('Planning et espace guilde','Schedule and guild area'), url:'/espace-guilde'},
            {kind:'action', id:'discord', title:label('Rejoindre Discord','Join Discord'), url:'https://discord.gg/BwxjRmh6qK'}
        ];
    }
    function match(query, source) {
        var words = normalize(query).split(/\s+/).filter(Boolean);
        return source.map(function (entry) {
            var title = normalize(entry.title + ' ' + (entry.titleEn || ''));
            var text = title + ' ' + normalize(entry.summary + ' ' + (entry.summaryEn || '') + ' ' + (entry.keywords || ''));
            return {entry:entry, score: words.every(function (word) {return text.includes(word);})
                ? (title.startsWith(normalize(query)) ? 0 : title.includes(normalize(query)) ? 1 : 2) : -1};
        }).filter(function (item) {return item.score >= 0;}).sort(function (a,b) {return a.score-b.score || a.entry.title.localeCompare(b.entry.title, 'fr');})
            .slice(0, 40).map(function (item) {return item.entry;});
    }
    function saveFavorite(entry, button) {
        var id = entityKey(entry), index = favorites.indexOf(id);
        if (index >= 0) favorites.splice(index, 1);
        else if (favorites.length < 100) favorites.push(id);
        else {status.textContent = label('Limite de 100 favoris atteinte.','The limit of 100 favorites has been reached.'); return;}
        try {localStorage.setItem(key, JSON.stringify(favorites));}
        catch (_) {status.textContent = label('Favoris conservés pour cette visite : stockage indisponible.','Favorites kept for this visit: storage unavailable.');}
        updateStar(entry, button);
        updateMeta();
        if (favoritesOnly) render();
    }
    function updateStar(entry, button) {
        var saved = favorites.includes(entityKey(entry));
        button.replaceChildren(icon('star', saved));
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', label(saved ? 'Retirer des favoris : ' : 'Ajouter aux favoris : ', saved ? 'Remove favorite: ' : 'Save favorite: ') + (english() ? entry.titleEn || entry.title : entry.title));
    }
    function updateMeta() {
        var savedCount = entries.filter(function (entry) {return favorites.includes(entityKey(entry));}).length;
        favoriteLabel.textContent = label('Mes favoris','My favorites');
        favoriteCount.textContent = String(savedCount);
        favoriteFilter.setAttribute('aria-label', label('Mes favoris : ', 'My favorites: ') + savedCount);
        indexMeta.textContent = entries.length ? entries.length + label(' fiches indexées',' indexed entries') : label('Index du codex','Codex index');
        clearQuery.hidden = !input.value;
    }
    function render() {
        var focusedControl = list.contains(document.activeElement) && document.activeElement;
        var focusedLink = focusedControl && focusedControl.closest('.nm-search-result a');
        var focusedUrl = focusedLink && focusedLink.getAttribute('href');
        var focusedStarKey = focusedControl && focusedControl.matches('.nm-search-star') && focusedControl.closest('.nm-search-result').dataset.entityKey;
        list.replaceChildren();
        list.setAttribute('aria-busy', String(loading));
        updateMeta();
        var source = favoritesOnly ? entries.filter(function (entry) {return favorites.includes(entityKey(entry));}) : entries.concat(actions());
        results = match(input.value, source);
        if (!input.value && !favoritesOnly) results = actions();
        Object.keys(groups).forEach(function (kind) {
            var group = results.filter(function (entry) {return entry.kind === kind;});
            if (!group.length) return;
            var heading = document.createElement('h3');
            heading.textContent = groups[kind][english() ? 1 : 0];
            heading.appendChild(document.createTextNode(' '));
            var count = document.createElement('span'); count.className = 'nm-search-group-count'; count.textContent = String(group.length);
            heading.appendChild(count);
            list.appendChild(heading);
            group.forEach(function (entry) {
                var row = document.createElement('div'); row.className = 'nm-search-result'; row.dataset.kind = kind; row.dataset.entityKey = entityKey(entry);
                var link = document.createElement('a'); link.href = entry.url; link.className = 'nm-search-entry-link';
                if (typeof entry.image === 'string' && /^\/assets\/[A-Za-z0-9/_ .%-]+\.(?:webp|png|jpg|jpeg)$/.test(entry.image) && !entry.image.includes('..')) {
                    var thumbnail = document.createElement('img'); thumbnail.className = 'nm-search-thumbnail' + (kind === 'item' ? ' nm-search-thumbnail--item' : '');
                    thumbnail.src = entry.image; thumbnail.alt = ''; thumbnail.width = 44; thumbnail.height = 44; thumbnail.loading = 'lazy'; thumbnail.decoding = 'async';
                    link.appendChild(thumbnail);
                } else {
                    var symbol = document.createElement('span'); symbol.className = 'nm-search-result-symbol';
                    symbol.appendChild(icon(kind === 'location' || entry.id === 'map' ? 'map' : kind === 'npc' || entry.id === 'profile' ? 'user' : kind === 'quest' ? 'quest' : 'book'));
                    link.appendChild(symbol);
                }
                var content = document.createElement('span'); content.className = 'nm-search-result-content';
                var title = document.createElement('strong'); title.textContent = english() ? entry.titleEn || entry.title : entry.title;
                content.appendChild(title);
                var category = document.createElement('span'); category.className = 'nm-search-result-category'; category.textContent = groups[kind][english() ? 1 : 0];
                content.appendChild(category);
                if (entry.summary) {var description = document.createElement('span'); description.className = 'nm-search-result-description'; description.textContent = english() ? entry.summaryEn || entry.summary : entry.summary; content.appendChild(description);}
                if (entry.status === 'historical-unverified') {
                    var archiveStatus = document.createElement('span'); archiveStatus.className = 'nm-search-result-description';
                    archiveStatus.textContent = label('Archive secondaire non vérifiée', 'Unverified side-quest archive'); content.appendChild(archiveStatus);
                }
                link.appendChild(content);
                var arrow = document.createElement('span'); arrow.className = 'nm-search-result-arrow'; arrow.appendChild(icon('arrow')); link.appendChild(arrow);
                link.addEventListener('click', function () {dialog.close();});
                if (entry.id === 'discord' && entry.kind === 'action') {link.target = '_blank'; link.rel = 'noopener noreferrer';}
                row.appendChild(link);
                if (typeof entry.mapUrl === 'string' && /^\/carte\?floor=[123]&entity=[A-Za-z0-9%._:-]+$/.test(entry.mapUrl) && entry.mapUrl !== entry.url) {
                    var mapLink = document.createElement('a'); mapLink.className = 'nm-search-map-link'; mapLink.href = entry.mapUrl;
                    mapLink.textContent = label('Voir sur la carte','View on map');
                    mapLink.addEventListener('click', function () {dialog.close();}); row.appendChild(mapLink);
                }
                if (kind !== 'action') {var star = document.createElement('button'); star.type = 'button'; star.className = 'nm-search-star'; updateStar(entry, star); star.addEventListener('click', function () {saveFavorite(entry, star);}); row.appendChild(star);}
                list.appendChild(row);
            });
        });
        if (!results.length && !loading) {
            var empty = document.createElement('div'); empty.className = 'nm-search-empty'; empty.appendChild(icon(favoritesOnly ? 'star' : 'search'));
            var emptyTitle = document.createElement('strong'); emptyTitle.textContent = favoritesOnly ? label('Aucun favori à afficher','No favorites to show') : label('Aucune fiche trouvée','No matching entry');
            var emptyHint = document.createElement('span'); emptyHint.textContent = favoritesOnly ? label('Enregistre une fiche avec son étoile pour la retrouver ici.','Save an entry with its star to find it here.') : label('Essaie un autre nom de boss, d’objet ou de lieu.','Try another boss, item or place name.');
            empty.appendChild(emptyTitle); empty.appendChild(emptyHint); list.appendChild(empty);
        }
        status.textContent = loading ? label('Chargement de l’index…','Loading the index…') : results.length
            ? results.length + (results.length === 1 ? label(' résultat affiché',' result shown') : label(' résultats affichés',' results shown')) : favoritesOnly
            ? label('Aucun favori. Ajoute une fiche avec l’étoile.','No favorites. Save an entry with its star.') : label('Aucun résultat. Essaie un nom, un PNJ ou une zone.','No results. Try a name, NPC or area.');
        if (focusedUrl || focusedStarKey) {
            var replacement = focusedStarKey
                ? Array.from(list.querySelectorAll('.nm-search-star')).find(function (star) {return star.closest('.nm-search-result').dataset.entityKey === focusedStarKey;})
                : Array.from(list.querySelectorAll('a')).find(function (link) {return link.getAttribute('href') === focusedUrl;});
            (replacement || favoriteFilter).focus();
        }
    }
    async function open() {
        opener = document.activeElement;
        if (!dialog.open) dialog.showModal();
        input.focus();
        loading = !entries.length;
        render();
        try {await getIndex(); loading = false; if (dialog.open) render();}
        catch (_) {loading = false; list.setAttribute('aria-busy', 'false'); status.textContent = label('Recherche indisponible. Réessaie en rouvrant la recherche.','Search unavailable. Close and reopen to retry.');}
    }
    function build() {
        if (document.getElementById('nameless-global-search')) return;
        var nav = document.querySelector('.nav-container'); if (!nav) return;
        var trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'nm-search-trigger';
        trigger.dataset.i18nIgnore = ''; trigger.appendChild(icon('search')); trigger.setAttribute('aria-keyshortcuts','Control+K Meta+K');
        var triggerLabel = document.createElement('span'); triggerLabel.className = 'nm-search-trigger-label'; triggerLabel.textContent = label('Rechercher…', 'Search…');
        var shortcut = document.createElement('kbd'); shortcut.textContent = 'Ctrl K'; shortcut.setAttribute('aria-hidden', 'true');
        trigger.appendChild(triggerLabel); trigger.appendChild(shortcut);
        trigger.setAttribute('aria-label', label('Rechercher sur Nameless (Ctrl+K)','Search Nameless (Ctrl+K)')); trigger.title = trigger.getAttribute('aria-label');
        trigger.addEventListener('click', open); nav.insertBefore(trigger, document.getElementById('hamburger'));
        dialog = document.createElement('dialog'); dialog.id = 'nameless-global-search'; dialog.className = 'nm-search-dialog nm-game-frame nm-game-panel'; dialog.dataset.i18nIgnore = '';
        dialog.setAttribute('aria-labelledby','nm-search-title');
        var header = document.createElement('div'); header.className = 'nm-search-heading';
        var eyebrow = document.createElement('span'); eyebrow.className = 'nm-search-eyebrow'; eyebrow.textContent = label('Codex d’Aincrad','Aincrad codex');
        var heading = document.createElement('h2'); heading.id = 'nm-search-title'; heading.textContent = label('Rechercher dans Nameless','Search Nameless');
        var close = document.createElement('button'); close.type = 'button'; close.className = 'nm-search-close'; close.appendChild(icon('close')); close.setAttribute('aria-label',label('Fermer la recherche','Close search')); close.addEventListener('click',function () {dialog.close();});
        header.appendChild(eyebrow); header.appendChild(heading); header.appendChild(close);
        var query = document.createElement('div'); query.className = 'nm-search-query';
        var inputLabel = document.createElement('label'); inputLabel.htmlFor = 'nm-global-query'; inputLabel.textContent = label('Boss, objet, créature, PNJ, lieu ou guide','Boss, item, creature, NPC, place or guide');
        var field = document.createElement('div'); field.className = 'nm-search-field'; field.appendChild(icon('search'));
        input = document.createElement('input'); input.id = 'nm-global-query'; input.type = 'search'; input.autocomplete = 'off'; input.maxLength = 100;
        input.placeholder = label('Ex. : Illfang, potion, mineur…','E.g. Illfang, potion, miner…'); input.addEventListener('input', render);
        clearQuery = document.createElement('button'); clearQuery.type = 'button'; clearQuery.className = 'nm-search-clear'; clearQuery.hidden = true; clearQuery.appendChild(icon('close')); clearQuery.setAttribute('aria-label',label('Effacer la recherche','Clear search'));
        clearQuery.addEventListener('click', function () {input.value = ''; render(); input.focus();});
        field.appendChild(input); field.appendChild(clearQuery); query.appendChild(inputLabel); query.appendChild(field);
        var toolbar = document.createElement('div'); toolbar.className = 'nm-search-toolbar';
        favoriteFilter = document.createElement('button'); favoriteFilter.type = 'button'; favoriteFilter.className = 'nm-search-favorites'; favoriteFilter.setAttribute('aria-pressed','false'); favoriteFilter.appendChild(icon('star'));
        favoriteLabel = document.createElement('span'); favoriteLabel.textContent = label('Mes favoris','My favorites');
        favoriteCount = document.createElement('span'); favoriteCount.className = 'nm-search-favorite-count'; favoriteCount.setAttribute('aria-hidden','true'); favoriteCount.textContent = '0';
        favoriteFilter.appendChild(favoriteLabel); favoriteFilter.appendChild(favoriteCount);
        favoriteFilter.addEventListener('click',function () {favoritesOnly = !favoritesOnly; favoriteFilter.setAttribute('aria-pressed',String(favoritesOnly)); render();});
        indexMeta = document.createElement('span'); indexMeta.className = 'nm-search-index-meta'; indexMeta.textContent = label('Index du codex','Codex index');
        toolbar.appendChild(favoriteFilter); toolbar.appendChild(indexMeta);
        var note = document.createElement('p'); note.className = 'nm-search-note'; note.textContent = label('Favoris sur ce navigateur · ↑ ↓ pour parcourir · Échap pour fermer','Favorites on this browser · ↑ ↓ to browse · Escape to close');
        status = document.createElement('p'); status.setAttribute('role','status'); status.className = 'nm-search-status';
        list = document.createElement('div'); list.className = 'nm-search-results'; list.setAttribute('aria-label',label('Résultats','Results'));
        [header,query,toolbar,status,list,note].forEach(function (el) {dialog.appendChild(el);}); document.body.appendChild(dialog);
        dialog.addEventListener('close', function () {if (opener && opener.isConnected) opener.focus();});
        dialog.addEventListener('click', function (event) {if (event.target === dialog) {var rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();}});
        dialog.addEventListener('keydown', function (event) {
            // A search input consumes native Escape to clear its value. Close the
            // dialog explicitly so the advertised shortcut works with a query too.
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                dialog.close();
                return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            var links = Array.from(list.querySelectorAll('a')); if (!links.length) return;
            event.preventDefault();
            var index = links.indexOf(document.activeElement);
            var next = index < 0 ? (event.key === 'ArrowDown' ? 0 : links.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
            links[next].focus();
        });
        document.addEventListener('keydown', function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); dialog.open ? dialog.close() : open();}
        });
        document.addEventListener('nameless:languagechange', function () {
            eyebrow.textContent = label('Codex d’Aincrad','Aincrad codex');
            heading.textContent = label('Rechercher dans Nameless','Search Nameless'); inputLabel.textContent = label('Boss, objet, créature, PNJ, lieu ou guide','Boss, item, creature, NPC, place or guide');
            input.placeholder = label('Ex. : Illfang, potion, mineur…','E.g. Illfang, potion, miner…'); close.setAttribute('aria-label',label('Fermer la recherche','Close search'));
            clearQuery.setAttribute('aria-label',label('Effacer la recherche','Clear search')); list.setAttribute('aria-label',label('Résultats','Results'));
            updateMeta(); note.textContent = label('Favoris sur ce navigateur · ↑ ↓ pour parcourir · Échap pour fermer','Favorites on this browser · ↑ ↓ to browse · Escape to close');
            triggerLabel.textContent = label('Rechercher…', 'Search…'); trigger.setAttribute('aria-label',label('Rechercher sur Nameless (Ctrl+K)','Search Nameless (Ctrl+K)')); trigger.title = trigger.getAttribute('aria-label'); if (dialog.open) render();
        });
    }
    global.NamelessGlobalSearch = {getIndex:getIndex, search:match, open:open};
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, {once:true}); else build();
})(window);
