// ============================================================
// NAMELESS — Catalogue d'Items
// Rendu 100% DOM (createElement/textContent), délégation,
// aucun handler inline. Données: itemsCatalog (items-catalog-hdv.js).
// N'affiche que des champs RÉELS: image, nom, catégorie, rareté.
// ============================================================
(function () {
    'use strict';

    var FALLBACK_IMG = '../assets/Logo_3.png';
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

    function cleanCategory(name) {
        // "💍 Accessoires" -> "Accessoires"
        return String(name || '').replace(/^\S+\s+/, '').trim() || String(name || '');
    }

    function initItems(root) {
        destroyItems();
        if (typeof itemsCatalog === 'undefined') return;
        if (!document.getElementById('items-grid')) return;
        controller = new AbortController();
        loadItems();
        populateCategoryFilter();
        setupImageFallback();
        setupListeners();
        applyFromBestiaire();   // pré-remplit la recherche si venu d'un drop (validé)
        applyFilters();
    }

    function destroyItems() {
        if (controller) { controller.abort(); controller = null; }
        var modal = document.querySelector('.item-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        document.body.style.overflow = 'auto';
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
                    image: '../assets/items/' + item.image
                });
            });
        });
        filtered = allItems.slice();
    }

    function populateCategoryFilter() {
        var select = document.getElementById('it-category');
        if (!select) return;
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

    function setupImageFallback() {
        document.addEventListener('error', function (e) {
            var t = e.target;
            if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fallback === 'item' && !t.dataset.fbApplied) {
                t.dataset.fbApplied = '1';
                t.src = FALLBACK_IMG;
                t.classList.add('is-fallback');
            }
        }, { capture: true, signal: controller.signal });
    }

    function setupListeners() {
        var opts = { signal: controller.signal };

        var search = document.getElementById('it-search');
        if (search) search.addEventListener('input', applyFilters, opts);
        var cat = document.getElementById('it-category');
        if (cat) cat.addEventListener('change', applyFilters, opts);
        var rar = document.getElementById('it-rarity');
        if (rar) rar.addEventListener('change', applyFilters, opts);
        var reset = document.getElementById('it-reset');
        if (reset) reset.addEventListener('click', function () {
            if (search) search.value = '';
            if (cat) cat.value = '';
            if (rar) rar.value = '';
            applyFilters();
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
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); }, opts);
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
        var q = (document.getElementById('it-search') && document.getElementById('it-search').value || '').toLowerCase().trim();
        var cat = (document.getElementById('it-category') && document.getElementById('it-category').value) || '';
        var rar = (document.getElementById('it-rarity') && document.getElementById('it-rarity').value) || '';

        filtered = allItems.filter(function (i) {
            var matchSearch = !q || i.name.toLowerCase().indexOf(q) !== -1 || i.categoryLabel.toLowerCase().indexOf(q) !== -1;
            var matchCat = !cat || i.category === cat;
            var matchRar = !rar || i.rarity === rar;
            return matchSearch && matchCat && matchRar;
        });
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
        updatePagination();
    }

    function rarityMeta(r) { return RARITY[r] || RARITY.common; }

    function buildCard(item) {
        var meta = rarityMeta(item.rarity);
        var card = document.createElement('article');
        card.className = 'item-card ' + meta.cls;
        card.dataset.id = item.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Voir ' + item.name);

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
        var name = document.createElement('h3');
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

    function openItemModal(id) {
        var item = allItems.filter(function (i) { return i.id === id; })[0];
        if (!item) return;
        var meta = rarityMeta(item.rarity);

        var modal = document.querySelector('.item-modal');
        if (!modal) { modal = document.createElement('div'); modal.className = 'item-modal'; document.body.appendChild(modal); }
        modal.innerHTML = '';

        var content = document.createElement('div');
        content.className = 'modal-content';

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'modal-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
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

        content.appendChild(info);
        modal.appendChild(content);
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        var modal = document.querySelector('.item-modal');
        if (modal) { modal.style.display = 'none'; document.body.style.overflow = 'auto'; }
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
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
})();
