// ============================================================
// NAMELESS — Catalogue d'Items
// Rendu 100% DOM (createElement/textContent), délégation,
// aucun handler inline. Données: itemsCatalog (items-catalog-hdv.js).
// N'affiche que des champs RÉELS: image, nom, catégorie, rareté.
// ============================================================
(function () {
    'use strict';

    var FALLBACK_IMG = '/assets/brand/nameless-emblem-128.webp?v=20261008logo';
    var RARITY = {
        common:    { label: 'Commun',     cls: 'r-common' },
        uncommon:  { label: 'Peu commun', cls: 'r-uncommon' },
        rare:      { label: 'Rare',       cls: 'r-rare' },
        epic:      { label: 'Épique',     cls: 'r-epic' },
        legendary: { label: 'Légendaire', cls: 'r-legendary' }
    };

    var allItems = [];
    var filtered = [];
    var currentPage = 1;
    var itemsPerPage = 12;
    var totalPages = 1;
    var controller = null;
    var modalReturnFocus = null;
    var previousOverflow = '';

    function normalizeSearch(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function matchesQuery(value, query) {
        var source = String(value || '');
        var english = window.NamelessTranslations && window.NamelessTranslations.en && window.NamelessTranslations.en[source];
        return [source, typeof english === 'string' ? english : ''].some(function (text) {
            var normalized = normalizeSearch(text);
            return normalized.indexOf(query) !== -1 || normalized.replace(/\s+/g, '').indexOf(query.replace(/\s+/g, '')) !== -1;
        });
    }

    function displayName(value) {
        return window.NamelessI18n && typeof window.NamelessI18n.translate === 'function' ? window.NamelessI18n.translate(value) : value;
    }

    function currentLocale() {
        return window.NamelessI18n && typeof window.NamelessI18n.getLocale === 'function' ? window.NamelessI18n.getLocale() : 'fr-FR';
    }

    function updateItemUrl(id) {
        var url = new URL(window.location.href);
        if (id) url.searchParams.set('item', id);
        else url.searchParams.delete('item');
        history.replaceState(history.state, '', url.href);
    }

    function applyItemUrl() {
        var params = new URLSearchParams(window.location.search);
        var query = params.get('q');
        var search = document.getElementById('it-search');
        if (query !== null && search) { search.value = query.slice(0, 200); applyFilters(); }
        var id = params.get('item');
        if (id && allItems.some(function (item) { return item.id === id; })) openItemModal(id, false);
        else closeModal(false);
    }

    function cleanCategory(name) {
        // "💍 Accessoires" -> "Accessoires"
        return String(name || '').replace(/^\S+\s+/, '').trim() || String(name || '');
    }

    function initItems(root) {
        destroyItems();
        if (typeof itemsCatalog === 'undefined') return;
        if (!document.getElementById('items-grid')) return;
        controller = new AbortController();
        itemsPerPage = parseInt(document.getElementById('items-per-page-select')?.value, 10) || 12;
        loadItems();
        populateCategoryFilter();
        setupItemImages();
        setupListeners();
        applyFromBestiaire();   // pré-remplit la recherche si venu d'un drop (validé)
        applyFilters();
        applyItemUrl();
        document.addEventListener('nameless:routechange', applyItemUrl, { signal: controller.signal });
        document.addEventListener('nameless:languagechange', applyFilters, { signal: controller.signal });
    }

    function destroyItems() {
        if (controller) { controller.abort(); controller = null; }
        var modal = document.querySelector('.item-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        if (modal) document.body.style.overflow = previousOverflow;
        modalReturnFocus = null;
        allItems = [];
        filtered = [];
        currentPage = 1;
        totalPages = 1;
    }

    window.NamelessItemsPage = { init: initItems, destroy: destroyItems };

    function autoStart() {
        if (window.NamelessSpaRouter && window.NamelessSpaRouter.controlsLifecycle) return;
        initItems(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoStart);
    } else {
        autoStart();
    }

    function loadItems() {
        allItems = [];
        var seen = {};
        Object.keys(itemsCatalog).forEach(function (key) {
            var group = itemsCatalog[key];
            if (!group || !group.items) return;
            group.items.forEach(function (item) {
                if (seen[item.id]) return;
                seen[item.id] = true;
                allItems.push({
                    id: item.id,
                    name: item.name,
                    rarity: item.rarity || 'common',
                    category: group.name,
                    categoryLabel: cleanCategory(group.name),
                    image: '../assets/items/' + item.image + '?v=items-cleaned-20261007'
                });
            });
        });
        filtered = allItems.slice();
    }

    function populateCategoryFilter() {
        var select = document.getElementById('it-category');
        if (!select) return;
        while (select.options.length > 1) select.remove(1);
        var seen = {};
        allItems.forEach(function (i) {
            if (!seen[i.category]) {
                seen[i.category] = true;
                var opt = document.createElement('option');
                opt.value = i.category;             // valeur = nom réel du groupe
                opt.textContent = i.categoryLabel;  // libellé nettoyé (sans emoji)
                select.appendChild(opt);
            }
        });
    }

    function sizePixelArtImage(img) {
        var media = img.parentElement;
        if (!media) return;
        // Uniquement 1x ou 2x : chaque pixel source reste un carré net.
        var scale = Math.max(1, Math.min(2, Math.floor(Math.min(
            (media.clientWidth - 32) / img.naturalWidth,
            (media.clientHeight - 32) / img.naturalHeight
        ))));
        img.style.setProperty('--item-image-width', img.naturalWidth * scale + 'px');
        img.style.setProperty('--item-image-height', img.naturalHeight * scale + 'px');
    }

    function setupItemImages() {
        // Les petits sprites gardent leur silhouette et des pixels entiers.
        // Les autres illustrations conservent le cadrage contain de la carte.
        document.addEventListener('load', function (e) {
            var t = e.target;
            if (!t || t.tagName !== 'IMG' || !t.dataset || t.dataset.fallback !== 'item' || t.dataset.fbApplied) return;
            if (t.naturalWidth > 0 && t.naturalWidth <= 128 && t.naturalHeight > 0 && t.naturalHeight <= 128) {
                t.classList.add('is-pixel-art');
                t.width = t.naturalWidth;
                t.height = t.naturalHeight;
                sizePixelArtImage(t);
            }
        }, { capture: true, signal: controller.signal });
        document.addEventListener('error', function (e) {
            var t = e.target;
            if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fallback === 'item' && !t.dataset.fbApplied) {
                t.dataset.fbApplied = '1';
                t.classList.remove('is-pixel-art');
                t.removeAttribute('width');
                t.removeAttribute('height');
                t.style.removeProperty('--item-image-width');
                t.style.removeProperty('--item-image-height');
                t.src = FALLBACK_IMG;
                t.classList.add('is-fallback');
            }
        }, { capture: true, signal: controller.signal });
        window.addEventListener('resize', function () {
            document.querySelectorAll('.item-image.is-pixel-art, .item-modal-media img.is-pixel-art').forEach(sizePixelArtImage);
        }, { signal: controller.signal });
    }

    function setupListeners() {
        var opts = { signal: controller.signal };

        var search = document.getElementById('it-search');
        if (search) search.addEventListener('input', applyFilters, opts);
        var cat = document.getElementById('it-category');
        if (cat) cat.addEventListener('change', applyFilters, opts);
        var rar = document.getElementById('it-rarity');
        if (rar) rar.addEventListener('change', applyFilters, opts);
        var sort = document.getElementById('it-sort');
        if (sort) sort.addEventListener('change', applyFilters, opts);
        var reset = document.getElementById('it-reset');
        if (reset) reset.addEventListener('click', function () {
            if (search) search.value = '';
            if (cat) cat.value = '';
            if (rar) rar.value = '';
            if (sort) sort.value = 'catalogue';
            var url = new URL(window.location.href); url.searchParams.delete('q'); history.replaceState(history.state, '', url.href);
            applyFilters();
        }, opts);
        var filterDetails = document.getElementById('it-filter-details');
        var compactFilters = window.innerWidth <= 768;
        if (filterDetails) filterDetails.open = !compactFilters;
        window.addEventListener('resize', function () {
            var compact = window.innerWidth <= 768;
            if (filterDetails && compact !== compactFilters) { filterDetails.open = !compact; compactFilters = compact; }
        }, opts);

        var grid = document.getElementById('items-grid');
        if (grid) {
            grid.addEventListener('click', function (e) {
                var card = e.target.closest('.item-card[data-id]');
                if (card) openItemModal(card.dataset.id);
            }, opts);
            grid.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                var card = e.target.closest('.item-card[data-id]');
                if (card) { e.preventDefault(); openItemModal(card.dataset.id); }
            }, opts);
        }

        var prev = document.getElementById('items-prev-page');
        if (prev) prev.addEventListener('click', function () { if (currentPage > 1) { currentPage--; render(); scrollTop(); } }, opts);
        var next = document.getElementById('items-next-page');
        if (next) next.addEventListener('click', function () { if (currentPage < totalPages) { currentPage++; render(); scrollTop(); } }, opts);
        var ipp = document.getElementById('items-per-page-select');
        if (ipp) ipp.addEventListener('change', function (e) { itemsPerPage = parseInt(e.target.value, 10) || 12; currentPage = 1; render(); }, opts);
        var nums = document.getElementById('items-pagination-numbers');
        if (nums) nums.addEventListener('click', function (e) {
            var b = e.target.closest('[data-page]');
            if (!b) return;
            var p = parseInt(b.dataset.page, 10);
            if (!isNaN(p)) { currentPage = p; render(); scrollTop(); }
        }, opts);

        // Fermeture modal: backdrop / bouton / Échap
        document.addEventListener('click', function (e) {
            var modal = document.querySelector('.item-modal');
            if (!modal || modal.style.display === 'none') return;
            if (e.target.classList.contains('item-modal') || e.target.closest('.modal-close')) closeModal();
        }, opts);
        document.addEventListener('keydown', function (e) {
            if (e.target.closest && e.target.closest('dialog[open]')) return;
            var modal = document.querySelector('.item-modal');
            if (!modal || modal.style.display === 'none') return;
            if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
            if (e.key === 'Tab') {
                var controls = Array.from(modal.querySelectorAll('button, a[href], [tabindex="0"]'));
                var first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
            }
        }, opts);
    }

    // localStorage NON fiable: on valide que l'item demandé existe dans le
    // catalogue avant de l'utiliser. On ne l'injecte que dans un champ (value).
    function applyFromBestiaire() {
        var stored;
        try { stored = localStorage.getItem('searchItemFromBestiaire'); } catch (e) { stored = null; }
        if (stored) { try { localStorage.removeItem('searchItemFromBestiaire'); } catch (e) {} }
        if (!stored || typeof stored !== 'string') return;
        var q = stored.toLowerCase();
        var exists = allItems.some(function (i) {
            var n = i.name.toLowerCase();
            return n === q || n.indexOf(q) !== -1 || q.indexOf(n) !== -1;
        });
        if (!exists) return;
        var search = document.getElementById('it-search');
        if (search) search.value = stored;
    }

    function applyFilters() {
        var q = normalizeSearch(document.getElementById('it-search') && document.getElementById('it-search').value || '');
        var cat = (document.getElementById('it-category') && document.getElementById('it-category').value) || '';
        var rar = (document.getElementById('it-rarity') && document.getElementById('it-rarity').value) || '';

        filtered = allItems.filter(function (i) {
            var matchSearch = !q || [i.name, i.category, i.categoryLabel].some(function (value) { return matchesQuery(value, q); });
            var matchCat = !cat || i.category === cat;
            var matchRar = !rar || i.rarity === rar;
            return matchSearch && matchCat && matchRar;
        });
        var sort = document.getElementById('it-sort') && document.getElementById('it-sort').value || 'catalogue';
        var byName = function (a, b) { return displayName(a.name).localeCompare(displayName(b.name), currentLocale(), { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id); };
        var rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
        if (sort === 'name-asc') filtered.sort(byName);
        else if (sort === 'name-desc') filtered.sort(function (a, b) { return -byName(a, b); });
        else if (sort === 'rarity-asc') filtered.sort(function (a, b) { return rarityOrder[a.rarity] - rarityOrder[b.rarity] || byName(a, b); });
        else if (sort === 'rarity-desc') filtered.sort(function (a, b) { return rarityOrder[b.rarity] - rarityOrder[a.rarity] || byName(a, b); });
        else if (sort === 'category') filtered.sort(function (a, b) { return cleanCategory(displayName(a.category)).localeCompare(cleanCategory(displayName(b.category)), currentLocale()) || byName(a, b); });
        currentPage = 1;
        render();
    }

    function render() {
        var grid = document.getElementById('items-grid');
        if (!grid) return;
        grid.innerHTML = '';

        totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;

        var count = document.getElementById('it-count');
        if (count) count.textContent = filtered.length + ' item' + (filtered.length > 1 ? 's' : '');

        if (filtered.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'items-empty';
            var h = document.createElement('h3'); h.textContent = 'Aucun item trouvé';
            var p = document.createElement('p'); p.textContent = 'Modifie ta recherche ou tes filtres.';
            empty.appendChild(h); empty.appendChild(p);
            grid.appendChild(empty);
            updatePagination();
            return;
        }

        var start = (currentPage - 1) * itemsPerPage;
        filtered.slice(start, start + itemsPerPage).forEach(function (item) { grid.appendChild(buildCard(item)); });
        if (modalReturnFocus && modalReturnFocus.matches('.item-card') && !modalReturnFocus.isConnected) {
            var openerId = modalReturnFocus.dataset.id;
            modalReturnFocus = Array.from(grid.querySelectorAll('.item-card')).find(function (card) { return card.dataset.id === openerId; }) || null;
        }
        updatePagination();
    }

    function rarityMeta(r) { return RARITY[r] || RARITY.common; }

    function buildCard(item) {
        var meta = rarityMeta(item.rarity);
        var card = document.createElement('article');
        card.className = 'item-card ' + meta.cls;
        var modal = document.querySelector('.item-modal');
        if (modal && modal.style.display === 'flex' && modal.dataset.item === item.id) card.classList.add('is-selected');
        card.dataset.id = item.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Voir ' + item.name);
        card.setAttribute('aria-haspopup', 'dialog');

        var media = document.createElement('div');
        media.className = 'item-media';
        var img = document.createElement('img');
        img.className = 'item-image';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = item.name;
        img.dataset.fallback = 'item';
        img.src = item.image;
        media.appendChild(img);
        var badge = document.createElement('span');
        badge.className = 'item-rarity-badge ' + meta.cls;
        badge.textContent = meta.label;
        media.appendChild(badge);
        card.appendChild(media);

        var body = document.createElement('div');
        body.className = 'item-body';
        var name = document.createElement('h2');
        name.className = 'item-name';
        name.textContent = item.name;
        body.appendChild(name);
        var catChip = document.createElement('span');
        catChip.className = 'item-cat';
        catChip.textContent = item.categoryLabel;
        body.appendChild(catChip);
        card.appendChild(body);

        return card;
    }

    function openItemModal(id, updateUrl) {
        var item = allItems.filter(function (i) { return i.id === id; })[0];
        if (!item) return;
        var meta = rarityMeta(item.rarity);

        var modal = document.querySelector('.item-modal');
        if (!modal) { modal = document.createElement('div'); modal.className = 'item-modal'; modal.id = 'item-dialog'; document.body.appendChild(modal); }
        if (modal.style.display !== 'flex') { modalReturnFocus = document.activeElement; previousOverflow = document.body.style.overflow; }
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'item-dialog-title');
        modal.dataset.item = id;
        modal.innerHTML = '';

        var content = document.createElement('div');
        content.className = 'modal-content';

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'modal-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
        document.querySelectorAll('.item-card').forEach(function (card) { card.classList.toggle('is-selected', card.dataset.id === id); });
        content.appendChild(close);

        var media = document.createElement('div');
        media.className = 'item-modal-media';
        var img = document.createElement('img');
        img.alt = item.name;
        img.dataset.fallback = 'item';
        img.src = item.image;
        media.appendChild(img);
        content.appendChild(media);

        var info = document.createElement('div');
        info.className = 'item-modal-info';
        var h2 = document.createElement('h2');
        h2.className = 'item-modal-name';
        h2.id = 'item-dialog-title';
        h2.textContent = item.name;
        info.appendChild(h2);

        var badges = document.createElement('div');
        badges.className = 'item-modal-badges';
        var rb = document.createElement('span');
        rb.className = 'item-chip ' + meta.cls;
        rb.textContent = meta.label;
        badges.appendChild(rb);
        var cb = document.createElement('span');
        cb.className = 'item-chip chip-cat';
        cb.textContent = item.categoryLabel;
        badges.appendChild(cb);
        info.appendChild(badges);

        if (window.NamelessGlobalSearch && typeof window.NamelessGlobalSearch.getIndex === 'function') {
            var sourceSignal = controller && controller.signal;
            var sources = document.createElement('section'); sources.className = 'item-sources';
            var sourcesTitle = document.createElement('h3'); sourcesTitle.textContent = 'Sources connues'; sources.appendChild(sourcesTitle);
            var sourceStatus = document.createElement('p'); sourceStatus.textContent = 'Chargement des sources...'; sources.appendChild(sourceStatus);
            info.appendChild(sources);
            var currentSources = function () {
                return !(sourceSignal && sourceSignal.aborted) && sources.isConnected && modal.isConnected
                    && modal.dataset.item === id && modal.style.display === 'flex';
            };
            window.NamelessGlobalSearch.getIndex().then(function (entries) {
                if (!currentSources()) return;
                var entry = entries.find(function (candidate) { return candidate.kind === 'item' && candidate.id === id; });
                var knownSources = entry && Array.isArray(entry.sources) ? entry.sources : [];
                sourceStatus.textContent = knownSources.length ? '' : 'Aucune source confirmée dans le bestiaire.';
                if (!knownSources.length) return;
                var list = document.createElement('ul');
                knownSources.forEach(function (source) {
                    if (!source || typeof source.url !== 'string' || typeof source.title !== 'string') return;
                    var url;
                    try { url = new URL(source.url, window.location.origin); } catch (error) { return; }
                    if (url.origin !== window.location.origin || url.pathname !== '/bestiaire' || !/^\d+$/.test(url.searchParams.get('creature') || '')) return;
                    var row = document.createElement('li'); var link = document.createElement('a');
                    link.href = url.pathname + url.search;
                    link.textContent = source.title + (/^[1-3]$/.test(String(source.floor)) ? ' — Palier ' + source.floor : '');
                    row.appendChild(link);
                    if (typeof source.location === 'string' && source.location.trim()) {
                        var zone = document.createElement('span'); zone.className = 'item-source-zone';
                        zone.textContent = ' — ' + source.location;
                        row.appendChild(zone);
                    }
                    if (typeof source.mapUrl === 'string') {
                        var mapUrl;
                        try { mapUrl = new URL(source.mapUrl, window.location.origin); } catch (error) { mapUrl = null; }
                        if (mapUrl && mapUrl.origin === window.location.origin && mapUrl.pathname === '/carte'
                            && mapUrl.searchParams.get('entity') === 'creature:' + url.searchParams.get('creature')
                            && /^[1-3]$/.test(String(source.floor)) && mapUrl.searchParams.get('floor') === String(source.floor)) {
                            var mapLink = document.createElement('a'); mapLink.className = 'item-source-map-link';
                            mapLink.href = mapUrl.pathname + mapUrl.search; mapLink.textContent = 'Voir sur la carte';
                            row.appendChild(document.createTextNode(' · ')); row.appendChild(mapLink);
                        }
                    }
                    list.appendChild(row);
                });
                if (list.children.length) { sourceStatus.remove(); sources.appendChild(list); }
                else sourceStatus.textContent = 'Aucune source confirmée dans le bestiaire.';
            }).catch(function () { if (currentSources()) sourceStatus.textContent = 'Sources temporairement indisponibles.'; });
        }

        content.appendChild(info);
        modal.appendChild(content);
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (updateUrl !== false) updateItemUrl(id);
        close.focus();
    }

    function closeModal(updateUrl) {
        var modal = document.querySelector('.item-modal');
        if (modal && modal.style.display !== 'none') {
            modal.style.display = 'none'; document.body.style.overflow = previousOverflow;
            delete modal.dataset.item;
            if (modalReturnFocus && modalReturnFocus.isConnected) modalReturnFocus.focus();
            modalReturnFocus = null;
        }
        document.querySelectorAll('.item-card.is-selected').forEach(function (card) { card.classList.remove('is-selected'); });
        if (updateUrl !== false) updateItemUrl(null);
    }

    function updatePagination() {
        var container = document.getElementById('items-pagination-container');
        var info = document.getElementById('items-pagination-info-text');
        var numsEl = document.getElementById('items-pagination-numbers');
        var prev = document.getElementById('items-prev-page');
        var next = document.getElementById('items-next-page');
        var total = filtered.length;
        totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

        if (container) container.style.display = (total === 0 || totalPages <= 1) ? 'none' : '';
        if (info) {
            if (total === 0) { info.textContent = ''; }
            else {
                var s = (currentPage - 1) * itemsPerPage + 1;
                var e = Math.min(currentPage * itemsPerPage, total);
                info.textContent = 'Affichage de ' + s + '-' + e + ' sur ' + total + ' items';
            }
        }
        if (prev) prev.disabled = currentPage <= 1;
        if (next) next.disabled = currentPage >= totalPages;

        if (numsEl) {
            numsEl.innerHTML = '';
            if (totalPages <= 1) return;
            var maxShow = 7;
            var st = Math.max(1, currentPage - 3);
            var en = Math.min(totalPages, st + maxShow - 1);
            if (en - st < maxShow - 1) st = Math.max(1, en - maxShow + 1);
            if (st > 1) { numsEl.appendChild(pageBtn(1)); if (st > 2) numsEl.appendChild(ellipsis()); }
            for (var i = st; i <= en; i++) numsEl.appendChild(pageBtn(i));
            if (en < totalPages) { if (en < totalPages - 1) numsEl.appendChild(ellipsis()); numsEl.appendChild(pageBtn(totalPages)); }
        }
    }
    function pageBtn(n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pagination-number' + (n === currentPage ? ' active' : '');
        b.textContent = n;
        b.dataset.page = n;
        b.setAttribute('aria-label', 'Page ' + n);
        if (n === currentPage) b.setAttribute('aria-current', 'page');
        return b;
    }
    function ellipsis() {
        var s = document.createElement('span');
        s.className = 'pagination-ellipsis';
        s.textContent = '…';
        return s;
    }
    function scrollTop() {
        var grid = document.getElementById('items-grid');
        if (grid) grid.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
})();
