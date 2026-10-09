/* Aincrad map: the generated graph is the only public entity catalogue. */
(function (global) {
    'use strict';
    const FLOOR_CACHE = new Map();
    let catalogPromise = null;
    let active = null;
    let adminScriptPromise = null;
    let lastGoodOverrides = null;
    const TYPE_LABELS = {
        town: ['Villes', 'Towns'], dungeon: ['Donjons', 'Dungeons'], zone: ['Zones', 'Zones'],
        merchant: ['Marchands', 'Merchants'], 'quest-primary': ['Quêtes principales', 'Main quests'],
        'quest-secondary': ['Secondaires (archives)', 'Side quests (archives)'], npc: ['PNJ', 'NPCs'],
        teleporter: ['Téléporteurs', 'Teleporters'], boss: ['Boss', 'Bosses'], creature: ['Créatures', 'Creatures']
    };
    const KIND_LABELS = { location: ['Lieu', 'Location'], quest: ['Quête', 'Quest'], guide: ['Guide', 'Guide'], npc: ['PNJ', 'NPC'], creature: ['Créature', 'Creature'], item: ['Ressource', 'Resource'] };
    const GLYPHS = {
        town: '<path d="M3 19V9l4-4 4 4v10M13 19V5h6v14M6 19v-5h3M15 9h2M15 13h2M2 19h20"/>',
        dungeon: '<path d="M4 20V9l8-5 8 5v11M9 20v-7a3 3 0 0 1 6 0v7M3 20h18"/>',
        zone: '<path d="m3 17 5-9 4 6 4-10 5 13H3ZM7 20h10"/>',
        merchant: '<path d="M4 8h16l-2 5H6L4 8ZM7 13v7h10v-7M7 8V5h10v3M10 17h4"/>',
        'quest-primary': '<path d="M7 3h10v18l-5-3-5 3V3ZM12 7v5M12 15h.01"/>',
        'quest-secondary': '<path d="M7 3h10v18l-5-3-5 3V3ZM10 8h4M10 12h4"/>',
        npc: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
        teleporter: '<circle cx="12" cy="12" r="8"/><path d="m9 7 6 5-6 5M6 12h9"/>',
        boss: '<path d="m4 6 4 3 4-5 4 5 4-3-2 13H6L4 6ZM9 14h.01M15 14h.01M9 17h6"/>',
        creature: '<path d="m5 5 5 4h4l5-4v11l-7 5-7-5V5ZM9 13h.01M15 13h.01M10 17h4"/>'
    };
    const CONTROL_GLYPHS = {
        recenter: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
        fullscreen: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
        share: '<path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/>',
        filters: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>'
    };
    function english() { return global.NamelessI18n?.getLanguage?.() === 'en'; }
    function text(fr, en) { return english() ? en : fr; }
    function label(entity) { return english() && entity.titleEn ? entity.titleEn : entity.title || entity.id || entity.key; }
    function typeLabel(type) { const value = TYPE_LABELS[type] || ['Repères', 'Markers']; return text(...value); }
    function kindLabel(kind) { return text(...(KIND_LABELS[kind] || ['Lieu', 'Location'])); }
    function entryKind(entity) { const kind = entity.markerType === 'boss' ? text('Boss', 'Boss') : kindLabel(entity.kind); return entity.status === 'historical-unverified' ? kind + text(' · Archive non vérifiée', ' · Unverified archive') : kind; }
    function node(tag, className, content) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content != null) element.textContent = String(content);
        return element;
    }
    function controlLabel(element, content, glyph) {
        if (!element) return;
        const icon = node('span', 'map-control-icon'); icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<svg viewBox="0 0 24 24">' + CONTROL_GLYPHS[glyph] + '</svg>';
        element.replaceChildren(icon, node('span', 'map-control-label', content)); element.setAttribute('aria-label', content); element.title = content;
    }
    function finite(value, limit = 1000000) { return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit; }
    function numberParam(params, name, limit = 1000000) {
        if (!params.has(name) || !params.get(name)?.trim()) return null;
        const value = Number(params.get(name)); return finite(value, limit) ? value : null;
    }
    function localUrl(value) {
        if (!value) return null;
        try { const url = new URL(value, global.location.href); return url.origin === global.location.origin && /^(https?:)$/.test(url.protocol) ? url.href : null; }
        catch (_) { return null; }
    }
    function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    function client() { return global.supabase && typeof global.supabase.rpc === 'function' ? global.supabase : null; }
    async function fetchJson(url) {
        const response = await global.fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    }
    function getCatalog() {
        if (!catalogPromise) catalogPromise = fetchJson('/assets/map/catalog.json').catch(error => { catalogPromise = null; throw error; });
        return catalogPromise;
    }
    function floorData(config) {
        const id = Number(config.id);
        if (!FLOOR_CACHE.has(id)) FLOOR_CACHE.set(id, fetchJson(config.dataUrl || '/assets/map/floor-' + id + '.json').catch(error => { FLOOR_CACHE.delete(id); throw error; }));
        return FLOOR_CACHE.get(id);
    }
    function valid(state) { return active === state && !state.controller.signal.aborted; }
    function reducedMotion() { return !!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    function animateFloor(state) {
        if (state.animatedFloorGeneration === state.floorGeneration) return;
        state.floorAnimation?.cancel(); state.floorAnimation = null;
        if (!valid(state) || reducedMotion() || !state.ui.map.animate) return;
        state.animatedFloorGeneration = state.floorGeneration;
        const animation = state.ui.map.animate([{ opacity: .35, filter: 'brightness(.72)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 350, easing: 'cubic-bezier(.2,.65,.25,1)' });
        state.floorAnimation = animation;
        animation.finished?.then(() => { if (state.floorAnimation === animation) state.floorAnimation = null; }).catch(() => {});
    }
    function listen(state, target, event, fn) { target?.addEventListener(event, fn, { signal: state.controller.signal }); }
    function emit(state, event, value) { for (const fn of state.events.get(event) || []) fn(value); }
    function notice(state, message) {
        if (!valid(state)) return;
        state.ui.status.textContent = message || ''; state.ui.status.hidden = !message;
    }
    function configOf(state, id = state.floor) { return state.catalog?.floors.find(floor => Number(floor.id) === Number(id)); }
    function relative(state, latlng, id = state.floor) {
        const config = configOf(state, id); if (!config) return null;
        const [[south, west], [north, east]] = config.bounds;
        const lat = Number(latlng.lat ?? latlng[0]), lng = Number(latlng.lng ?? latlng[1]);
        if (!finite(lat) || !finite(lng)) return null;
        const offset = typeof config.gameOffset === 'object' ? config.gameOffset?.z : config.gameOffset;
        return { u: (lng - west) / (east - west), v: (north - lat) / (north - south), x: offset == null ? null : lng, z: offset == null ? null : offset - lat };
    }
    function latlng(state, position, id = state.floor) {
        const config = configOf(state, id); if (!config || !position) return null;
        const [[south, west], [north, east]] = config.bounds;
        if (finite(position.u, 2) && finite(position.v, 2)) return [north - position.v * (north - south), west + position.u * (east - west)];
        const offset = typeof config.gameOffset === 'object' ? config.gameOffset?.z : config.gameOffset;
        if (offset != null && finite(position.x) && finite(position.z)) return [offset - position.z, position.x];
        return null;
    }
    function clearOverlays(state) {
        state.overlayGeneration++;
        const cached = new Set([...state.fullImages.values()].map(record => record.overlay));
        for (const layer of state.overlays) { state.map.removeLayer(layer); if (!cached.has(layer)) layer.off?.(); }
        state.overlays = []; state.detail = null;
    }
    function mountImage(state, config) {
        clearOverlays(state);
        const generation = state.overlayGeneration;
        const floorId = Number(config.id);
        const mobile = global.innerWidth <= 700;
        const image = (mobile ? config.overviewMobile : config.overview) || config.image;
        const overview = global.L.imageOverlay(image, config.bounds).addTo(state.map);
        const imageElement = overview.getElement?.();
        imageElement?.setAttribute('fetchpriority', 'high'); imageElement?.setAttribute('loading', 'eager'); imageElement?.setAttribute('decoding', 'async');
        state.overlays.push(overview);
        overview.on?.('load', () => { if (valid(state) && generation === state.overlayGeneration && state.floor === floorId) animateFloor(state); });
        overview.on?.('error', () => { if (valid(state) && generation === state.overlayGeneration) notice(state, text('L’image de ce palier ne peut pas être chargée.', 'This floor image could not be loaded.')); });
        function detailWhenNeeded() {
            if (!valid(state) || generation !== state.overlayGeneration || state.floor !== floorId || image === config.image || state.detail || state.fullImages.get(floorId)?.failed) return;
            const width = mobile ? config.overviewMobileWidth || 1024 : config.overviewWidth || 1600;
            const displayWidth = Math.abs(config.bounds[1][1] - config.bounds[0][1]) * Math.pow(2, state.map.getZoom());
            if (displayWidth <= width * 1.08) return;
            let record = state.fullImages.get(floorId);
            let detail = record?.overlay;
            if (!detail) {
                detail = global.L.imageOverlay(config.image, config.bounds, { opacity: 0 });
                record = { overlay: detail, ready: false, failed: false, mountedGeneration: generation };
                state.fullImages.set(floorId, record);
                detail.on('load', () => {
                    record.ready = true;
                    if (valid(state) && state.floor === floorId && record.mountedGeneration === state.overlayGeneration && state.detail === detail && state.overlays.includes(detail)) { detail.setOpacity(1); state.overview?.setOpacity(0); }
                });
                detail.on('error', () => {
                    record.failed = true;
                    if (valid(state) && state.floor === floorId && record.mountedGeneration === state.overlayGeneration && state.detail === detail) notice(state, text('L’aperçu reste disponible ; les détails n’ont pas pu être chargés.', 'The overview is available; the detailed image could not be loaded.'));
                });
            }
            record.mountedGeneration = generation;
            state.detail = detail; state.overlays.push(detail);
            if (record.ready) { detail.setOpacity(1); overview.setOpacity(0); }
            else detail.setOpacity(0);
            detail.addTo(state.map);
        }
        state.overview = overview;
        state.detailCheck = detailWhenNeeded;
        detailWhenNeeded();
    }
    function icon(type, count = 1, selected = false, name = '') {
        const safeType = Object.hasOwn(GLYPHS, type) ? type : 'zone';
        const nameNode = node('span', 'map-marker-name', name);
        return global.L.divIcon({ className: 'map-marker type-' + safeType + (selected ? ' is-selected' : ''),
            html: '<span class="map-marker-symbol"><svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPHS[safeType] + '</svg>' + (count > 1 ? '<small aria-hidden="true">' + count + '</small>' : '') + '</span>' + (name ? nameNode.outerHTML : ''), iconSize: [30, 30], iconAnchor: [15, 15] });
    }
    function applyOverrides(state) {
        if (!state.rawData) return;
        const entities = Object.fromEntries(Object.entries(state.rawData.entities || {}).map(([key, entity]) => [key, { ...entity }]));
        const points = new Set(state.rawData.points || []);
        if (state.overridesStatus === 'pending' || (state.overridesStatus === 'error' && !lastGoodOverrides)) {
            for (const entity of Object.values(entities)) { entity.position = null; entity.positionRef = null; entity.overrideState = 'unavailable'; }
            state.data = { ...state.rawData, entities, points: [] }; return;
        }
        for (const record of state.overrides || []) {
            const key = record.entity_key; const entity = entities[key];
            if (!entity) continue;
            points.delete(key);
            if (Number(record.floor) !== state.floor || record.state !== 'visible' || !finite(record.u, 1) || !finite(record.v, 1) || record.u < 0 || record.v < 0) {
                entity.position = null; entity.overrideState = record.state || 'hidden'; continue;
            }
            const coord = latlng(state, { u: record.u, v: record.v });
            entity.position = { ...relative(state, coord), source: 'override' };
            entity.markerType = Object.hasOwn(TYPE_LABELS, record.marker_type) ? record.marker_type : entity.markerType;
            entity.overrideState = 'visible'; entity.overrideId = record.id; points.add(key);
        }
        state.data = { ...state.rawData, entities, points: [...points] };
    }
    function renderFilters(state) {
        state.ui.filters.classList.toggle('is-ready', !!state.data && state.overridesStatus !== 'pending');
        const available = new Set((state.data?.points || []).map(key => state.data.entities[key]?.markerType).filter(Boolean));
        state.ui.filters.replaceChildren();
        if (state.ui.filterEmpty) {
            state.ui.filterEmpty.hidden = !state.data || available.size > 0;
            state.ui.filterEmpty.textContent = state.overridesStatus === 'pending'
                ? text('Vérification des repères…', 'Checking markers…') : text('Aucun repère disponible.', 'No markers available.');
        }
        const groups = [ [['Lieux', 'Places'], ['town', 'dungeon', 'zone', 'merchant', 'teleporter']], [['Quêtes', 'Quests'], ['quest-primary', 'quest-secondary']], [['Personnages', 'Characters'], ['npc', 'boss', 'creature']] ];
        for (const [name, types] of groups) {
            const present = types.filter(type => available.has(type)); if (!present.length) continue;
            const fieldset = node('fieldset', 'map-filter-group'); fieldset.append(node('legend', '', text(...name)));
            for (const type of present) {
                if (!state.filters.has(type)) state.filters.set(type, !type.startsWith('quest-'));
                const control = node('label', 'map-filter'); const input = node('input'); input.type = 'checkbox'; input.checked = state.filters.get(type); input.dataset.markerType = type;
                control.append(input, node('span', '', typeLabel(type))); fieldset.append(control);
                listen(state, input, 'change', () => { state.filters.set(type, input.checked); renderMarkers(state); });
            }
            state.ui.filters.append(fieldset);
        }
    }
    function syncFilterDrawer(state) {
        const compact = global.innerWidth <= 768;
        if (!compact) state.filtersOpen = false;
        state.ui.filterRail?.classList.toggle('is-open', compact && state.filtersOpen);
        if (state.ui.filterRail) state.ui.filterRail.hidden = compact && !state.filtersOpen;
        state.ui.filterToggle?.setAttribute('aria-expanded', String(compact && state.filtersOpen));
    }
    function syncFloorControls(state) {
        const floors = state.catalog?.floors || [];
        const current = floors.findIndex(floor => Number(floor.id) === state.floor);
        if (state.ui.floorTitle) state.ui.floorTitle.textContent = text('Palier ', 'Floor ') + String(state.floor).padStart(2, '0');
        if (state.ui.previous) state.ui.previous.disabled = current <= 0;
        if (state.ui.next) state.ui.next.disabled = current < 0 || current >= floors.length - 1;
        for (const button of state.ui.floorButtons?.querySelectorAll('button') || []) {
            const selected = Number(button.dataset.floor) === state.floor;
            button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
            button.setAttribute('aria-label', text('Palier ', 'Floor ') + button.textContent);
        }
    }
    function renderFloorControls(state) {
        if (!state.catalog) return;
        state.ui.floor.replaceChildren(); state.ui.floorButtons?.replaceChildren();
        for (const floor of state.catalog.floors) {
            const option = node('option', '', text('Palier ', 'Floor ') + floor.id); option.value = String(floor.id); state.ui.floor.append(option);
            if (!state.ui.floorButtons) continue;
            const button = node('button', 'map-floor-button', String(floor.id).padStart(2, '0')); button.type = 'button'; button.dataset.floor = String(floor.id);
            listen(state, button, 'click', () => chooseFloor(state, Number(floor.id)));
            state.ui.floorButtons.append(button);
        }
        state.ui.floor.value = String(state.floor); syncFloorControls(state);
    }
    function targetPosition(state, entity) {
        if (!entity || ['hidden', 'deleted'].includes(entity.overrideState)) return { position: null, reference: null };
        if (entity.position) return { position: latlng(state, entity.position), reference: null };
        const reference = state.data?.entities?.[entity.positionRef];
        return { position: reference && !['hidden', 'deleted'].includes(reference.overrideState) ? latlng(state, reference.position) : null, reference: reference || null };
    }
    function clearMarkers(state) {
        const previous = []; state.markerLayer.eachLayer?.(marker => previous.push(marker));
        // Leaflet's remove event releases map listeners; keep it alive until removal.
        state.markerLayer.clearLayers(); previous.forEach(marker => marker.off?.()); state.markers.clear();
    }
    function renderMarkers(state) {
        clearMarkers(state);
        if (!state.data) return;
        const selectedEntity = state.data.entities[state.selected];
        const selectedTarget = targetPosition(state, selectedEntity);
        const groups = new Map();
        const keys = new Set(state.data.points);
        if (selectedEntity?.position && !['hidden', 'deleted'].includes(selectedEntity.overrideState)) keys.add(selectedEntity.key);
        for (const key of keys) {
            const entity = state.data.entities[key]; if (!entity?.position) continue;
            const selected = key === state.selected || key === selectedTarget.reference?.key;
            if (!state.editorMode && !state.filters.get(entity.markerType) && !selected) continue;
            const coord = latlng(state, entity.position); if (!coord) continue;
            const groupKey = coord.join('|'); const group = groups.get(groupKey) || { coord, entities: [] };
            group.entities.push(entity); groups.set(groupKey, group);
        }
        const clusters = [];
        const selectedKey = selectedTarget.reference?.key || state.selected;
        const sorted = [...groups.values()].sort((a, b) => Number(b.entities.some(entity => entity.key === selectedKey)) - Number(a.entities.some(entity => entity.key === selectedKey)));
        for (const group of sorted) {
            const point = state.map.latLngToLayerPoint?.(group.coord);
            const cluster = !state.editorMode && point && clusters.find(other => other.point && Math.hypot(point.x - other.point.x, point.y - other.point.y) <= 36);
            if (cluster) { cluster.entities.push(...group.entities); cluster.coordinates.push(group.coord); }
            else clusters.push({ ...group, entities: [...group.entities], coordinates: [group.coord], point });
        }
        for (const group of clusters) {
            const selected = group.entities.some(entity => entity.key === state.selected || entity.key === selectedTarget.reference?.key);
            const named = group.entities.find(entity => entity.kind === 'location');
            const marker = global.L.marker(group.coord, { icon: icon(group.entities[0].markerType, group.entities.length, selected, named ? label(named) : ''), keyboard: true, title: group.entities.map(label).join(' · '), riseOnHover: true });
            const tooltip = node('span', '', group.entities.map(label).join(' · '));
            marker.bindTooltip?.(tooltip, { className: 'map-hover-tooltip', direction: 'top', offset: [0, -14], opacity: 1 });
            marker.on('click', () => {
                if (state.editorMode) { emit(state, 'marker', { entities: group.entities, marker, latlng: { lat: group.coord[0], lng: group.coord[1] } }); return; }
                if (group.entities.length === 1) selectEntity(state, group.entities[0].key);
                else {
                    showChoices(state, group.entities);
                    if (group.coordinates.length > 1) state.map.fitBounds(group.coordinates, { padding: [48, 48], maxZoom: 0, animate: false });
                }
            });
            marker.addTo(state.markerLayer);
            marker.getElement?.()?.setAttribute('aria-label', group.entities.map(label).join(' · '));
            for (const entity of group.entities) state.markers.set(entity.key, marker);
        }
        emit(state, 'markers', { markers: state.markers, data: state.data });
    }
    function showPanel(state) {
        state.ui.panel.hidden = false; state.ui.workspace.classList.add('has-selection');
        state.map.invalidateSize?.({ pan: false });
    }
    function closePanel(state, update = true) {
        state.selected = null; state.pendingSelection = null; state.choiceKeys = null; state.ui.panel.hidden = true; state.ui.panel.classList.remove('is-expanded'); state.ui.expand.setAttribute('aria-expanded', 'false'); state.ui.workspace.classList.remove('has-selection');
        renderMarkers(state); state.map.invalidateSize?.({ pan: false });
        renderPlaces(state);
        if (update) updateUrl(state, null);
        emit(state, 'selection', null);
    }
    function showChoices(state, entities) {
        state.choiceKeys = entities.map(entity => entity.key); state.ui.content.replaceChildren(node('h2', '', text('Plusieurs repères à cet endroit', 'Several markers at this location')));
        for (const entity of entities) {
            const button = node('button', 'map-choice', label(entity)); button.type = 'button'; listen(state, button, 'click', () => selectEntity(state, entity.key));
            listen(state, button, 'keydown', event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); const choices = [...state.ui.content.querySelectorAll('.map-choice')]; const index = choices.indexOf(button);
                    choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
                }
            }); state.ui.content.append(button);
        }
        showPanel(state);
    }
    function relation(state, heading, keys, suffixes = null, host = state.ui.content) {
        const unique = [...new Set((keys || []).filter(key => key && key !== state.selected))]; if (!unique.length) return;
        const list = node('ul', 'map-relations');
        for (const key of unique) {
            const entity = state.data.entities[key] || state.catalog.index.find(entry => entry.key === key); if (!entity) continue;
            const item = node('li'); const button = node('button', 'map-relation', null); button.type = 'button'; button.dataset.entityKey = key;
            const image = entityImage(state, entity, 'map-relation-image'); if (image) button.append(image);
            const info = node('span', 'map-relation-info'); info.append(node('span', 'map-relation-title', label(entity)));
            const note = [entity.status === 'historical-unverified' ? text('Archive non vérifiée', 'Unverified archive') : '', suffixes?.[key] || ''].filter(Boolean).join(' · ');
            if (note) info.append(node('small', '', note));
            button.append(info, node('span', 'map-relation-arrow', '›'));
            listen(state, button, 'click', () => selectEntity(state, key)); item.append(button); list.append(item);
        }
        if (list.childElementCount) host.append(node('h3', '', heading), list);
    }
    function locationPreview(state, entity) {
        const config = configOf(state); const target = targetPosition(state, entity);
        if (!config || !target.position) return null;
        const position = relative(state, target.position); const src = localUrl(config.overview || config.image);
        if (!src || !position) return null;
        const preview = node('div', 'map-location-preview');
        preview.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
        preview.style.backgroundPosition = Math.max(0, Math.min(100, position.u * 100)) + '% ' + Math.max(0, Math.min(100, position.v * 100)) + '%';
        preview.setAttribute('role', 'img'); preview.setAttribute('aria-label', text('Extrait de la carte : ', 'Map excerpt: ') + label(entity));
        preview.append(node('span', '', text('Extrait de carte', 'Map excerpt'))); return preview;
    }
    function renderPlaces(state) {
        if (!state.ui.places || !state.ui.placesList) return;
        const places = Object.values(state.data?.entities || {}).filter(entity => entity.kind === 'location' && targetPosition(state, entity).position && !['hidden', 'deleted'].includes(entity.overrideState));
        state.ui.places.hidden = !places.length; state.ui.placesList.replaceChildren();
        state.ui.placesTitle.textContent = text('Lieux d’intérêt du Palier ', 'Places of interest on Floor ') + String(state.floor).padStart(2, '0');
        if (!places.length) return;
        const featured = [...places.filter(entity => entity.markerType === 'town').slice(0, 2), ...places.filter(entity => entity.markerType !== 'town')];
        for (const entity of (state.showAllPlaces ? places : featured.slice(0, 5))) {
            const card = node('button', 'map-place-card' + (entity.key === state.selected ? ' is-selected' : '')); card.type = 'button'; card.dataset.entityKey = entity.key;
            const preview = locationPreview(state, entity); if (preview) card.append(preview);
            card.append(node('strong', '', label(entity)), node('small', '', typeLabel(entity.markerType)));
            listen(state, card, 'click', () => selectEntity(state, entity.key)); state.ui.placesList.append(card);
        }
        if (state.ui.placesToggle) { state.ui.placesToggle.hidden = places.length <= 5; state.ui.placesToggle.textContent = state.showAllPlaces ? text('Réduire', 'Show fewer') : text('Voir tous les lieux', 'Show all places'); state.ui.placesToggle.setAttribute('aria-expanded', String(!!state.showAllPlaces)); }
    }
    function panelTabs(state, panes) {
        const tabs = node('div', 'map-panel-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', text('Informations du lieu', 'Place information'));
        const choices = [['overview', text('Aperçu', 'Overview')], ['creatures', text('Monstres', 'Creatures')], ['items', text('Objets', 'Items')], ['places', text('Lieux', 'Places')]];
        function activate(key) {
            for (const button of tabs.querySelectorAll('button')) { const selected = button.dataset.panelTab === key; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; }
            for (const [name, pane] of Object.entries(panes)) pane.hidden = name !== key;
        }
        for (const [key, title] of choices) {
            const button = node('button', '', title); button.type = 'button'; button.id = 'map-panel-tab-' + key; button.dataset.panelTab = key; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'map-panel-pane-' + key);
            panes[key].id = 'map-panel-pane-' + key; panes[key].className = 'map-panel-tab'; panes[key].setAttribute('role', 'tabpanel'); panes[key].setAttribute('aria-labelledby', button.id);
            if (!panes[key].children.length) panes[key].append(node('p', 'map-position-note', text('Aucune relation documentée.', 'No documented relations.')));
            listen(state, button, 'click', () => activate(key));
            listen(state, button, 'keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const buttons = [...tabs.querySelectorAll('button')]; const index = buttons.indexOf(button); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length; buttons[next].click(); buttons[next].focus(); });
            tabs.append(button);
        }
        state.ui.content.append(tabs, ...Object.values(panes)); activate('overview');
    }
    function entityImage(state, entity, className) {
        if (!['creature', 'item'].includes(entity.kind)) return null;
        const src = localUrl(entity.image); if (!src) return null;
        const media = node('span', className + (entity.kind === 'item' ? ' is-item' : ''));
        const image = node('img'); image.src = src; image.alt = ''; image.setAttribute('loading', 'lazy'); image.setAttribute('decoding', 'async'); image.width = 64; image.height = 64;
        if (entity.kind === 'item') listen(state, image, 'load', () => {
            if (!valid(state) || !image.naturalWidth || !image.naturalHeight) return;
            if (image.naturalWidth <= 56 && image.naturalHeight <= 56) {
                const scale = Math.max(1, Math.min(2, Math.floor(Math.min(56 / image.naturalWidth, 56 / image.naturalHeight))));
                image.classList.add('is-pixel-art'); image.style.width = image.naturalWidth * scale + 'px'; image.style.height = image.naturalHeight * scale + 'px';
            }
        });
        listen(state, image, 'error', () => { if (valid(state)) media.hidden = true; });
        media.append(image); return media;
    }
    function renderPanel(state, entity) {
        state.choiceKeys = null; state.ui.content.replaceChildren();
        const panes = { overview: node('div'), creatures: node('div'), items: node('div'), places: node('div') }; const overview = panes.overview;
        const head = node('div', 'map-entity-heading');
        const image = entityImage(state, entity, 'map-entity-image'); if (image) head.append(image);
        const title = node('div'); title.append(node('span', 'map-kind', entryKind(entity) + ' · ' + text('Palier ', 'Floor ') + state.floor), node('h2', '', label(entity))); head.append(title); state.ui.content.append(head);
        if (entity.kind === 'location') { const preview = locationPreview(state, entity); if (preview) state.ui.content.append(preview); }
        if (entity.status === 'historical-unverified') overview.append(node('p', 'map-position-note', text('Documentation secondaire historique. Ces informations n’ont pas été vérifiées depuis les changements du serveur.', 'Historical side-quest documentation. This information has not been verified since the server changes.')));
        if (entity.description) overview.append(node('p', '', english() && entity.descriptionEn ? entity.descriptionEn : global.NamelessI18n?.translate?.(entity.description) || entity.description));
        const target = targetPosition(state, entity);
        if (target.reference) {
            const prefix = entity.kind === 'creature' ? text('Zone associée : ', 'Associated zone: ')
                : target.reference.kind === 'guide' ? text('Repère du guide : ', 'Guide marker: ')
                : target.reference.kind === 'quest' ? text('Repère de la quête : ', 'Quest marker: ') : text('Repère associé : ', 'Associated marker: ');
            const explanation = entity.kind === 'creature' ? text('. La position exacte de cette créature est inconnue.', '. The exact position of this creature is unknown.')
                : text('. La position propre de cette entrée n’est pas renseignée.', '. This entry’s own position has not been recorded.');
            overview.append(node('p', 'map-position-note', prefix + label(target.reference) + explanation));
        }
        else if (!target.position) overview.append(node('p', 'map-position-note', ['hidden', 'deleted'].includes(entity.overrideState) ? text('Ce repère est masqué sur la carte.', 'This marker is hidden on the map.') : text('Position exacte non renseignée.', 'Exact position has not been recorded.')));
        if (entity.position && target.position) {
            const coords = relative(state, target.position);
            if (coords.x != null) overview.append(node('p', 'map-coordinates', 'X ' + Math.round(coords.x) + ' · Z ' + Math.round(coords.z)));
            else overview.append(node('p', 'map-position-note', text('Coordonnées du jeu non calibrées pour ce palier.', 'Game coordinates are not calibrated for this floor.')));
        }
        const href = localUrl(entity.url);
        if (href && !new URL(href).pathname.match(/^\/(carte|pages\/map\.html)$/)) { const link = node('a', 'map-page-link', text('Ouvrir la fiche', 'Open details')); link.href = href; overview.append(link); }
        if (target.position) { const center = node('button', 'map-page-link', text('Voir sur la carte', 'View on map')); center.type = 'button'; listen(state, center, 'click', () => { state.map.setView(target.position, Math.max(state.map.getMinZoom(), Math.min(state.map.getMaxZoom(), global.innerWidth <= 700 ? -1 : 0)), { animate: !reducedMotion(), duration: .45 }); updateUrl(state, entity.key); }); overview.append(center); }
        const reverse = Object.values(state.data.entities).filter(other => other.key !== entity.key);
        relation(state, text('Lieu associé', 'Associated place'), [entity.placeKey, entity.positionRef], null, panes.places);
        if (entity.kind !== 'item') relation(state, text('Créatures', 'Creatures'), [...(entity.creatureKeys || []), ...reverse.filter(other => other.kind === 'creature' && (other.placeKey === entity.key || other.positionRef === entity.key)).map(other => other.key)], null, panes.creatures);
        const guides = new Set([...(entity.guideKeys || []), ...reverse.filter(other => other.kind === 'guide' && (other.placeKey === entity.key || other.positionRef === entity.key)).map(other => other.key)]);
        const archivedQuests = reverse.filter(other => other.kind === 'quest' && (other.placeKey === entity.key || other.positionRef === entity.key) && !other.guideKeys?.some(key => guides.has(key)));
        relation(state, text('Quêtes et guides', 'Quests and guides'), [...guides, ...archivedQuests.map(other => other.key)], Object.fromEntries(archivedQuests.map(other => [other.key, text('repère de quête archivé', 'archived quest marker')])), overview);
        const areaCreatures = entity.kind === 'location' ? reverse.filter(other => other.kind === 'creature' && (other.placeKey === entity.key || other.positionRef === entity.key || entity.creatureKeys?.includes(other.key))) : [];
        const drops = [...(entity.drops || []), ...areaCreatures.flatMap(creature => creature.drops || [])];
        const rates = Object.fromEntries(drops.filter(drop => drop.itemKey).map(drop => [drop.itemKey, drop.rate != null && entity.kind === 'creature' ? String(drop.rate) + ' %' : '']));
        relation(state, text('Butin et ressources', 'Loot and resources'), drops.map(drop => drop.itemKey), rates, panes.items);
        const unlinked = drops.filter(drop => !drop.itemKey); if (unlinked.length) { panes.items.append(node('h3', '', text('Autres ressources connues', 'Other known resources'))); for (const drop of unlinked) panes.items.append(node('p', '', drop.name + (drop.rate != null ? ' · ' + drop.rate : ''))); }
        if (entity.kind === 'item') relation(state, text('Créatures et sources', 'Creatures and sources'), [...(entity.creatureKeys || []), ...reverse.filter(other => other.drops?.some(drop => drop.itemKey === entity.key)).map(other => other.key)], null, panes.creatures);
        const alreadyShown = new Set([entity.placeKey, entity.positionRef, ...(entity.creatureKeys || []), ...(entity.guideKeys || []), ...drops.map(drop => drop.itemKey),
            ...reverse.filter(other => (other.placeKey === entity.key || other.positionRef === entity.key) && ['creature', 'guide', 'quest'].includes(other.kind)).map(other => other.key),
            ...(entity.kind === 'item' ? reverse.filter(other => other.drops?.some(drop => drop.itemKey === entity.key)).map(other => other.key) : [])]);
        const remaining = (entity.relatedKeys || []).filter(key => !alreadyShown.has(key));
        relation(state, text('Lieux et services associés', 'Related places and services'), remaining.filter(key => ['location', 'npc'].includes((state.data.entities[key] || state.catalog.index.find(entry => entry.key === key))?.kind)), null, panes.places);
        relation(state, text('Relations', 'Related entries'), remaining.filter(key => !['location', 'npc'].includes((state.data.entities[key] || state.catalog.index.find(entry => entry.key === key))?.kind)), null, overview);
        panelTabs(state, panes);
        showPanel(state);
    }
    function hideSearch(state) { state.ui.results.hidden = true; state.ui.results.style.display = 'none'; }
    function renderSearch(state) {
        const query = normalize(state.ui.search.value).trim(); state.ui.clear.style.display = query ? '' : 'none'; state.ui.results.replaceChildren();
        if (!query || !state.catalog) { hideSearch(state); return; }
        const tokens = query.split(/\s+/);
        const results = state.catalog.index.filter(entity => tokens.every(token => normalize([entity.title, entity.titleEn, entity.id, ...(Array.isArray(entity.keywords) ? entity.keywords : [entity.keywords])].join(' ')).includes(token)))
            .sort((a, b) => (Number(b.floor) === state.floor) - (Number(a.floor) === state.floor) || Number(a.floor || 99) - Number(b.floor || 99) || label(a).localeCompare(label(b))).slice(0, 60);
        state.ui.results.append(node('div', 'map-search-summary', results.length ? results.length + ' ' + text('résultat(s)', 'result(s)') : text('Aucun résultat trouvé', 'No results found')));
        for (const entity of results) {
            const button = node('button', 'search-result-item'); button.type = 'button'; button.dataset.entityKey = entity.key;
            const info = node('span', '', label(entity)); info.append(node('small', '', entryKind(entity))); button.append(info, node('span', 'search-result-floor', entity.floor ? text('Palier ', 'Floor ') + entity.floor : ''));
            listen(state, button, 'click', () => { hideSearch(state); selectEntity(state, entity.key); }); state.ui.results.append(button);
        }
        state.ui.results.hidden = false; state.ui.results.style.display = 'block';
    }
    function clearTargets(params) { ['entity', 'location', 'creature', 'boss', 'guide', 'quest', 'x', 'y', 'u', 'v', 'zoom', 'q'].forEach(key => params.delete(key)); }
    function updateUrl(state, key, precise = false, replace = false) {
        const url = new URL(global.location.href); clearTargets(url.searchParams); url.searchParams.set('floor', String(state.floor)); if (key) url.searchParams.set('entity', key);
        if (precise) { const coord = relative(state, state.map.getCenter()); if (coord) { url.searchParams.set('u', coord.u.toFixed(6)); url.searchParams.set('v', coord.v.toFixed(6)); url.searchParams.set('zoom', String(state.map.getZoom())); } }
        if (url.href !== global.location.href) global.history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
        state.lastRoute = url.href;
    }
    function recenter(state) { const config = configOf(state); if (config) state.map.fitBounds(config.bounds, { padding: [15, 15], animate: false }); }
    function saveState(state) {
        if (!valid(state) || !state.catalog) return;
        const center = state.map.getCenter();
        try { global.localStorage.setItem('ironOathMapState', JSON.stringify({ lat: center.lat, lng: center.lng, zoom: state.map.getZoom(), floor: state.floor })); } catch (_) { /* Optional preferences. */ }
    }
    async function changeFloor(state, id, options = {}) {
        const config = configOf(state, id); if (!config || !valid(state)) return false;
        const generation = ++state.floorGeneration;
        state.floorAnimation?.cancel(); state.floorAnimation = null;
        state.floor = Number(id); state.rawData = null; state.data = null; state.ui.floor.value = String(id); syncFloorControls(state); clearMarkers(state); renderFilters(state);
        state.map.setMaxBounds?.(config.maxBounds || config.bounds); recenter(state); mountImage(state, config);
        state.ui.map.setAttribute('aria-busy', 'true');
        if (Number(config.id) === 3) notice(state, text('Palier 3 : image disponible, repères et coordonnées du jeu non calibrés.', 'Floor 3: image available; markers and game coordinates are not calibrated.'));
        else if (state.overridesStatus !== 'error') notice(state, '');
        try {
            const data = await floorData(config); if (!valid(state) || generation !== state.floorGeneration) return false;
            state.rawData = data; applyOverrides(state); renderFilters(state); renderMarkers(state); renderPlaces(state); state.ui.map.setAttribute('aria-busy', 'false'); if (state.overview?.getElement?.()?.complete) animateFloor(state);
            emit(state, 'floor', { floor: state.floor, data: state.data }); return true;
        } catch (_) {
            if (valid(state) && generation === state.floorGeneration) { state.ui.map.setAttribute('aria-busy', 'false'); notice(state, text('Les repères de ce palier ne peuvent pas être chargés.', 'Markers for this floor could not be loaded.')); }
            return false;
        }
    }
    async function selectEntity(state, key, options = {}) {
        if (!valid(state) || !state.catalog) return false;
        const entry = state.catalog.index.find(entity => entity.key === key); if (!entry) { notice(state, text('Ce repère est introuvable.', 'This marker could not be found.')); return false; }
        const intent = options.intent ?? ++state.intent;
        const targetFloor = Number(entry.floor) || state.floor;
        if (state.floor !== targetFloor || !state.data) { if (!(await changeFloor(state, targetFloor))) return false; }
        if (!valid(state) || intent !== state.intent || state.floor !== targetFloor) return false;
        const entity = state.data.entities[key];
        if (!entity) { notice(state, text('La fiche de ce repère n’est pas disponible sur ce palier.', 'This marker entry is not available on this floor.')); return false; }
        state.selected = key; hideSearch(state); state.filtersOpen = false; syncFilterDrawer(state); renderMarkers(state); renderPanel(state, entity); renderPlaces(state);
        const target = targetPosition(state, entity);
        if (target.position && options.center !== false) state.map.setView(target.position, Math.max(state.map.getMinZoom(), Math.min(state.map.getMaxZoom(), global.innerWidth <= 700 ? -1 : 0)), { animate: !reducedMotion(), duration: .45 });
        else if (state.overridesStatus === 'pending' && options.center !== false) state.pendingSelection = { key, intent };
        if (options.url !== false) updateUrl(state, key);
        emit(state, 'selection', entity); return true;
    }
    function findAlias(state, params) {
        const floor = Number(params.get('floor'));
        if (params.has('entity')) return state.catalog.index.find(entity => entity.key === params.get('entity'))?.key || null;
        const aliases = [['location', 'location'], ['creature', 'creature'], ['boss', 'creature'], ['guide', 'guide'], ['quest', 'quest']];
        for (const [param, kind] of aliases) {
            if (!params.has(param)) continue;
            const id = params.get(param); const candidates = state.catalog.index.filter(entity => entity.kind === kind && (String(entity.id) === id || entity.key === id || entity.key === kind + ':' + id || (param === 'boss' && entity.url === '/boss/' + id)));
            return (candidates.find(entity => Number(entity.floor) === floor) || candidates[0])?.key || null;
        }
        return null;
    }
    async function applyRoute(state, initial = false) {
        if (!valid(state) || !state.catalog) return;
        const href = global.location.href; if (!initial && href === state.lastRoute) return;
        state.lastRoute = href; const intent = ++state.intent;
        const params = new URL(href).searchParams; const key = findAlias(state, params);
        const requestedFloor = Number(params.get('floor'));
        const entry = key && state.catalog.index.find(entity => entity.key === key);
        let floor = Number(entry?.floor) || (configOf(state, requestedFloor) ? requestedFloor : 1);
        let saved = null;
        if (initial && !['floor', 'entity', 'location', 'creature', 'boss', 'guide', 'quest', 'x', 'y', 'q', 'u', 'v', 'zoom'].some(name => params.has(name))) {
            try { saved = JSON.parse(global.localStorage.getItem('ironOathMapState')); } catch (_) { /* Optional preferences. */ }
            if (saved && configOf(state, saved.floor) && finite(saved.lat) && finite(saved.lng) && finite(saved.zoom, 20)) {
                const bounds = configOf(state, saved.floor).maxBounds || configOf(state, saved.floor).bounds;
                if (saved.lat >= bounds[0][0] && saved.lat <= bounds[1][0] && saved.lng >= bounds[0][1] && saved.lng <= bounds[1][1]) floor = Number(saved.floor); else saved = null;
            } else saved = null;
        }
        closePanel(state, false);
        if (state.floor !== floor || !state.data) { if (!(await changeFloor(state, floor))) return; }
        if (!valid(state) || intent !== state.intent || state.floor !== floor) return;
        if (key) await selectEntity(state, key, { intent, url: false });
        else if (['entity', 'location', 'creature', 'boss', 'guide', 'quest'].some(name => params.has(name))) {
            const archivedMain = ['entity', 'guide', 'quest'].some(name => /(?:^|:)p[12]-principale-/.test(params.get(name) || ''));
            notice(state, archivedMain ? text('Cette ancienne quête principale a été archivée. Son parcours obsolète n’est plus publié.', 'This former main quest has been archived. Its obsolete walkthrough is no longer published.') : text('Ce repère est introuvable.', 'This marker could not be found.'));
        }
        if (!valid(state) || intent !== state.intent) return;
        const u = numberParam(params, 'u', 2), v = numberParam(params, 'v', 2), zoom = numberParam(params, 'zoom', 20);
        const x = numberParam(params, 'x'), z = numberParam(params, 'y');
        const relativeCenter = u != null && v != null ? latlng(state, { u, v }) : null;
        const allowedBounds = configOf(state).maxBounds || configOf(state).bounds;
        const relativeCenterAllowed = relativeCenter && relativeCenter[0] >= allowedBounds[0][0] && relativeCenter[0] <= allowedBounds[1][0] && relativeCenter[1] >= allowedBounds[0][1] && relativeCenter[1] <= allowedBounds[1][1];
        if (relativeCenterAllowed && zoom != null) { state.pendingSelection = null; state.map.setView(relativeCenter, Math.max(state.map.getMinZoom(), Math.min(state.map.getMaxZoom(), zoom)), { animate: false }); }
        else if (x != null && z != null) {
            const coord = latlng(state, { x, z });
            if (coord) { state.pendingSelection = null; state.map.setView(coord, global.innerWidth <= 700 ? -1 : 0, { animate: false }); }
            else notice(state, text('Les coordonnées X/Z ne sont pas calibrées pour ce palier.', 'X/Z coordinates are not calibrated for this floor.'));
        } else if (params.has('x') || params.has('y')) notice(state, text('Les coordonnées de ce lien sont invalides.', 'The coordinates in this link are invalid.'));
        else if (saved) state.map.setView([saved.lat, saved.lng], Math.max(state.map.getMinZoom(), Math.min(state.map.getMaxZoom(), saved.zoom)), { animate: false });
        if (params.has('q')) { state.ui.search.value = params.get('q').slice(0, 200); renderSearch(state); }
    }
    async function reloadOverrides(state) {
        const generation = ++state.overrideGeneration; const db = client();
        if (!db) { state.overridesStatus = 'archive'; state.overrides = []; applyOverrides(state); renderFilters(state); renderMarkers(state); return { status: 'archive', records: [] }; }
        try {
            const response = await db.rpc('read_map_marker_overrides');
            if (!valid(state) || generation !== state.overrideGeneration) return { status: 'stale' };
            if (response.error) throw response.error;
            const records = Array.isArray(response.data) ? response.data : response.data?.records || [];
            if (state.overridesStatus === 'error' && state.floor !== 3) notice(state, '');
            state.overridesStatus = 'ready'; state.overrides = records; lastGoodOverrides = records;
        } catch (error) {
            if (!valid(state) || generation !== state.overrideGeneration) return { status: 'stale' };
            const missing = error?.code === 'PGRST202' || /could not find.*function|function.*does not exist/i.test(error?.message || '');
            state.overridesStatus = missing ? 'archive' : 'error'; state.overrides = missing ? [] : lastGoodOverrides || [];
            if (!missing) notice(state, text('Les modifications de repères sont indisponibles. Réessayez dans quelques instants.', 'Marker updates are unavailable. Please try again shortly.'));
        }
        applyOverrides(state); renderFilters(state); renderMarkers(state); renderPlaces(state);
        if (state.selected && state.data?.entities[state.selected]) renderPanel(state, state.data.entities[state.selected]);
        if (state.pendingSelection && state.pendingSelection.intent === state.intent && state.pendingSelection.key === state.selected) {
            const target = targetPosition(state, state.data?.entities[state.selected]);
            if (target.position) state.map.setView(target.position, Math.max(state.map.getMinZoom(), Math.min(state.map.getMaxZoom(), global.innerWidth <= 700 ? -1 : 0)), { animate: false });
            state.pendingSelection = null;
        }
        emit(state, 'overrides', { status: state.overridesStatus, records: state.overrides });
        return { status: state.overridesStatus, records: state.overrides };
    }
    async function adminCheck(state) {
        const generation = ++state.authGeneration; const db = client();
        global.NamelessMapAdmin?.destroy?.(); state.bridge?.setEditorMode(false);
        if (state.ui.admin) { state.ui.admin.hidden = true; state.ui.admin.open = false; }
        if (!db?.auth?.getUser) return;
        try {
            const user = await db.auth.getUser(); if (!valid(state) || generation !== state.authGeneration || user.error || !user.data?.user) return;
            const role = await db.rpc('current_user_role'); if (!valid(state) || generation !== state.authGeneration || role.error || role.data !== 'admin') return;
            if (!global.NamelessMapAdmin) {
                if (!adminScriptPromise) adminScriptPromise = new Promise((resolve, reject) => {
                    const existing = document.querySelector('script[data-map-admin]');
                    if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
                    const script = node('script'); script.src = '/js/map-admin.js?v=20261008map2'; script.dataset.mapAdmin = 'true'; script.onload = resolve; script.onerror = () => { script.remove(); adminScriptPromise = null; reject(new Error('admin module')); }; document.head.append(script);
                });
                await adminScriptPromise;
            }
            if (!valid(state) || generation !== state.authGeneration) return;
            if (state.ui.admin) state.ui.admin.hidden = false;
            await global.NamelessMapAdmin?.init?.(state.bridge);
        } catch (_) { if (valid(state) && generation === state.authGeneration) notice(state, text('L’éditeur de carte ne peut pas être chargé.', 'The map editor could not be loaded.')); }
    }
    function setEditorMode(state, enabled) {
        state.editorMode = !!enabled; state.ui.workspace.classList.toggle('map-editor-active', state.editorMode); renderMarkers(state);
        emit(state, 'editor', state.editorMode);
    }
    async function fullscreen(state) {
        if (document.fullscreenElement === state.ui.workspace) { await document.exitFullscreen?.(); return; }
        if (state.ui.workspace.classList.contains('is-fullscreen')) { state.ui.workspace.classList.remove('is-fullscreen'); syncFullscreen(state); return; }
        try { if (state.ui.workspace.requestFullscreen) { await state.ui.workspace.requestFullscreen(); syncFullscreen(state); return; } } catch (_) { /* Fixed workspace fallback. */ }
        state.ui.workspace.classList.add('is-fullscreen'); syncFullscreen(state);
    }
    function syncFullscreen(state) {
        const enabled = document.fullscreenElement === state.ui.workspace || state.ui.workspace.classList.contains('is-fullscreen'); state.ui.fullscreen.setAttribute('aria-pressed', String(enabled));
        controlLabel(state.ui.fullscreen, enabled ? text('Quitter le plein écran', 'Exit fullscreen') : text('Plein écran', 'Fullscreen'), 'fullscreen'); state.map.invalidateSize?.({ pan: false });
    }
    function translateUi(state) {
        const pageTitle = state.root.querySelector('.map-title'); if (pageTitle) pageTitle.textContent = text('Carte d’Aincrad', 'Aincrad map');
        const subtitle = state.root.querySelector('.map-subtitle'); if (subtitle) subtitle.textContent = text('Explorez les paliers, découvrez les lieux et retrouvez les créatures, objets et donjons.', 'Explore the floors, discover places and find creatures, items and dungeons.');
        const breadcrumb = state.root.querySelector('.map-breadcrumb'); if (breadcrumb) { const home = node('a', '', text('Accueil', 'Home')); home.href = '/'; breadcrumb.replaceChildren(home, node('span', '', '›'), document.createTextNode(text('Carte', 'Map'))); }
        controlLabel(state.ui.recenter, text('Recentrer', 'Recenter'), 'recenter'); controlLabel(state.ui.share, text('Partager', 'Share'), 'share'); state.ui.close.textContent = text('Fermer', 'Close');
        state.ui.search.placeholder = text('Quête, PNJ, créature, lieu…', 'Quest, NPC, creature, place…'); state.ui.search.setAttribute('aria-label', text('Rechercher dans tous les paliers', 'Search all floors'));
        state.ui.expand.textContent = state.ui.panel.classList.contains('is-expanded') ? text('Voir moins', 'Show less') : text('Voir plus', 'Show more');
        state.ui.clear.setAttribute('aria-label', text('Effacer la recherche', 'Clear search')); state.ui.close.setAttribute('aria-label', text('Fermer les détails', 'Close details'));
        if (state.ui.previous) state.ui.previous.setAttribute('aria-label', text('Palier précédent', 'Previous floor'));
        if (state.ui.next) state.ui.next.setAttribute('aria-label', text('Palier suivant', 'Next floor'));
        if (state.ui.floorButtons) state.ui.floorButtons.setAttribute('aria-label', text('Choisir un palier', 'Choose a floor'));
        controlLabel(state.ui.filterToggle, text('Filtres', 'Filters'), 'filters');
        if (state.ui.filterReset) state.ui.filterReset.textContent = text('Réinitialiser', 'Reset');
        if (state.ui.filterEmpty) state.ui.filterEmpty.textContent = text('Aucun repère disponible.', 'No markers available.');
        if (state.ui.filterRail) { state.ui.filterRail.setAttribute('aria-label', text('Filtres de la carte', 'Map filters')); state.ui.filterRail.querySelector('h2').textContent = text('Filtres', 'Filters'); }
        if (state.ui.admin) state.ui.admin.querySelector('summary').textContent = text('Édition de la carte', 'Map editor');
        for (const [id, fr, en] of [['map-display-markers', 'Marqueurs', 'Markers'], ['map-display-names', 'Noms des lieux', 'Place names']]) { const input = state.root.querySelector('#' + id); if (input?.nextElementSibling) input.nextElementSibling.textContent = text(fr, en); }
        const displayLegend = state.root.querySelector('.map-display-options legend'); if (displayLegend) displayLegend.textContent = text('Affichage', 'Display');
        if (state.ui.legendOpen) state.ui.legendOpen.textContent = text('◇ Légende de la carte', '◇ Map legend');
        if (state.ui.legendTitle) state.ui.legendTitle.textContent = text('Légende de la carte', 'Map legend');
        if (state.ui.legendClose) state.ui.legendClose.setAttribute('aria-label', text('Fermer la légende', 'Close legend'));
        if (state.ui.placesDescription) state.ui.placesDescription.textContent = text('Découvrez les lieux connus de ce palier et préparez votre exploration.', 'Discover the documented places on this floor and plan your exploration.');
        for (const option of state.ui.floor.options) option.textContent = text('Palier ', 'Floor ') + option.value;
        syncFloorControls(state); syncFilterDrawer(state); syncFullscreen(state); renderFilters(state); renderMarkers(state); renderSearch(state); renderPlaces(state);
        if (state.selected && state.data?.entities[state.selected]) renderPanel(state, state.data.entities[state.selected]);
        else if (state.choiceKeys) showChoices(state, state.choiceKeys.map(key => state.data.entities[key]).filter(Boolean));
    }
    function wire(state) {
        const ui = state.ui;
        listen(state, ui.search, 'input', () => renderSearch(state));
        listen(state, ui.search, 'keydown', event => { if (event.key === 'ArrowDown' && !ui.results.hidden) { event.preventDefault(); ui.results.querySelector('button')?.focus(); } });
        listen(state, ui.results, 'keydown', event => {
            const buttons = [...ui.results.querySelectorAll('button')]; const index = buttons.indexOf(document.activeElement);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
        });
        listen(state, ui.clear, 'click', () => { ui.search.value = ''; renderSearch(state); ui.search.focus(); });
        listen(state, document, 'pointerdown', event => { if (!ui.search.closest('.map-search-container').contains(event.target)) hideSearch(state); });
        listen(state, ui.floor, 'change', () => chooseFloor(state, Number(ui.floor.value)));
        const adjacentFloor = direction => { const floors = state.catalog?.floors || []; const index = floors.findIndex(floor => Number(floor.id) === state.floor); const next = floors[index + direction]; if (next) chooseFloor(state, Number(next.id)); };
        listen(state, ui.previous, 'click', () => adjacentFloor(-1)); listen(state, ui.next, 'click', () => adjacentFloor(1));
        listen(state, ui.floorButtons, 'keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !event.target.matches('button[data-floor]')) return;
            const buttons = [...ui.floorButtons.querySelectorAll('button')]; const index = buttons.indexOf(event.target);
            const target = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) : buttons[index + (event.key === 'ArrowRight' ? 1 : -1)];
            event.preventDefault(); if (target) { target.focus(); target.click(); }
        });
        listen(state, ui.filterToggle, 'click', () => { state.filtersOpen = !state.filtersOpen; syncFilterDrawer(state); });
        listen(state, ui.filterReset, 'click', () => { for (const type of state.filters.keys()) state.filters.set(type, !type.startsWith('quest-')); if (ui.displayMarkers) ui.displayMarkers.checked = true; if (ui.displayNames) ui.displayNames.checked = true; state.root.classList.remove('map-hide-markers', 'map-hide-names'); renderFilters(state); renderMarkers(state); });
        listen(state, ui.displayMarkers, 'change', () => state.root.classList.toggle('map-hide-markers', !ui.displayMarkers.checked));
        listen(state, ui.displayNames, 'change', () => state.root.classList.toggle('map-hide-names', !ui.displayNames.checked));
        listen(state, ui.placesToggle, 'click', () => { state.showAllPlaces = !state.showAllPlaces; renderPlaces(state); });
        listen(state, ui.legendOpen, 'click', () => {
            if (!ui.legend || !ui.legendContent) return; ui.legendContent.replaceChildren();
            const types = [...new Set((state.data?.points || []).map(key => state.data.entities[key]?.markerType).filter(type => Object.hasOwn(GLYPHS, type)))];
            for (const type of types) { const row = node('div', 'map-legend-row'); const glyph = node('span'); glyph.setAttribute('aria-hidden', 'true'); glyph.innerHTML = '<svg viewBox="0 0 24 24">' + GLYPHS[type] + '</svg>'; row.append(glyph, node('span', '', typeLabel(type))); ui.legendContent.append(row); }
            if (!types.length) ui.legendContent.append(node('p', '', text('Aucun repère calibré sur ce palier.', 'No calibrated markers on this floor.')));
            ui.legend.showModal?.();
        });
        listen(state, ui.legendClose, 'click', () => ui.legend?.close?.());
        listen(state, ui.legend, 'close', () => ui.legendOpen?.focus());
        listen(state, ui.recenter, 'click', () => recenter(state)); listen(state, ui.fullscreen, 'click', () => fullscreen(state));
        listen(state, ui.close, 'click', () => closePanel(state));
        listen(state, ui.expand, 'click', () => { const enabled = ui.panel.classList.toggle('is-expanded'); ui.expand.setAttribute('aria-expanded', String(enabled)); ui.expand.textContent = enabled ? text('Voir moins', 'Show less') : text('Voir plus', 'Show more'); });
        listen(state, ui.share, 'click', async () => {
            updateUrl(state, state.selected, true, true);
            try { await global.navigator.clipboard.writeText(global.location.href); notice(state, text('Lien de la carte copié.', 'Map link copied.')); }
            catch (_) { notice(state, text('Le lien à partager est dans la barre d’adresse.', 'The share link is in the address bar.')); }
        });
        listen(state, ui.map, 'keydown', event => { if (event.key === '0' && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') && !event.target.matches('input, textarea, select')) { event.preventDefault(); recenter(state); } });
        listen(state, document, 'keydown', event => {
            if (event.key !== 'Escape' || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
            if (!ui.results.hidden) { hideSearch(state); ui.search.focus(); }
            else if (state.filtersOpen) { state.filtersOpen = false; syncFilterDrawer(state); ui.filterToggle?.focus(); }
            else if (ui.workspace.classList.contains('is-fullscreen')) { ui.workspace.classList.remove('is-fullscreen'); syncFullscreen(state); }
            else if (ui.panel.classList.contains('is-expanded')) { ui.panel.classList.remove('is-expanded'); ui.expand.setAttribute('aria-expanded', 'false'); ui.expand.textContent = text('Voir plus', 'Show more'); }
            else if (!ui.panel.hidden && ui.workspace.contains(event.target)) { closePanel(state); ui.map.focus(); }
        });
        listen(state, document, 'fullscreenchange', () => syncFullscreen(state));
        listen(state, global, 'resize', () => { syncFilterDrawer(state); state.map.invalidateSize?.({ pan: false }); });
        listen(state, global, 'popstate', () => applyRoute(state)); listen(state, document, 'nameless:routechange', () => applyRoute(state));
        listen(state, document, 'nameless:languagechange', () => translateUi(state));
        listen(state, document, 'nameless:auth-changed', () => { reloadOverrides(state); adminCheck(state); });
        state.map.on('moveend', () => saveState(state)); state.map.on('zoomend', () => { state.detailCheck?.(); renderMarkers(state); saveState(state); });
        state.map.on('click', event => { if (state.editorMode) emit(state, 'click', { latlng: event.latlng, relative: relative(state, event.latlng) }); });
    }
    async function chooseFloor(state, id) {
        if (!configOf(state, id) || !valid(state) || (state.floor === id && state.data)) return;
        ++state.intent; hideSearch(state); state.ui.search.value = ''; state.ui.clear.style.display = 'none'; closePanel(state, false); state.filtersOpen = false; syncFilterDrawer(state);
        updateUrlForFloor(state, id); await changeFloor(state, id);
    }
    function updateUrlForFloor(state, id) { const previous = state.floor; state.floor = id; updateUrl(state, null); state.floor = previous; }
    async function init(root) {
        const container = (root?.querySelector ? root : document).querySelector('#game-map') || (root?.id === 'game-map' ? root : null);
        if (!container || !global.L) return null;
        if (active?.ui.map === container && valid(active)) return active.ready;
        destroy();
        const main = container.closest('main') || root || document;
        const query = id => main.querySelector('#' + id);
        const state = { controller: new AbortController(), ui: { map: container, workspace: query('map-workspace'), floor: query('floor-select'), floorTitle: query('map-floor-title'), floorButtons: query('map-floor-buttons'), previous: query('map-floor-previous'), next: query('map-floor-next'), search: query('map-search-input'), results: query('map-search-results'), clear: query('map-search-clear'), filters: query('map-filters'), filterRail: query('map-filter-rail'), filterToggle: query('map-filters-toggle'), filterReset: query('map-filters-reset'), filterEmpty: query('map-filters-empty'), status: query('map-route-status'), panel: query('map-panel'), content: query('map-panel-content'), expand: query('map-panel-expand'), close: query('map-panel-close'), recenter: query('map-recenter'), fullscreen: query('map-fullscreen'), share: query('map-share'), admin: query('map-admin-tools'), displayMarkers: query('map-display-markers'), displayNames: query('map-display-names'), legend: query('map-legend'), legendOpen: query('map-legend-open'), legendClose: query('map-legend-close'), legendTitle: query('map-legend-title'), legendContent: query('map-legend-content'), places: query('map-places'), placesList: query('map-places-list'), placesTitle: query('map-places-title'), placesToggle: query('map-places-toggle'), placesDescription: query('map-places-description') },
            root: main, floor: 1, data: null, rawData: null, catalog: null, filters: new Map(), filtersOpen: false, markers: new Map(), selected: null, intent: 0, floorGeneration: 0, overlayGeneration: 0, overrideGeneration: 0, authGeneration: 0, overlays: [], fullImages: new Map(), overrides: [], overridesStatus: 'pending', editorMode: false, events: new Map(), lastRoute: null };
        active = state;
        state.map = global.L.map(container, { crs: global.L.CRS.Simple, minZoom: -5, maxZoom: 3, zoom: -3, center: [2560, 2560], zoomControl: true, attributionControl: false, keyboard: true, zoomSnap: .25, zoomDelta: .5, maxBoundsViscosity: .5 });
        state.markerLayer = global.L.layerGroup().addTo(state.map);
        state.bridge = { map: state.map, root: main, signal: state.controller.signal, catalog: null,
            getFloor: () => state.floor, getData: () => state.data, getOverridesStatus: () => state.overridesStatus, selectEntity: key => selectEntity(state, key), notice: message => notice(state, message), reloadOverrides: () => reloadOverrides(state), setEditorMode: enabled => setEditorMode(state, enabled), getRelative: value => relative(state, value),
            getLatLng: value => value && finite(value.u, 1) && finite(value.v, 1) && value.u >= 0 && value.v >= 0 ? latlng(state, value) : null,
            on: (event, fn) => { if (!state.events.has(event)) state.events.set(event, new Set()); state.events.get(event).add(fn); return () => state.events.get(event)?.delete(fn); } };
        api.active = state.bridge; wire(state); translateUi(state);
        state.ready = (async () => {
            try {
                const catalog = await getCatalog(); if (!valid(state)) return null;
                state.catalog = catalog; state.bridge.catalog = catalog; renderFloorControls(state);
                await Promise.all([applyRoute(state, true), reloadOverrides(state)]); if (!valid(state)) return null;
                if (!state.selected) { const place = Object.values(state.data?.entities || {}).find(entity => entity.kind === 'location' && targetPosition(state, entity).position); if (place) await selectEntity(state, place.key, { center: false, url: false }); }
                adminCheck(state); return state.bridge;
            } catch (_) { if (valid(state)) notice(state, text('La carte ne peut pas être chargée. Réessayez.', 'The map could not be loaded. Please try again.')); return null; }
        })();
        return state.ready;
    }
    function destroy() {
        const state = active; if (!state) return;
        active = null; api.active = null; state.controller.abort(); state.intent++; state.floorGeneration++; state.authGeneration++;
        state.floorAnimation?.cancel(); state.floorAnimation = null; state.ui.legend?.close?.();
        global.NamelessMapAdmin?.destroy?.();
        if (document.fullscreenElement === state.ui.workspace) document.exitFullscreen?.().catch?.(() => {});
        state.ui.workspace?.classList.remove('is-fullscreen'); state.filtersOpen = false; syncFilterDrawer(state); clearOverlays(state); clearMarkers(state);
        state.fullImages.forEach(record => { state.map.removeLayer(record.overlay); record.overlay.off?.(); }); state.fullImages.clear();
        state.map.remove(); state.map.off?.(); state.events.clear();
    }
    const api = global.NamelessMapPage = { init, destroy, active: null };
    function autoStart() { if (!global.NamelessSpaRouter?.controlsLifecycle) init(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoStart, { once: true }); else autoStart();
})(window);
