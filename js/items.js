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
    var sourceItems = new Set();
    var sourceFiltersReady = false;

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

    function itemUi(fr, en) { return window.NamelessI18n && typeof window.NamelessI18n.getLanguage === 'function' && window.NamelessI18n.getLanguage() === 'en' ? en : fr; }
    function compactPanel() { return window.innerWidth <= 980; }

    function syncItemPanelMode() {
        var modal = document.querySelector('.item-modal');
        if (!modal) return;
        var compact = compactPanel(), wasSheet = modal.dataset.panelMode === 'sheet';
        modal.dataset.panelMode = compact ? 'sheet' : 'rail';
        modal.setAttribute('role', compact ? 'dialog' : 'region');
        if (compact) modal.setAttribute('aria-modal', 'true'); else modal.removeAttribute('aria-modal');
        if (modal.style.display === 'flex') {
            if (compact) document.body.style.overflow = 'hidden';
            else if (wasSheet) document.body.style.overflow = previousOverflow;
        }
        document.querySelectorAll('.item-card').forEach(function (card) {
            if (compact) card.setAttribute('aria-haspopup', 'dialog'); else card.removeAttribute('aria-haspopup');
        });
    }

    function setItemSelection(id) {
        document.querySelectorAll('.item-card').forEach(function (card) {
            var selected = card.dataset.id === id;
            card.classList.toggle('is-selected', selected); card.setAttribute('aria-expanded', String(selected));
        });
    }

    function setupFilterChoices() {
        var group = document.querySelector('.items-page .items-filter-group');
        if (!group) return;
        group.querySelectorAll('.catalogue-filter-section').forEach(function (section) { section.remove(); });
        group.querySelectorAll('label, select').forEach(function (field) { field.classList.add('catalogue-native-field'); });
        var definitions = [
            ['it-category', 'Catégories', 'Categories', function (item) { return item.category; }],
            ['it-rarity', 'Raretés', 'Rarities', function (item) { return item.rarity; }]
        ];
        if (sourceFiltersReady) definitions.push(['it-source', 'Sources', 'Sources', function (item) { return sourceItems.has(item.id) ? 'known' : 'unknown'; }]);
        definitions.forEach(function (definition) {
            var id = definition[0], select = document.getElementById(id);
            if (!select) return;
            var section = document.createElement('fieldset'); section.className = 'catalogue-filter-section';
            var title = document.createElement('legend'); title.textContent = itemUi(definition[1], definition[2]); section.appendChild(title);
            Array.from(select.options).filter(function (option) { return option.value; }).forEach(function (option) {
                var countValue = allItems.filter(function (item) { return definition[3](item) === option.value; }).length;
                if (!countValue) return;
                var row = document.createElement('label'); row.className = 'catalogue-filter-option';
                var input = document.createElement('input'); input.type = 'checkbox'; input.dataset.filterField = id; input.value = option.value; input.checked = select.value === option.value;
                var name = document.createElement('span'); name.textContent = displayName(option.textContent);
                var count = document.createElement('span'); count.textContent = String(countValue);
                row.append(input, name, count); section.appendChild(row);
            });
            group.appendChild(section);
        });
    }

    function syncFilterChoices() {
        document.querySelectorAll('.items-page [data-filter-field]').forEach(function (input) {
            input.checked = document.getElementById(input.dataset.filterField).value === input.value;
        });
        var chips = document.getElementById('it-active-filters');
        if (!chips) return;
        chips.replaceChildren();
        ['it-search', 'it-category', 'it-rarity', 'it-source'].forEach(function (id) {
            var field = document.getElementById(id);
            if (!field || !field.value) return;
            var label = field.tagName === 'SELECT' ? field.options[field.selectedIndex].textContent : field.value;
            var button = document.createElement('button'); button.type = 'button'; button.className = 'catalogue-filter-chip'; button.dataset.clearFilter = id; button.textContent = displayName(label) + ' ×';
            button.setAttribute('aria-label', itemUi('Retirer le filtre ', 'Remove filter ') + displayName(label)); chips.appendChild(button);
        });
    }

    function loadSourceFilters() {
        if (!window.NamelessGlobalSearch || typeof window.NamelessGlobalSearch.getIndex !== 'function') return;
        var signal = controller.signal;
        window.NamelessGlobalSearch.getIndex().then(function (entries) {
            if (signal.aborted || !document.querySelector('.items-page')) return;
            sourceItems = new Set(entries.filter(function (entry) { return entry.kind === 'item' && Array.isArray(entry.sources) && entry.sources.some(validBestiarySource); }).map(function (entry) { return entry.id; }));
            sourceFiltersReady = true; setupFilterChoices(); syncFilterChoices();
        }).catch(function () { /* Catalogue filters remain usable without the source index. */ });
    }

    function validBestiarySource(source) {
        if (!source || typeof source.url !== 'string' || typeof source.title !== 'string') return false;
        try { var url = new URL(source.url, window.location.origin); return url.origin === window.location.origin && url.pathname === '/bestiaire' && /^\d+$/.test(url.searchParams.get('creature') || ''); } catch (_) { return false; }
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
        setupFilterChoices();
        setupItemImages();
        setupListeners();
        applyFromBestiaire();   // pré-remplit la recherche si venu d'un drop (validé)
        applyFilters();
        applyItemUrl();
        if (!compactPanel() && !new URLSearchParams(window.location.search).has('item') && filtered.length) openItemModal(filtered[0].id, false, false);
        loadSourceFilters();
        document.addEventListener('nameless:routechange', applyItemUrl, { signal: controller.signal });
        document.addEventListener('nameless:languagechange', function () {
            setupFilterChoices(); applyFilters();
            var modal = document.querySelector('.item-modal');
            if (modal && modal.style.display === 'flex' && modal.dataset.item) openItemModal(modal.dataset.item, false, false);
        }, { signal: controller.signal });
    }

    function destroyItems() {
        if (controller) { controller.abort(); controller = null; }
        var modal = document.querySelector('.item-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        if (modal && modal.dataset.panelMode === 'sheet' && modal.style.display === 'flex') document.body.style.overflow = previousOverflow;
        modalReturnFocus = null;
        allItems = [];
        filtered = [];
        currentPage = 1;
        totalPages = 1;
        sourceItems = new Set(); sourceFiltersReady = false;
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
        var choices = document.querySelector('.items-page .items-filter-group');
        if (choices) choices.addEventListener('change', function (event) {
            var input = event.target.closest('[data-filter-field]'); if (!input) return;
            var select = document.getElementById(input.dataset.filterField); if (select) { select.value = input.checked ? input.value : ''; applyFilters(); }
        }, opts);
        var chips = document.getElementById('it-active-filters');
        if (chips) chips.addEventListener('click', function (event) {
            var button = event.target.closest('[data-clear-filter]'); if (!button) return;
            var field = document.getElementById(button.dataset.clearFilter); if (field) { field.value = ''; applyFilters(); }
        }, opts);
        var view = document.querySelector('.items-page .catalogue-view');
        if (view) view.addEventListener('click', function (event) {
            var button = event.target.closest('[data-catalog-view]'); if (!button) return;
            document.getElementById('items-grid').dataset.view = button.dataset.catalogView;
            view.querySelectorAll('button').forEach(function (control) { control.setAttribute('aria-pressed', String(control === button)); });
        }, opts);
        var cat = document.getElementById('it-category');
        if (cat) cat.addEventListener('change', applyFilters, opts);
        var rar = document.getElementById('it-rarity');
        if (rar) rar.addEventListener('change', applyFilters, opts);
        var source = document.getElementById('it-source'); if (source) source.addEventListener('change', applyFilters, opts);
        var sort = document.getElementById('it-sort');
        if (sort) sort.addEventListener('change', applyFilters, opts);
        var reset = document.getElementById('it-reset');
        if (reset) reset.addEventListener('click', function () {
            if (search) search.value = '';
            if (cat) cat.value = '';
            if (rar) rar.value = '';
            if (source) source.value = '';
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
            syncItemPanelMode();
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
            if ((modal.dataset.panelMode === 'sheet' && e.target === modal) || e.target.closest('.item-modal .modal-close')) closeModal();
        }, opts);
        document.addEventListener('keydown', function (e) {
            if (e.target.closest && e.target.closest('dialog[open]')) return;
            var modal = document.querySelector('.item-modal');
            if (!modal || modal.style.display === 'none') return;
            if (e.key === 'Escape' && (compactPanel() || modal.contains(e.target))) { e.preventDefault(); closeModal(); }
            if (e.key === 'Tab' && compactPanel()) {
                var controls = Array.from(modal.querySelectorAll('button, a[href], [tabindex="0"]')).filter(function (control) { return !control.closest('[hidden]') && control.tabIndex !== -1; });
                var first = controls[0], last = controls[controls.length - 1];
                if (!first) return;
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
        var source = (document.getElementById('it-source') && document.getElementById('it-source').value) || '';

        filtered = allItems.filter(function (i) {
            var matchSearch = !q || [i.name, i.category, i.categoryLabel].some(function (value) { return matchesQuery(value, q); });
            var matchCat = !cat || i.category === cat;
            var matchRar = !rar || i.rarity === rar;
            var matchSource = !source || !sourceFiltersReady || (source === 'known' ? sourceItems.has(i.id) : !sourceItems.has(i.id));
            return matchSearch && matchCat && matchRar && matchSource;
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
        syncFilterChoices();
        render();
    }

    function render() {
        var grid = document.getElementById('items-grid');
        if (!grid) return;
        grid.innerHTML = '';

        totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;

        var count = document.getElementById('it-count');
        if (count) count.textContent = filtered.length + itemUi(' objet' + (filtered.length > 1 ? 's trouvés' : ' trouvé'), ' item' + (filtered.length > 1 ? 's found' : ' found'));

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
        card.dataset.selectedLabel = itemUi('Sélectionné', 'Selected');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Voir ' + item.name);
        if (compactPanel()) card.setAttribute('aria-haspopup', 'dialog');
        card.setAttribute('aria-controls', 'item-dialog'); card.setAttribute('aria-expanded', String(card.classList.contains('is-selected')));

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
        var tooltip = document.createElement('span'); tooltip.className = 'catalogue-tooltip'; tooltip.setAttribute('aria-hidden', 'true');
        var icon = document.createElement('img'); icon.src = item.image; icon.alt = ''; icon.loading = 'lazy'; icon.dataset.fallback = 'item'; tooltip.appendChild(icon);
        var tooltipInfo = document.createElement('span'), tooltipName = document.createElement('strong'), tooltipCategory = document.createElement('span'), tooltipRarity = document.createElement('span');
        tooltipName.textContent = displayName(item.name); tooltipCategory.textContent = displayName(item.categoryLabel); tooltipRarity.textContent = displayName(meta.label); tooltipInfo.append(tooltipName, tooltipCategory, tooltipRarity); tooltip.appendChild(tooltipInfo); card.appendChild(tooltip);

        return card;
    }

    function openItemModal(id, updateUrl, moveFocus = true) {
        var item = allItems.filter(function (i) { return i.id === id; })[0];
        if (!item) return;
        var meta = rarityMeta(item.rarity);

        var modal = document.querySelector('.item-modal');
        if (!modal) { modal = document.createElement('div'); modal.className = 'item-modal'; modal.id = 'item-dialog'; (document.querySelector('.items-page .catalogue-detail-slot') || document.body).appendChild(modal); }
        window.NamelessReferenceShell?.cancelPanelClose(modal);
        if (modal.style.display !== 'flex') { modalReturnFocus = document.activeElement; previousOverflow = document.body.style.overflow; }
        if (moveFocus) modalReturnFocus = document.activeElement;
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
        setItemSelection(id);
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

        var sources = document.createElement('section'); sources.className = 'item-sources';
        var sourcesTitle = document.createElement('h3'); sourcesTitle.textContent = itemUi('Sources d’obtention', 'Known sources'); sources.appendChild(sourcesTitle);
        var sourceStatus = document.createElement('p'); sourceStatus.textContent = itemUi('Sources non renseignées.', 'Sources not recorded.'); sources.appendChild(sourceStatus);
        content.appendChild(info);
        var detailTabs = installItemDetailTabs(content, id, sources);

        if (window.NamelessGlobalSearch && typeof window.NamelessGlobalSearch.getIndex === 'function') {
            var sourceSignal = controller && controller.signal;
            sourceStatus.textContent = itemUi('Chargement des sources...', 'Loading sources...');
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
                var sourceUrls = new Set(knownSources.filter(validBestiarySource).map(function (source) { return source.url; }));
                var related = entries.filter(function (candidate) {
                    return candidate.kind === 'item' && candidate.id !== id && allItems.some(function (record) { return record.id === candidate.id; }) && Array.isArray(candidate.sources) && candidate.sources.some(function (source) { return validBestiarySource(source) && sourceUrls.has(source.url); });
                });
                if (related.length) detailTabs.related(related.slice(0, 6));
            }).catch(function () { if (currentSources()) sourceStatus.textContent = 'Sources temporairement indisponibles.'; });
        }

        modal.appendChild(content);
        modal.style.display = 'flex';
        syncItemPanelMode();
        if (updateUrl !== false) updateItemUrl(id);
        if (moveFocus) close.focus();
    }

    function installItemDetailTabs(content, id, sources) {
        var bar = document.createElement('div'); bar.className = 'catalogue-detail-tabs'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', itemUi('Détails de l’objet', 'Item details'));
        var panels = new Map(), buttons = new Map();
        content.appendChild(bar);
        function addTab(key, fr, en) {
            var button = document.createElement('button'); button.type = 'button'; button.id = 'it-tab-' + id + '-' + key; button.dataset.detailTab = key; button.setAttribute('role', 'tab'); button.textContent = itemUi(fr, en); bar.appendChild(button); buttons.set(key, button);
            var panel = document.createElement('section'); panel.id = 'it-panel-' + id + '-' + key; panel.dataset.catalogueTabPanel = key; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id); button.setAttribute('aria-controls', panel.id); panels.set(key, panel); content.appendChild(panel); panel.hidden = key !== 'overview'; button.setAttribute('aria-selected', String(key === 'overview')); button.tabIndex = key === 'overview' ? 0 : -1;
            return panel;
        }
        addTab('overview', 'Aperçu', 'Overview'); addTab('sources', 'Sources', 'Sources');
        function activate(key, focus) {
            panels.forEach(function (panel, name) { panel.hidden = name !== key; });
            buttons.forEach(function (button, name) { button.setAttribute('aria-selected', String(name === key)); button.tabIndex = name === key ? 0 : -1; });
            panels.get(key === 'sources' ? 'sources' : 'overview').appendChild(sources);
            if (focus) buttons.get(key).focus();
        }
        bar.addEventListener('click', function (e) { var button = e.target.closest('[data-detail-tab]'); if (button) activate(button.dataset.detailTab, false); }, { signal: controller.signal });
        bar.addEventListener('keydown', function (e) {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            var keys = Array.from(buttons.keys()), current = keys.indexOf(e.target.dataset.detailTab); if (current < 0) return;
            e.preventDefault(); activate(keys[e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length], true);
        }, { signal: controller.signal });
        activate('overview', false);
        return { related: function (entries) {
            var panel = addTab('related', 'Objets liés', 'Related items');
            var title = document.createElement('h3'); title.className = 'modal-section-title'; title.textContent = itemUi('Objets des mêmes sources', 'Items from the same sources'); panel.appendChild(title);
            var list = document.createElement('div'); list.className = 'catalogue-related-items';
            entries.forEach(function (entry) {
                var item = allItems.find(function (record) { return record.id === entry.id; }); if (!item) return;
                var link = document.createElement('a'); link.className = 'catalogue-related-item'; link.href = '/items?item=' + encodeURIComponent(item.id);
                var image = document.createElement('img'); image.src = item.image; image.alt = ''; image.dataset.fallback = 'item';
                var name = document.createElement('span'); name.textContent = displayName(item.name); link.append(image, name); list.appendChild(link);
            }); panel.appendChild(list);
        } };
    }

    function closeModal(updateUrl) {
        var modal = document.querySelector('.item-modal');
        if (modal && modal.style.display !== 'none') {
            var finish = function () {
                modal.style.display = 'none'; if (modal.dataset.panelMode === 'sheet') document.body.style.overflow = previousOverflow;
                delete modal.dataset.item;
                if (modalReturnFocus && modalReturnFocus.isConnected) modalReturnFocus.focus();
                modalReturnFocus = null;
            };
            if (updateUrl === false || !window.NamelessReferenceShell) { window.NamelessReferenceShell?.cancelPanelClose(modal); finish(); }
            else window.NamelessReferenceShell.closePanel(modal, finish);
        }
        setItemSelection(null);
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
