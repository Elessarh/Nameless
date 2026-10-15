// ============================================================
// NAMELESS — Catalogue d'Items
// Rendu 100% DOM (createElement/textContent), délégation,
// aucun handler inline. Données: instantané du wiki officiel.
// Les caractéristiques absentes de la source restent absentes.
// ============================================================
(function () {
    'use strict';

    var FALLBACK_IMG = '/assets/items/item-unavailable.svg';
    var RARITY = {
        common:    { label: 'Commun',     cls: 'r-common' },
        uncommon:  { label: 'Peu commun', cls: 'r-uncommon' },
        rare:      { label: 'Rare',       cls: 'r-rare' },
        epic:      { label: 'Épique',     cls: 'r-epic' },
        legendary: { label: 'Légendaire', cls: 'r-legendary' },
        mythic:    { label: 'Mythique', cls: 'r-mythic' },
        godlike:   { label: 'Godlike', cls: 'r-godlike' },
        splus:     { label: 'S+', cls: 'r-splus' },
        splusplus: { label: 'S++', cls: 'r-splusplus' },
        c: { label: 'Commun', cls: 'r-common' }, b: { label: 'Rare', cls: 'r-rare' },
        a: { label: 'Légendaire', cls: 'r-legendary' }, s: { label: 'Épique', cls: 'r-epic' },
        ss: { label: 'Mythique', cls: 'r-mythic' }, sss: { label: 'Godlike', cls: 'r-godlike' },
        unrecorded:{ label: 'Non renseignée', cls: 'r-unrecorded' }
    };
    var CATEGORY_LABELS = {
        'Floor Key': ['Clés de palier', 'Floor keys'], 'Sword': ['Épées', 'Swords'], 'Armor': ['Armures', 'Armor'],
        'Shield': ['Boucliers', 'Shields'], 'Dagger': ['Dagues', 'Daggers'], 'Gauntlet': ['Gantelets', 'Gauntlets'],
        'Bow': ['Arcs', 'Bows'], 'Crossbow': ['Arbalètes', 'Crossbows'], 'Staff_Mage': ['Bâtons de mage', 'Mage staves'],
        'Catalyst': ['Catalyseurs', 'Catalysts'], 'Staff_Shaman': ['Bâtons de shaman', 'Shaman staves'],
        'Ring': ['Anneaux', 'Rings'], 'Amulet': ['Amulettes', 'Amulets'], 'Bracelet': ['Bracelets', 'Bracelets'],
        'Gloves': ['Gants', 'Gloves'], 'Artifact': ['Artefacts', 'Artifacts'], 'Accessory': ['Accessoires', 'Accessories'],
        'Tool': ['Outils', 'Tools'], 'Consumable': ['Consommables', 'Consumables'], 'Food': ['Nourriture', 'Food'],
        'Crystal': ['Cristaux', 'Crystals'], 'Fortifier': ['Fortifiants', 'Fortifiers'],
        'Consumable Item': ['Objets consommables', 'Consumable items'], 'Potion Heal': ['Potions de soin', 'Healing potions'],
        'Potion Mana': ['Potions de mana', 'Mana potions'], 'Potion Stamina': ['Potions d’endurance', 'Stamina potions'],
        'Rune': ['Runes', 'Runes'], 'Material': ['Matériaux', 'Materials'],
        'Material P1': ['Matériaux · Palier 1', 'Materials · Floor 1'], 'Material P2': ['Matériaux · Palier 2', 'Materials · Floor 2'],
        'Material P3': ['Matériaux · Palier 3', 'Materials · Floor 3'], 'Saint Valentin': ['Saint-Valentin', 'Valentine’s Day'],
        'Nouvel An Chinois': ['Nouvel An chinois', 'Lunar New Year'], 'Dungeon Keys': ['Clés de donjon', 'Dungeon keys'],
        'Miner Job': ['Métier · Mineur', 'Profession · Miner'], 'Lumberjack Job': ['Métier · Bûcheron', 'Profession · Lumberjack'],
        'Farmer Job': ['Métier · Fermier', 'Profession · Farmer'], 'Fishing Job': ['Métier · Pêcheur', 'Profession · Fisher'],
        'Item halloween': ['Halloween', 'Halloween'], 'Item Noël 2025': ['Noël 2025', 'Christmas 2025'],
        'Key Crate': ['Clés de coffre', 'Crate keys']
    };
    // Display labels only: the official identification keys and values stay intact.
    var STAT_LABELS_FR = {
        'Additional Defense': 'Défense supplémentaire', 'Additional Dexterity': 'Dextérité supplémentaire',
        'Additional Esprit': 'Esprit supplémentaire', 'Additional Intelligence': 'Intelligence supplémentaire',
        'Additional Strength': 'Force supplémentaire', 'Additional Vitality': 'Vitalité supplémentaire',
        'Attack Speed': 'Vitesse d’attaque', 'Block Power': 'Puissance de blocage', 'Block Rating': 'Chance de blocage',
        'Cooldown Reduction': 'Réduction des temps de recharge', 'Critical Strike Chance': 'Chance de coup critique',
        'Critical Strike Power': 'Puissance des coups critiques', 'DMG': 'Dégâts', 'Damage Reduction': 'Réduction des dégâts',
        'Defense': 'Défense', 'Disable Attack Passive': 'Attaque passive désactivée', 'Disable Crafting': 'Fabrication désactivée',
        'Disable Droping': 'Abandon de l’objet désactivé', 'Disable Enchanting': 'Enchantement désactivé',
        'Disable Interaction': 'Interaction désactivée', 'Disable Repairing': 'Réparation désactivée',
        'Disable Right Click Consume': 'Consommation au clic droit désactivée', 'Disable Smelting': 'Cuisson désactivée',
        'Disable Smithing': 'Forge désactivée', 'Dodge Cooldown Reduction': 'Réduction du temps de recharge d’esquive',
        'Dodge Rating': 'Chance d’esquive', 'Durability Bar': 'Barre de durabilité',
        'Entity Interaction Range': 'Portée d’interaction', 'Faction Damage Dungeon': 'Dégâts contre la faction Donjon',
        'Fall Damage Reduction': 'Réduction des dégâts de chute', 'Heal Bonus': 'Bonus de soin',
        'HEAL BONUS': 'Bonus de soin', 'HEAL_BONUS': 'Bonus de soin', 'Health Regeneration': 'Régénération de vie',
        'Hide Dye': 'Teinture masquée', 'Hide Enchants': 'Enchantements masqués', 'Inedible': 'Non comestible',
        'Item Cooldown': 'Temps de recharge', 'Knockback Resistance': 'Résistance au recul', 'Lifesteal': 'Vol de vie',
        'Magic Damage': 'Dégâts magiques', 'Mana Regeneration': 'Régénération de mana', 'Max Consume': 'Consommation maximale',
        'Max Durability': 'Durabilité maximale', 'Max Health': 'Vie maximale', 'Max Item Damage': 'Dégâts maximum de l’objet',
        'Max Mana': 'Mana maximal', 'Max Stack Size': 'Taille maximale d’une pile', 'Max Stamina': 'Endurance maximale',
        'Movement Speed': 'Vitesse de déplacement', 'Movement_speed': 'Vitesse de déplacement',
        'Physical Damage': 'Dégâts physiques', 'Pickaxe Power': 'Puissance de minage', 'Projectile Damage': 'Dégâts des projectiles',
        'Random Unsocket': 'Retrait aléatoire d’une gemme', 'Range': 'Portée', 'Repair Percent': 'Réparation',
        'Required Defense': 'Défense requise', 'Required Dexterity': 'Dextérité requise', 'Required Esprit': 'Esprit requis',
        'Required Intelligence': 'Intelligence requise', 'Required Strength': 'Force requise', 'Required Vitality': 'Vitalité requise',
        'Restore Food': 'Faim restaurée', 'Restore Health': 'Vie restaurée', 'Restore Mana': 'Mana restauré',
        'Restore Saturation': 'Saturation restaurée', 'Restore Stamina': 'Endurance restaurée',
        'Skill Critical Strike Chance': 'Chance de coup critique des compétences',
        'Skill Critical Strike Power': 'Puissance des coups critiques des compétences', 'Skill Damage': 'Dégâts des compétences',
        'Sneaking Speed': 'Vitesse en déplacement furtif', 'Spell Vampirism': 'Vampirisme des sorts',
        'Stamina Regeneration': 'Régénération d’endurance', 'Weapon Damage': 'Dégâts de l’arme'
    };

    var allItems = [];
    var filtered = [];
    var currentPage = 1;
    var itemsPerPage = 48;
    var totalPages = 1;
    var controller = null;
    var modalReturnFocus = null;
    var previousOverflow = '';
    var sheetInert = new Map();
    var sheetObserver = null;
    var sourceItems = new Set();
    var sourceFiltersReady = false;
    var selectedFilters = { 'it-category': new Set(), 'it-rarity': new Set(), 'it-source': new Set() };
    var tooltipCard = null;
    var tooltipDismissedCard = null;
    var drawerReturnFocus = null;
    var drawerOverflow = '';
    var drawerInert = [];
    var spriteObserver = null;
    var activeQuery = '';

    function normalizeSearch(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').trim();
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
    function statLabel(value) { return Object.prototype.hasOwnProperty.call(STAT_LABELS_FR, value) ? itemUi(STAT_LABELS_FR[value], value) : value; }
    function categoryLabel(value) { var labels = CATEGORY_LABELS[cleanCategory(value)]; return labels ? itemUi(labels[0], labels[1]) : displayName(cleanCategory(value)); }
    function compactPanel() { return window.innerWidth <= 980; }

    function itemPage() { return document.querySelector('.items-page'); }

    function filterValue(item, id) {
        return id === 'it-category' ? item.category : id === 'it-rarity' ? item.rarity : sourceItems.has(item.id) ? 'known' : 'unknown';
    }

    function passesItemFilters(item, exceptField) {
        if (activeQuery && item.searchText.indexOf(activeQuery) === -1 && item.searchCompact.indexOf(activeQuery.replace(/\s+/g, '')) === -1) return false;
        return Object.keys(selectedFilters).every(function (id) {
            if (id === exceptField || (id === 'it-source' && !sourceFiltersReady)) return true;
            var values = selectedFilters[id];
            return !values.size || values.has(filterValue(item, id));
        });
    }

    function syncLegacyFilters() {
        Object.keys(selectedFilters).forEach(function (id) {
            var field = document.getElementById(id);
            if (field) field.value = Array.from(selectedFilters[id])[0] || '';
        });
    }

    function releaseItemSheetIsolation() {
        if (sheetObserver) { sheetObserver.disconnect(); sheetObserver = null; }
        sheetInert.forEach(function (inert, element) { element.inert = inert; });
        sheetInert.clear();
    }

    function syncItemSheetIsolation(modal, active) {
        if (!active) { releaseItemSheetIsolation(); return; }
        // The sheet lives inside its desktop detail slot. Isolate sibling
        // branches at every level, never a parent that contains the sheet.
        var background = new Set(), branch = modal;
        while (branch && branch !== document.body) {
            var parent = branch.parentElement;
            if (!parent) break;
            Array.from(parent.children).forEach(function (element) {
                // Native dialogs already isolate the document while open;
                // explicit inert would prevent Ctrl+K from opening its palette.
                if (element !== branch && element instanceof HTMLElement && !/^(DIALOG|SCRIPT|STYLE|LINK)$/.test(element.tagName)) background.add(element);
            });
            branch = parent;
        }
        sheetInert.forEach(function (inert, element) {
            if (!background.has(element)) { element.inert = inert; sheetInert.delete(element); }
        });
        background.forEach(function (element) {
            if (!sheetInert.has(element)) sheetInert.set(element, element.inert);
            element.inert = true;
        });
        if (!sheetObserver) {
            // Persistent controls such as the audio dock can mount after the
            // catalogue's initial deep link opens its sheet.
            sheetObserver = new MutationObserver(function () { if (controller && !controller.signal.aborted) syncItemPanelMode(); });
            sheetObserver.observe(document.body, { childList: true });
        }
    }

    function syncItemPanelMode() {
        var modal = document.querySelector('.item-modal');
        if (!modal) { if (sheetInert.size) document.body.style.overflow = previousOverflow; releaseItemSheetIsolation(); return; }
        var compact = compactPanel(), wasSheet = modal.dataset.panelMode === 'sheet';
        modal.dataset.panelMode = compact ? 'sheet' : 'rail';
        modal.setAttribute('role', compact ? 'dialog' : 'region');
        if (compact) modal.setAttribute('aria-modal', 'true'); else modal.removeAttribute('aria-modal');
        if (modal.style.display === 'flex') {
            if (compact) { if (!wasSheet) previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
            else if (wasSheet) document.body.style.overflow = previousOverflow;
        }
        syncItemSheetIsolation(modal, compact && modal.style.display === 'flex');
        if (compact && modal.style.display === 'flex' && !modal.contains(document.activeElement) && !document.activeElement.closest?.('dialog[open]')) modal.querySelector('.modal-close')?.focus({ preventScroll: true });
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
        var openGroups = {};
        group.querySelectorAll('.catalogue-filter-section').forEach(function (section) { openGroups[section.dataset.filterGroup] = section.open; section.remove(); });
        group.querySelectorAll('label, select').forEach(function (field) { field.classList.add('catalogue-native-field'); });
        var definitions = [
            ['it-category', 'Catégories', 'Categories', function (item) { return item.category; }],
            ['it-rarity', 'Raretés', 'Rarities', function (item) { return item.rarity; }]
        ];
        if (sourceFiltersReady) definitions.push(['it-source', 'Sources', 'Sources', function (item) { return sourceItems.has(item.id) ? 'known' : 'unknown'; }]);
        definitions.forEach(function (definition) {
            var id = definition[0], select = document.getElementById(id);
            if (!select) return;
            var section = document.createElement('details'); section.className = 'catalogue-filter-section'; section.dataset.filterGroup = id;
            section.open = openGroups[id] !== undefined ? openGroups[id] : id !== 'it-source';
            var title = document.createElement('summary'); title.appendChild(document.createTextNode(itemUi(definition[1], definition[2])));
            var selectedCount = document.createElement('span'); selectedCount.className = 'catalogue-filter-selected-count'; selectedCount.dataset.selectedCount = id; title.appendChild(selectedCount); section.appendChild(title);
            var options = document.createElement('div'); options.className = 'catalogue-filter-options'; section.appendChild(options);
            Array.from(select.options).filter(function (option) { return option.value; }).forEach(function (option) {
                var countValue = allItems.filter(function (item) { return definition[3](item) === option.value; }).length;
                if (!countValue) return;
                var row = document.createElement('label'); row.className = 'catalogue-filter-option';
                var input = document.createElement('input'); input.type = 'checkbox'; input.dataset.filterField = id; input.value = option.value; input.checked = selectedFilters[id].has(option.value);
                var name = document.createElement('span'); name.textContent = id === 'it-category' ? categoryLabel(option.value) : displayName(option.textContent);
                var count = document.createElement('span'); count.className = 'catalogue-filter-result-count'; count.textContent = String(countValue);
                row.append(input, name, count); options.appendChild(row);
            });
            group.appendChild(section);
        });
    }

    function syncFilterChoices() {
        document.querySelectorAll('.items-page [data-filter-field]').forEach(function (input) {
            var id = input.dataset.filterField;
            input.checked = selectedFilters[id].has(input.value);
            var count = allItems.filter(function (item) { return filterValue(item, id) === input.value && passesItemFilters(item, id); }).length;
            input.disabled = !count && !input.checked;
            input.parentElement.classList.toggle('is-unavailable', !count);
            input.parentElement.lastElementChild.textContent = String(count);
        });
        document.querySelectorAll('.items-page .catalogue-filter-section').forEach(function (section) {
            var count = selectedFilters[section.dataset.filterGroup].size;
            var badge = section.querySelector('.catalogue-filter-selected-count');
            badge.textContent = count ? String(count) : ''; badge.hidden = !count;
        });
        var chips = document.getElementById('it-active-filters');
        if (!chips) return;
        chips.replaceChildren();
        ['it-search', 'it-category', 'it-rarity', 'it-source'].forEach(function (id) {
            var field = document.getElementById(id);
            if (!field) return;
            var values = id === 'it-search' ? field.value ? [field.value] : [] : Array.from(selectedFilters[id]);
            values.forEach(function (value) {
                var option = field.tagName === 'SELECT' ? Array.from(field.options).find(function (entry) { return entry.value === value; }) : null;
                var label = id === 'it-category' ? categoryLabel(value) : option ? option.textContent : value;
                var button = document.createElement('button'); button.type = 'button'; button.className = 'catalogue-filter-chip'; button.dataset.clearFilter = id; button.dataset.filterValue = value; button.textContent = displayName(label) + ' ×';
                button.setAttribute('aria-label', itemUi('Retirer le filtre ', 'Remove filter ') + displayName(label)); chips.appendChild(button);
            });
        });
        syncLegacyFilters();
        var active = Object.values(selectedFilters).reduce(function (sum, values) { return sum + values.size; }, 0);
        var toggleCount = document.getElementById('it-filter-toggle-count');
        if (toggleCount) { toggleCount.textContent = active ? String(active) : ''; toggleCount.hidden = !active; }
    }

    function loadSourceFilters() {
        if (!window.NamelessGlobalSearch || typeof window.NamelessGlobalSearch.getIndex !== 'function') return;
        var signal = controller.signal;
        window.NamelessGlobalSearch.getIndex().then(function (entries) {
            if (signal.aborted || !document.querySelector('.items-page')) return;
            sourceItems = new Set(entries.filter(function (entry) { return entry.kind === 'item' && Array.isArray(entry.sources) && entry.sources.some(validBestiarySource); }).map(function (entry) { return entry.id; }));
            sourceFiltersReady = true; setupFilterChoices(); applyFilters();
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

    function applyItemUrl(event) {
        var params = new URLSearchParams(window.location.search);
        var query = params.get('q');
        var search = document.getElementById('it-search');
        if (query !== null && search) search.value = query.slice(0, 200);
        else if (event && search) search.value = '';
        ['category', 'rarity', 'source'].forEach(function (name) {
            var fieldId = 'it-' + name;
            var select = document.getElementById(fieldId);
            var allowed = new Set(Array.from(select ? select.options : []).map(function (option) { return option.value; }).filter(Boolean));
            selectedFilters[fieldId] = new Set(params.getAll(name).filter(function (value) { return allowed.has(value); }));
        });
        applyFilters();
        var id = params.get('item');
        var meta = window.NamelessItemCatalogueMeta;
        var resolved = id && meta && typeof meta.resolveAlias === 'function' ? meta.resolveAlias(id) : id;
        var notice = document.getElementById('it-link-notice');
        if (notice) { notice.hidden = true; notice.textContent = ''; }
        if (resolved && allItems.some(function (item) { return item.id === resolved; })) openItemModal(resolved, false);
        else {
            closeModal(false);
            if (id && notice) {
                var oldName = meta && meta.unmatchedLegacy && Object.prototype.hasOwnProperty.call(meta.unmatchedLegacy, id) && typeof meta.unmatchedLegacy[id] === 'string' ? meta.unmatchedLegacy[id] : null;
                notice.textContent = oldName ? itemUi('Cet ancien lien ne correspond pas à un objet identifié dans le catalogue officiel actuel : ', 'This old link does not identify an item in the current official catalogue: ') + oldName + '.' : itemUi('Cet objet n’est pas présent dans le catalogue officiel importé.', 'This item is not in the imported official catalogue.');
                notice.hidden = false;
                if (oldName && search && query === null) { search.value = oldName; applyFilters(); }
            }
        }
    }

    function cleanCategory(name) {
        // "💍 Accessoires" -> "Accessoires"
        return String(name || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
    }

    function setFilterDrawer(open, restoreFocus) {
        var page = itemPage(), filters = document.querySelector('.items-page .items-filters');
        var toggle = document.getElementById('it-filter-toggle'), close = document.getElementById('it-filter-close');
        if (!page || !filters) {
            if (!open && drawerInert.length) {
                drawerInert.forEach(function (entry) { entry[0].inert = entry[1]; }); drawerInert = [];
                document.body.style.overflow = drawerOverflow; drawerReturnFocus = null;
            }
            return;
        }
        open = !!open && window.innerWidth <= 768;
        var wasOpen = page.classList.contains('catalogue-filters-open');
        page.classList.toggle('catalogue-filters-open', open);
        if (toggle) toggle.setAttribute('aria-expanded', String(open));
        filters.inert = window.innerWidth <= 768 && !open;
        if (open) { filters.setAttribute('role', 'dialog'); filters.setAttribute('aria-modal', 'true'); }
        else { filters.removeAttribute('role'); filters.removeAttribute('aria-modal'); }
        var backdrop = document.querySelector('.items-page .catalogue-filter-backdrop'); if (backdrop) backdrop.hidden = !open;
        if (open && !wasOpen) {
            drawerReturnFocus = document.activeElement; drawerOverflow = document.body.style.overflow;
            drawerInert = [document.querySelector('body > header'), document.querySelector('.items-hero'), document.querySelector('.items-page .catalogue-results'), document.querySelector('body > footer'), document.querySelector('.nm-audio-dock')].filter(Boolean).map(function (element) { var value = element.inert; element.inert = true; return [element, value]; });
            document.body.style.overflow = 'hidden';
            if (close) close.focus();
        } else if (!open && wasOpen) {
            drawerInert.forEach(function (entry) { entry[0].inert = entry[1]; }); drawerInert = [];
            document.body.style.overflow = drawerOverflow;
            if (restoreFocus !== false && drawerReturnFocus && drawerReturnFocus.isConnected) drawerReturnFocus.focus();
            drawerReturnFocus = null;
        }
    }

    function hideItemTooltip() {
        var tooltip = document.getElementById('item-tooltip');
        if (tooltip) tooltip.hidden = true;
        if (tooltipCard) tooltipCard.removeAttribute('aria-describedby');
        tooltipCard = null;
    }

    function positionItemTooltip() {
        var tooltip = document.getElementById('item-tooltip');
        if (!tooltip || tooltip.hidden || !tooltipCard || !tooltipCard.isConnected) return;
        var anchor = tooltipCard.getBoundingClientRect(), box = tooltip.getBoundingClientRect(), margin = 12;
        var width = window.innerWidth, height = window.innerHeight;
        var left = Math.max(margin, Math.min(width - box.width - margin, anchor.left + (anchor.width - box.width) / 2));
        var top = anchor.top - box.height - 9;
        if (top < margin) top = anchor.bottom + 9;
        top = Math.max(margin, Math.min(height - box.height - margin, top));
        tooltip.style.left = Math.round(left) + 'px'; tooltip.style.top = Math.round(top) + 'px';
    }

    function showItemTooltip(card) {
        if (!card || card === tooltipDismissedCard || document.querySelector('.item-modal[style*="flex"]') || itemPage()?.classList.contains('catalogue-filters-open')) return;
        var item = allItems.find(function (entry) { return entry.id === card.dataset.id; }); if (!item) return;
        hideItemTooltip(); tooltipCard = card;
        var tooltip = document.getElementById('item-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div'); tooltip.id = 'item-tooltip'; tooltip.className = 'catalogue-tooltip inventory-tooltip'; tooltip.setAttribute('role', 'tooltip'); document.body.appendChild(tooltip);
        }
        tooltip.replaceChildren();
        var name = document.createElement('strong'), category = document.createElement('span'), rarity = document.createElement('span');
        name.textContent = displayName(item.name); category.textContent = categoryLabel(item.category); rarity.textContent = displayName(rarityMeta(item.rarity, item.rarityLabel).label);
        tooltip.dataset.rarity = item.rarity;
        tooltip.style.removeProperty('--rarity'); tooltip.style.removeProperty('--item-rarity'); applyRarityColor(tooltip, item);
        tooltip.append(name, category, rarity); tooltip.hidden = false; card.setAttribute('aria-describedby', tooltip.id); positionItemTooltip();
    }

    function initItems(root) {
        destroyItems();
        if (typeof itemsCatalog === 'undefined') return;
        if (!document.getElementById('items-grid')) return;
        controller = new AbortController();
        itemsPerPage = parseInt(document.getElementById('items-per-page-select')?.value, 10) || 48;
        loadItems();
        populateCategoryFilter();
        populateRarityFilter();
        updateSnapshotStatus();
        setupFilterChoices();
        setupItemImages();
        setupListeners();
        applyFromBestiaire();   // pré-remplit la recherche si venu d'un drop (validé)
        applyFilters();
        applyItemUrl();
        loadSourceFilters();
        document.addEventListener('nameless:routechange', applyItemUrl, { signal: controller.signal });
        document.addEventListener('nameless:languagechange', function () {
            cacheItemSearch();
            populateCategoryFilter(); populateRarityFilter(); updateSnapshotStatus();
            setupFilterChoices(); applyFilters();
            var modal = document.querySelector('.item-modal');
            if (modal && modal.style.display === 'flex' && modal.dataset.item && !modal.hasAttribute('data-reference-closing')) openItemModal(modal.dataset.item, false, false);
        }, { signal: controller.signal });
    }

    function destroyItems() {
        var sheetWasActive = sheetInert.size > 0;
        releaseItemSheetIsolation();
        setFilterDrawer(false, false);
        hideItemTooltip(); document.getElementById('item-tooltip')?.remove();
        if (controller) { controller.abort(); controller = null; }
        if (spriteObserver) { spriteObserver.disconnect(); spriteObserver = null; }
        var modal = document.querySelector('.item-modal');
        if (modal) window.NamelessReferenceShell?.cancelPanelClose?.(modal);
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        if (sheetWasActive || (modal && modal.dataset.panelMode === 'sheet' && modal.style.display === 'flex')) document.body.style.overflow = previousOverflow;
        modalReturnFocus = null;
        allItems = [];
        filtered = [];
        currentPage = 1;
        totalPages = 1;
        sourceItems = new Set(); sourceFiltersReady = false;
        selectedFilters = { 'it-category': new Set(), 'it-rarity': new Set(), 'it-source': new Set() };
        tooltipDismissedCard = null;
        itemPage()?.classList.remove('catalogue-has-selection');
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
                    rarity: item.rarity || 'unrecorded',
                    rarityLabel: item.rarityLabel || null,
                    rarityColor: typeof item.rarityColor === 'string' && /^#[0-9a-f]{6}$/i.test(item.rarityColor) ? item.rarityColor : null,
                    category: group.name,
                    categoryLabel: cleanCategory(group.name),
                    description: typeof item.description === 'string' ? item.description : '',
                    level: typeof item.level === 'number' && Number.isFinite(item.level) ? item.level : null,
                    stats: Array.isArray(item.stats) ? item.stats.filter(function (stat) { return stat && typeof stat.label === 'string' && ['string', 'number', 'boolean'].includes(typeof stat.value); }) : [],
                    requiredClass: typeof item.requiredClass === 'string' ? item.requiredClass : null,
                    sourceUrl: officialUrl(item.sourceUrl),
                    sourceId: item.sourceId || '',
                    image: item.image ? '/assets/items/' + item.image + '?v=20261014official1' : FALLBACK_IMG,
                    imageAvailable: !!item.image
                });
            });
        });
        cacheItemSearch();
        filtered = allItems.slice();
    }

    function cacheItemSearch() {
        allItems.forEach(function (item) {
            var labels = CATEGORY_LABELS[cleanCategory(item.category)] || [];
            var translation = window.NamelessTranslations && window.NamelessTranslations.en && window.NamelessTranslations.en[item.name];
            item.searchText = normalizeSearch([item.name, typeof translation === 'string' ? translation : '', item.category, labels.join(' '), item.description, item.sourceId].join(' '));
            item.searchCompact = item.searchText.replace(/\s+/g, '');
        });
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
                opt.textContent = categoryLabel(i.category);
                select.appendChild(opt);
            }
        });
    }

    function officialUrl(value) {
        if (typeof value !== 'string') return null;
        try { var url = new URL(value); return url.origin === 'https://saominecraft.com' && /^\/(fr|us|es)\/wiki\/?$/.test(url.pathname) ? url.href : null; } catch (_) { return null; }
    }

    function officialRarities() {
        var published = window.NamelessItemCatalogueMeta && window.NamelessItemCatalogueMeta.snapshot && window.NamelessItemCatalogueMeta.snapshot.rarities;
        return Array.isArray(published) && published.length ? published.map(function (rarity) { return typeof rarity === 'string' ? rarity : rarity.slug; }).filter(Boolean) : ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'godlike', 'splus', 'splusplus', 'unrecorded'];
    }

    function populateRarityFilter() {
        var select = document.getElementById('it-rarity'); if (!select) return;
        while (select.options.length > 1) select.remove(1);
        var keys = officialRarities();
        allItems.forEach(function (item) { if (!keys.includes(item.rarity)) keys.push(item.rarity); });
        keys.forEach(function (key) {
            var sample = allItems.find(function (item) { return item.rarity === key; }); if (!sample) return;
            var option = document.createElement('option'); option.value = key; option.textContent = displayName(rarityMeta(key, sample.rarityLabel).label); select.appendChild(option);
        });
    }

    function updateSnapshotStatus() {
        var element = document.getElementById('it-snapshot-status'); if (!element) return;
        var meta = window.NamelessItemCatalogueMeta;
        element.replaceChildren(); element.hidden = !meta;
        if (!meta) return;
        var url = officialUrl(meta.sourceUrl);
        var label = document.createElement(url ? 'a' : 'span'); label.textContent = itemUi('Catalogue officiel SAO Minecraft', 'Official SAO Minecraft catalogue');
        if (url) { label.href = url; label.target = '_blank'; label.rel = 'noopener noreferrer'; }
        element.appendChild(label);
        var date = new Date(meta.fetchedAt);
        if (Number.isFinite(date.getTime())) { var time = document.createElement('time'); time.dateTime = date.toISOString(); time.textContent = itemUi('Import du ', 'Imported on ') + date.toLocaleDateString(currentLocale(), {timeZone:'Europe/Paris'}); element.appendChild(time); }
    }

    function sizePixelArtImage(img) {
        var media = img.parentElement;
        if (!media || !img.naturalWidth || !img.naturalHeight) return;
        // Agrandissement entier uniquement : ni lissage, ni détourage à la volée.
        // 24px de marge totale laisse les sprites de 49px atteindre 2x dans
        // les supports compacts ; les fiches peuvent les présenter à 3x.
        var gutter = Number.parseFloat(window.getComputedStyle(media).getPropertyValue('--item-sprite-gutter'));
        if (!Number.isFinite(gutter)) gutter = 24;
        var scale = Math.max(1, Math.min(3, Math.floor(Math.min(
            (media.clientWidth - gutter) / img.naturalWidth,
            (media.clientHeight - gutter) / img.naturalHeight
        ))));
        img.dataset.pixelScale = String(scale);
        img.style.setProperty('--item-image-width', img.naturalWidth * scale + 'px');
        img.style.setProperty('--item-image-height', img.naturalHeight * scale + 'px');
    }

    function setupItemImages() {
        // Les petits sprites gardent leur silhouette et des pixels entiers.
        // Les autres illustrations conservent le cadrage contain de la carte.
        document.addEventListener('load', function (e) {
            var t = e.target;
            if (!t || t.tagName !== 'IMG' || !t.dataset || t.dataset.fallback !== 'item' || t.dataset.fbApplied || t.getAttribute('src') === FALLBACK_IMG) return;
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
                delete t.dataset.pixelScale;
                t.src = FALLBACK_IMG;
                t.classList.add('is-fallback');
            }
        }, { capture: true, signal: controller.signal });
        window.addEventListener('resize', function () {
            document.querySelectorAll('.item-image.is-pixel-art, .item-modal-media img.is-pixel-art, .item-related-image.is-pixel-art').forEach(sizePixelArtImage);
        }, { signal: controller.signal });
        if (typeof window.ResizeObserver === 'function') {
            spriteObserver = new window.ResizeObserver(function () {
                document.querySelectorAll('.item-image.is-pixel-art, .item-modal-media img.is-pixel-art, .item-related-image.is-pixel-art').forEach(sizePixelArtImage);
            });
            var grid = document.getElementById('items-grid'); if (grid) spriteObserver.observe(grid);
        }
    }

    function setupListeners() {
        var opts = { signal: controller.signal };
        document.addEventListener('close', function (event) {
            if (event.target.tagName !== 'DIALOG' || document.querySelector('dialog[open]')) return;
            var modal = document.querySelector('.item-modal');
            // A locale rebuild can replace the native palette's old opener.
            // Keep the underlying sheet focused when that palette closes.
            if (modal && modal.style.display === 'flex' && compactPanel() && !modal.contains(document.activeElement)) modal.querySelector('.modal-close')?.focus({ preventScroll: true });
        }, { capture: true, signal: controller.signal });

        var search = document.getElementById('it-search');
        if (search) search.addEventListener('input', applyFilters, opts);
        var choices = document.querySelector('.items-page .items-filter-group');
        if (choices) choices.addEventListener('change', function (event) {
            var input = event.target.closest('[data-filter-field]'); if (!input) return;
            var values = selectedFilters[input.dataset.filterField];
            if (input.checked) values.add(input.value); else values.delete(input.value);
            applyFilters();
        }, opts);
        var chips = document.getElementById('it-active-filters');
        if (chips) chips.addEventListener('click', function (event) {
            var button = event.target.closest('[data-clear-filter]'); if (!button) return;
            var field = document.getElementById(button.dataset.clearFilter);
            if (field) {
                if (selectedFilters[field.id]) selectedFilters[field.id].delete(button.dataset.filterValue); else field.value = '';
                applyFilters();
            }
        }, opts);
        var view = document.querySelector('.items-page .catalogue-view');
        if (view) view.addEventListener('click', function (event) {
            var button = event.target.closest('[data-catalog-view]'); if (!button) return;
            document.getElementById('items-grid').dataset.view = button.dataset.catalogView;
            view.querySelectorAll('button').forEach(function (control) { control.setAttribute('aria-pressed', String(control === button)); });
        }, opts);
        var cat = document.getElementById('it-category');
        function legacyFilter(event) { selectedFilters[event.target.id] = new Set(event.target.value ? [event.target.value] : []); applyFilters(); }
        if (cat) cat.addEventListener('change', legacyFilter, opts);
        var rar = document.getElementById('it-rarity');
        if (rar) rar.addEventListener('change', legacyFilter, opts);
        var source = document.getElementById('it-source'); if (source) source.addEventListener('change', legacyFilter, opts);
        var sort = document.getElementById('it-sort');
        if (sort) sort.addEventListener('change', applyFilters, opts);
        var reset = document.getElementById('it-reset');
        if (reset) reset.addEventListener('click', function () {
            if (search) search.value = '';
            if (cat) cat.value = '';
            if (rar) rar.value = '';
            if (source) source.value = '';
            Object.keys(selectedFilters).forEach(function (id) { selectedFilters[id].clear(); });
            if (sort) sort.value = 'catalogue';
            var url = new URL(window.location.href); ['q', 'category', 'rarity', 'source'].forEach(function (key) { url.searchParams.delete(key); }); history.replaceState(history.state, '', url.href);
            applyFilters();
        }, opts);
        var filterDetails = document.getElementById('it-filter-details');
        var compactFilters = window.innerWidth <= 768;
        if (filterDetails) filterDetails.open = !compactFilters;
        setFilterDrawer(false, false);
        document.getElementById('it-filter-toggle')?.addEventListener('click', function () { if (filterDetails) filterDetails.open = true; hideItemTooltip(); setFilterDrawer(true); }, opts);
        document.getElementById('it-filter-close')?.addEventListener('click', function () { setFilterDrawer(false); }, opts);
        document.querySelector('.items-page .catalogue-filter-backdrop')?.addEventListener('click', function () { setFilterDrawer(false); }, opts);
        window.addEventListener('resize', function () {
            // Restore the old filter baseline before its responsive controller
            // updates it, then capture the new baseline if this stays a sheet.
            releaseItemSheetIsolation();
            var compact = window.innerWidth <= 768;
            if (filterDetails && compact !== compactFilters) { filterDetails.open = !compact; compactFilters = compact; }
            if (!compact) setFilterDrawer(false);
            else if (!itemPage()?.classList.contains('catalogue-filters-open')) setFilterDrawer(false, false);
            hideItemTooltip();
            syncItemPanelMode();
        }, opts);

        var grid = document.getElementById('items-grid');
        if (grid) {
            grid.addEventListener('pointerover', function (event) {
                if (event.pointerType === 'touch') return;
                var card = event.target.closest('.item-card[data-id]');
                if (card && !card.contains(event.relatedTarget)) { tooltipDismissedCard = null; showItemTooltip(card); }
            }, opts);
            grid.addEventListener('pointerout', function (event) {
                var card = event.target.closest('.item-card[data-id]');
                if (card && !card.contains(event.relatedTarget)) { tooltipDismissedCard = null; if (document.activeElement !== card) hideItemTooltip(); }
            }, opts);
            grid.addEventListener('focusin', function (event) { showItemTooltip(event.target.closest('.item-card[data-id]')); }, opts);
            grid.addEventListener('focusout', function (event) { var card = event.target.closest('.item-card[data-id]'); if (card && !card.contains(event.relatedTarget)) { tooltipDismissedCard = null; hideItemTooltip(); } }, opts);
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
        window.addEventListener('scroll', hideItemTooltip, { capture: true, signal: controller.signal });

        var prev = document.getElementById('items-prev-page');
        if (prev) prev.addEventListener('click', function () { if (currentPage > 1) { currentPage--; render(); scrollTop(); } }, opts);
        var next = document.getElementById('items-next-page');
        if (next) next.addEventListener('click', function () { if (currentPage < totalPages) { currentPage++; render(); scrollTop(); } }, opts);
        var ipp = document.getElementById('items-per-page-select');
        if (ipp) ipp.addEventListener('change', function (e) { itemsPerPage = parseInt(e.target.value, 10) || 48; currentPage = 1; render(); }, opts);
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
            if (itemPage()?.classList.contains('catalogue-filters-open')) {
                if (e.key === 'Escape') { e.preventDefault(); setFilterDrawer(false); return; }
                if (e.key === 'Tab') {
                    var drawer = document.querySelector('.items-page .items-filters');
                    var fields = Array.from(drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), summary, select')).filter(function (field) { return !field.closest('[hidden]') && !field.classList.contains('catalogue-native-field') && !Array.from(drawer.querySelectorAll('details:not([open])')).some(function (details) { return details.contains(field) && field !== details.querySelector('summary'); }); });
                    var start = fields[0], end = fields[fields.length - 1];
                    if (e.shiftKey && (document.activeElement === start || !drawer.contains(document.activeElement))) { e.preventDefault(); end?.focus(); }
                    else if (!e.shiftKey && (document.activeElement === end || !drawer.contains(document.activeElement))) { e.preventDefault(); start?.focus(); }
                }
                return;
            }
            var tooltip = document.getElementById('item-tooltip');
            if (e.key === 'Escape' && tooltip && !tooltip.hidden) { e.preventDefault(); tooltipDismissedCard = tooltipCard; hideItemTooltip(); return; }
            var modal = document.querySelector('.item-modal');
            if (!modal || modal.style.display === 'none') return;
            if (e.key === 'Escape' && (compactPanel() || modal.contains(e.target))) { e.preventDefault(); closeModal(); }
            if (e.key === 'Tab' && compactPanel()) {
                var controls = Array.from(modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')).filter(function (control) { return !control.disabled && control.type !== 'hidden' && !control.closest('[hidden]') && control.tabIndex >= 0 && (typeof control.checkVisibility !== 'function' || control.checkVisibility()); });
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
        activeQuery = normalizeSearch(document.getElementById('it-search')?.value || '');
        filtered = allItems.filter(function (item) { return passesItemFilters(item); });
        var sort = document.getElementById('it-sort') && document.getElementById('it-sort').value || 'catalogue';
        var byName = function (a, b) { return displayName(a.name).localeCompare(displayName(b.name), currentLocale(), { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id); };
        var rarityOrder = {}; officialRarities().forEach(function (key, index) { rarityOrder[key] = index; });
        var rarityRank = function (item) { return Object.prototype.hasOwnProperty.call(rarityOrder, item.rarity) ? rarityOrder[item.rarity] : Number.MAX_SAFE_INTEGER; };
        var compareRarity = function (a, b, descending) {
            var unknownA = a.rarity === 'unrecorded' || rarityRank(a) === Number.MAX_SAFE_INTEGER;
            var unknownB = b.rarity === 'unrecorded' || rarityRank(b) === Number.MAX_SAFE_INTEGER;
            if (unknownA || unknownB) return unknownA === unknownB ? byName(a, b) : unknownA ? 1 : -1;
            return (descending ? rarityRank(b) - rarityRank(a) : rarityRank(a) - rarityRank(b)) || byName(a, b);
        };
        if (sort === 'name-asc') filtered.sort(byName);
        else if (sort === 'name-desc') filtered.sort(function (a, b) { return -byName(a, b); });
        else if (sort === 'rarity-asc') filtered.sort(function (a, b) { return compareRarity(a, b, false); });
        else if (sort === 'rarity-desc') filtered.sort(function (a, b) { return compareRarity(a, b, true); });
        else if (sort === 'category') filtered.sort(function (a, b) { return categoryLabel(a.category).localeCompare(categoryLabel(b.category), currentLocale()) || byName(a, b); });
        else if (sort === 'level-asc' || sort === 'level-desc') filtered.sort(function (a, b) {
            if (a.level === null || b.level === null) return a.level === b.level ? byName(a, b) : a.level === null ? 1 : -1;
            return (sort === 'level-asc' ? a.level - b.level : b.level - a.level) || byName(a, b);
        });
        currentPage = 1;
        syncFilterChoices();
        render();
    }

    function render() {
        var grid = document.getElementById('items-grid');
        if (!grid) return;
        hideItemTooltip();
        grid.innerHTML = '';

        totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;

        var count = document.getElementById('it-count');
        if (count) count.textContent = filtered.length + itemUi(' objet' + (filtered.length > 1 ? 's trouvés' : ' trouvé'), ' item' + (filtered.length > 1 ? 's found' : ' found'));

        if (filtered.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'items-empty';
            var h = document.createElement('h3'); h.textContent = itemUi('Aucun objet trouvé', 'No items found');
            var p = document.createElement('p'); p.textContent = itemUi('Modifiez votre recherche ou vos filtres.', 'Adjust your search or filters.');
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

    function rarityMeta(r, sourceLabel) { return Object.prototype.hasOwnProperty.call(RARITY, r) ? RARITY[r] : { label: sourceLabel || itemUi('Non renseignée', 'Not recorded'), cls: 'r-unrecorded' }; }
    function applyRarityColor(element, item) {
        if (!item.rarityColor) return;
        element.style.setProperty('--rarity', item.rarityColor);
        element.style.setProperty('--item-rarity', item.rarityColor);
    }

    function buildCard(item) {
        var meta = rarityMeta(item.rarity, item.rarityLabel);
        var card = document.createElement('article');
        card.className = 'item-card ' + meta.cls;
        applyRarityColor(card, item);
        var modal = document.querySelector('.item-modal');
        if (modal && modal.style.display === 'flex' && modal.dataset.item === item.id && !modal.hasAttribute('data-reference-closing')) card.classList.add('is-selected');
        card.dataset.id = item.id;
        card.dataset.rarity = item.rarity;
        card.dataset.selectedLabel = itemUi('Sélectionné', 'Selected');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', itemUi('Voir ', 'View ') + displayName(item.name));
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
        if (!item.imageAvailable) { var missing = document.createElement('span'); missing.className = 'item-image-unavailable'; missing.textContent = itemUi('Aperçu indisponible', 'Preview unavailable'); media.appendChild(missing); }
        var badge = document.createElement('span');
        badge.className = 'item-rarity-badge ' + meta.cls;
        badge.textContent = displayName(meta.label);
        card.appendChild(media);

        var body = document.createElement('div');
        body.className = 'item-body';
        var name = document.createElement('h2');
        name.className = 'item-name';
        name.textContent = displayName(item.name);
        body.appendChild(name);
        var cardMeta = document.createElement('div');
        cardMeta.className = 'item-card-meta';
        var catChip = document.createElement('span');
        catChip.className = 'item-cat';
        catChip.textContent = categoryLabel(item.category);
        cardMeta.append(catChip, badge);
        if (item.level !== null) { var level = document.createElement('span'); level.className = 'item-level'; level.textContent = itemUi('Niv. ', 'Lv. ') + item.level; cardMeta.appendChild(level); }
        body.appendChild(cardMeta);
        card.appendChild(body);
        return card;
    }

    function openItemModal(id, updateUrl, moveFocus = true) {
        var item = allItems.filter(function (i) { return i.id === id; })[0];
        if (!item) return;
        hideItemTooltip();
        setFilterDrawer(false, false);
        itemPage()?.classList.add('catalogue-has-selection');
        var meta = rarityMeta(item.rarity, item.rarityLabel);

        var modal = document.querySelector('.item-modal');
        if (!modal) { modal = document.createElement('div'); modal.className = 'item-modal'; modal.id = 'item-dialog'; (document.querySelector('.items-page .catalogue-detail-slot') || document.body).appendChild(modal); }
        window.NamelessReferenceShell?.cancelPanelClose(modal);
        var hadPanelFocus = modal.contains(document.activeElement);
        if (modal.style.display !== 'flex') { modalReturnFocus = document.activeElement; previousOverflow = document.body.style.overflow; }
        if (moveFocus && !hadPanelFocus) modalReturnFocus = document.activeElement;
        modal.setAttribute('aria-labelledby', 'item-dialog-title');
        modal.dataset.item = id;
        modal.dataset.rarity = item.rarity;
        modal.style.removeProperty('--rarity'); modal.style.removeProperty('--item-rarity'); applyRarityColor(modal, item);
        modal.innerHTML = '';

        var content = document.createElement('div');
        content.className = 'modal-content';

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'modal-close';
        close.setAttribute('aria-label', itemUi('Fermer la fiche', 'Close details'));
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
        h2.textContent = displayName(item.name);
        info.appendChild(h2);

        var badges = document.createElement('div');
        badges.className = 'item-modal-badges';
        var rb = document.createElement('span');
        rb.className = 'item-chip ' + meta.cls;
        rb.textContent = displayName(meta.label);
        badges.appendChild(rb);
        var cb = document.createElement('span');
        cb.className = 'item-chip chip-cat';
        cb.textContent = categoryLabel(item.category);
        badges.appendChild(cb);
        if (item.level !== null) { var lb = document.createElement('span'); lb.className = 'item-chip'; lb.textContent = itemUi('Niveau ', 'Level ') + item.level; badges.appendChild(lb); }
        info.appendChild(badges);
        var overview = document.createElement('div'); overview.className = 'item-overview';
        var description = document.createElement('p'); description.className = 'item-detail-description';
        description.textContent = item.description ? displayName(item.description) : itemUi('Aucune description renseignée.', 'No description recorded.'); overview.appendChild(description);
        var facts = document.createElement('section'); facts.className = 'item-verified-facts';
        var factsTitle = document.createElement('h3'); factsTitle.textContent = itemUi('Informations du catalogue', 'Catalogue information'); facts.appendChild(factsTitle);
        var properties = document.createElement('dl');
        var recordedFacts = [[itemUi('Catégorie', 'Category'), categoryLabel(item.category)], [itemUi('Rareté', 'Rarity'), displayName(meta.label)]];
        if (item.level !== null) recordedFacts.push([itemUi('Niveau requis', 'Required level'), String(item.level)]);
        if (item.requiredClass) recordedFacts.push([itemUi('Classe requise', 'Required class'), item.requiredClass]);
        recordedFacts.forEach(function (value) { var term = document.createElement('dt'), detail = document.createElement('dd'); term.textContent = value[0]; detail.textContent = value[1]; properties.append(term, detail); });
        facts.appendChild(properties); overview.appendChild(facts);
        if (item.stats.length) {
            var characteristics = document.createElement('section'); characteristics.className = 'item-official-stats';
            var statsTitle = document.createElement('h3'); statsTitle.textContent = itemUi('Caractéristiques', 'Characteristics'); characteristics.appendChild(statsTitle);
            var statList = document.createElement('dl');
            item.stats.forEach(function (stat) { var term = document.createElement('dt'), detail = document.createElement('dd'); term.dataset.sourceLabel = stat.label; term.textContent = statLabel(stat.label); detail.textContent = String(stat.value); statList.append(term, detail); });
            characteristics.appendChild(statList); overview.appendChild(characteristics);
        }
        if (item.sourceUrl) {
            var official = document.createElement('a'); official.className = 'item-official-source'; official.href = item.sourceUrl; official.target = '_blank'; official.rel = 'noopener noreferrer'; official.textContent = itemUi('Consulter la source officielle ↗', 'View the official source ↗'); overview.appendChild(official);
        }

        var sources = document.createElement('section'); sources.className = 'item-sources';
        var sourcesTitle = document.createElement('h3'); sourcesTitle.textContent = itemUi('Sources d’obtention', 'Known sources'); sources.appendChild(sourcesTitle);
        var sourceStatus = document.createElement('p'); sourceStatus.textContent = itemUi('Sources non renseignées.', 'Sources not recorded.'); sources.appendChild(sourceStatus);
        var sourceNote = document.createElement('p'); sourceNote.className = 'item-source-provenance'; sourceNote.hidden = true; sources.appendChild(sourceNote);
        content.appendChild(info);
        var detailTabs = installItemDetailTabs(content, id, sources, overview);
        var share = document.createElement('div'); share.className = 'item-share catalogue-detail-actions';
        var shareButton = document.createElement('button'); shareButton.type = 'button'; shareButton.className = 'item-share-button catalogue-share'; shareButton.textContent = itemUi('Copier le lien de la fiche', 'Copy link to details');
        var shareInput = document.createElement('input'); shareInput.className = 'catalogue-share-url'; shareInput.type = 'url'; shareInput.readOnly = true; shareInput.hidden = true; shareInput.setAttribute('aria-label', itemUi('Lien de la fiche', 'Link to details'));
        var shareStatus = document.createElement('span'); shareStatus.className = 'item-share-status catalogue-share-status'; shareStatus.setAttribute('role', 'status');
        shareButton.addEventListener('click', async function () {
            var url = new URL('/items', window.location.origin); url.searchParams.set('item', id); shareInput.value = url.href;
            try { if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(url.href); if (shareStatus.isConnected) shareStatus.textContent = itemUi('Lien copié.', 'Link copied.'); }
            catch (_) { if (!shareInput.isConnected) return; shareInput.hidden = false; shareInput.focus(); shareInput.select(); shareStatus.textContent = itemUi('Copiez le lien sélectionné.', 'Copy the selected link.'); }
        }, { signal: controller.signal });
        share.append(shareButton, shareInput, shareStatus); content.appendChild(share);

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
                var knownSources = entry && Array.isArray(entry.sources) ? entry.sources.filter(validBestiarySource) : [];
                sourceStatus.textContent = knownSources.length ? '' : itemUi('Aucune source renseignée dans le bestiaire.', 'No sources recorded in the bestiary.');
                if (knownSources.some(function (source) { return source.provenance === 'nameless-bestiary' && source.verification === 'not-revalidated-against-official-export'; })) {
                    sourceNote.hidden = false;
                    sourceNote.textContent = itemUi('Sources renseignées par Nameless, à confirmer sur le serveur actuel.', 'Sources recorded by Nameless; confirm them on the current server.');
                }
                if (!knownSources.length) return;
                var list = document.createElement('ul');
                knownSources.forEach(function (source) {
                    if (!source || typeof source.url !== 'string' || typeof source.title !== 'string') return;
                    var url;
                    try { url = new URL(source.url, window.location.origin); } catch (error) { return; }
                    if (url.origin !== window.location.origin || url.pathname !== '/bestiaire' || !/^\d+$/.test(url.searchParams.get('creature') || '')) return;
                    var row = document.createElement('li'); row.className = 'item-source-row';
                    var link = document.createElement('a'); link.className = 'item-source-creature';
                    link.href = url.pathname + url.search;
                    var creature = entries.find(function (candidate) { return (candidate.kind === 'creature' || candidate.kind === 'boss') && String(candidate.id) === url.searchParams.get('creature'); });
                    if (creature && typeof creature.image === 'string') {
                        var nativeImage;
                        try { nativeImage = new URL(creature.image, window.location.origin); } catch (_) { nativeImage = null; }
                        if (nativeImage && nativeImage.origin === window.location.origin && nativeImage.pathname.startsWith('/assets/mobs/')) {
                            var portrait = document.createElement('img'); portrait.className = 'item-source-portrait'; portrait.src = nativeImage.pathname + nativeImage.search; portrait.alt = ''; portrait.loading = 'lazy'; portrait.width = 42; portrait.height = 42; link.appendChild(portrait);
                        }
                    }
                    var sourceLabel = document.createElement('span'); sourceLabel.className = 'item-source-label';
                    var sourceName = document.createElement('strong'); sourceName.textContent = displayName(source.title); sourceLabel.appendChild(sourceName);
                    if (/^[1-3]$/.test(String(source.floor))) { var floorLabel = document.createElement('small'); floorLabel.textContent = itemUi('Palier ', 'Floor ') + source.floor; sourceLabel.appendChild(floorLabel); }
                    link.appendChild(sourceLabel);
                    row.appendChild(link);
                    if (typeof source.location === 'string' && source.location.trim()) {
                        var zone = document.createElement('span'); zone.className = 'item-source-zone';
                        var location = entries.find(function (candidate) {
                            if (candidate.kind !== 'location' || candidate.title !== source.location || typeof candidate.url !== 'string') return false;
                            try { var target = new URL(candidate.url, window.location.origin); return target.origin === window.location.origin && target.pathname === '/carte' && target.searchParams.get('floor') === String(source.floor) && (target.searchParams.get('entity') || '').startsWith('location:' + source.floor + ':'); } catch (_) { return false; }
                        });
                        if (location) { var regionLink = document.createElement('a'); regionLink.className = 'item-source-region-link'; var regionUrl = new URL(location.url, window.location.origin); regionLink.href = regionUrl.pathname + regionUrl.search; regionLink.textContent = displayName(source.location); zone.appendChild(regionLink); }
                        else zone.textContent = displayName(source.location);
                        row.appendChild(zone);
                    }
                    if (typeof source.mapUrl === 'string') {
                        var mapUrl;
                        try { mapUrl = new URL(source.mapUrl, window.location.origin); } catch (error) { mapUrl = null; }
                        if (mapUrl && mapUrl.origin === window.location.origin && mapUrl.pathname === '/carte'
                            && mapUrl.searchParams.get('entity') === 'creature:' + url.searchParams.get('creature')
                            && /^[1-3]$/.test(String(source.floor)) && mapUrl.searchParams.get('floor') === String(source.floor)) {
                            var mapLink = document.createElement('a'); mapLink.className = 'item-source-map-link';
                            mapLink.href = mapUrl.pathname + mapUrl.search; mapLink.setAttribute('aria-label', itemUi('Voir sur la carte : ', 'View on map: ') + displayName(source.title)); mapLink.title = itemUi('Voir sur la carte', 'View on map');
                            var mapIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); mapIcon.setAttribute('viewBox', '0 0 24 24'); mapIcon.setAttribute('aria-hidden', 'true');
                            var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '6');
                            var cross = document.createElementNS('http://www.w3.org/2000/svg', 'path'); cross.setAttribute('d', 'M12 2v5m0 10v5M2 12h5m10 0h5'); mapIcon.append(circle, cross); mapLink.appendChild(mapIcon); row.appendChild(mapLink);
                        }
                    }
                    list.appendChild(row);
                });
                if (list.children.length) { sourceStatus.remove(); sources.appendChild(list); }
                else sourceStatus.textContent = itemUi('Aucune source renseignée dans le bestiaire.', 'No sources recorded in the bestiary.');
                var sourceUrls = new Set(knownSources.filter(validBestiarySource).map(function (source) { return source.url; }));
                var related = entries.filter(function (candidate) {
                    return candidate.kind === 'item' && candidate.id !== id && allItems.some(function (record) { return record.id === candidate.id; }) && Array.isArray(candidate.sources) && candidate.sources.some(function (source) { return validBestiarySource(source) && sourceUrls.has(source.url); });
                });
                if (related.length) detailTabs.related(related.slice(0, 6));
            }).catch(function () { if (currentSources()) sourceStatus.textContent = itemUi('Sources temporairement indisponibles.', 'Sources temporarily unavailable.'); });
        }

        modal.appendChild(content);
        modal.style.display = 'flex';
        syncItemPanelMode();
        if (spriteObserver) spriteObserver.observe(media);
        if (updateUrl !== false) updateItemUrl(id);
        if ((moveFocus || hadPanelFocus) && !document.activeElement.closest?.('dialog[open]')) close.focus();
    }

    function installItemDetailTabs(content, id, sources, overview) {
        var bar = document.createElement('div'); bar.className = 'catalogue-detail-tabs'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', itemUi('Détails de l’objet', 'Item details'));
        var panels = new Map(), buttons = new Map();
        content.appendChild(bar);
        function addTab(key, fr, en) {
            var button = document.createElement('button'); button.type = 'button'; button.id = 'it-tab-' + id + '-' + key; button.dataset.detailTab = key; button.setAttribute('role', 'tab'); button.textContent = itemUi(fr, en); bar.appendChild(button); buttons.set(key, button);
            var panel = document.createElement('section'); panel.id = 'it-panel-' + id + '-' + key; panel.dataset.catalogueTabPanel = key; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id); button.setAttribute('aria-controls', panel.id); panels.set(key, panel); content.appendChild(panel); panel.hidden = key !== 'overview'; button.setAttribute('aria-selected', String(key === 'overview')); button.tabIndex = key === 'overview' ? 0 : -1;
            return panel;
        }
        addTab('overview', 'Aperçu', 'Overview'); addTab('sources', 'Sources', 'Sources');
        panels.get('overview').appendChild(overview);
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
                var link = document.createElement('a'); link.className = 'catalogue-related-item'; link.dataset.rarity = item.rarity; link.href = '/items?item=' + encodeURIComponent(item.id);
                var sprite = document.createElement('span'); sprite.className = 'item-related-sprite';
                var image = document.createElement('img'); image.className = 'item-related-image'; image.src = item.image; image.alt = ''; image.dataset.fallback = 'item'; sprite.appendChild(image);
                var label = document.createElement('span'); label.className = 'item-related-label';
                var name = document.createElement('strong'); name.textContent = displayName(item.name);
                var category = document.createElement('small'); category.textContent = categoryLabel(item.category); label.append(name, category); link.append(sprite, label); list.appendChild(link);
            }); panel.appendChild(list);
        } };
    }

    function closeModal(updateUrl) {
        var modal = document.querySelector('.item-modal');
        if (modal && modal.style.display !== 'none') {
            var finish = function () {
                releaseItemSheetIsolation();
                modal.style.display = 'none'; if (modal.dataset.panelMode === 'sheet') document.body.style.overflow = previousOverflow;
                delete modal.dataset.item;
                itemPage()?.classList.remove('catalogue-has-selection');
                if (modalReturnFocus && modalReturnFocus.isConnected) { tooltipDismissedCard = modalReturnFocus; modalReturnFocus.focus(); }
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
                info.textContent = itemUi('Affichage de ', 'Showing ') + s + '–' + e + itemUi(' sur ', ' of ') + total + itemUi(' objets', ' items');
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
