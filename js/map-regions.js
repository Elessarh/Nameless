/* Indicative region contours on the original atlas. Editing stays in this browser. */
(function (global) {
    'use strict';
    const STORAGE_KEY = 'nameless.map-regions.v1';
    const MAX_VERTICES = 96, MAX_REGIONS = 256, EPSILON = 1e-10;
    let active = null;
    const copy = value => JSON.parse(JSON.stringify(value));
    const english = () => global.NamelessI18n?.getLanguage?.() === 'en';
    const normalizeFilter = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const text = (fr, en) => english() ? en : fr;
    const reduced = () => !!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const position = value => !!value && typeof value.u === 'number' && typeof value.v === 'number'
        && Number.isFinite(value.u) && Number.isFinite(value.v) && value.u >= 0 && value.u <= 1 && value.v >= 0 && value.v <= 1;
    function node(tag, className, content) {
        const result = document.createElement(tag);
        if (className) result.className = className;
        if (content != null) result.textContent = String(content);
        return result;
    }
    function cross(a, b, c) { return (b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u); }
    function onSegment(a, b, p) {
        return Math.abs(cross(a, b, p)) <= EPSILON && p.u >= Math.min(a.u, b.u) - EPSILON
            && p.u <= Math.max(a.u, b.u) + EPSILON && p.v >= Math.min(a.v, b.v) - EPSILON && p.v <= Math.max(a.v, b.v) + EPSILON;
    }
    function intersects(a, b, c, d) {
        const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
        return ((abC > EPSILON && abD < -EPSILON || abC < -EPSILON && abD > EPSILON)
            && (cdA > EPSILON && cdB < -EPSILON || cdA < -EPSILON && cdB > EPSILON))
            || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
    }
    function validateVertices(vertices) {
        if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > MAX_VERTICES) throw new Error('vertices_count');
        if (vertices.some(value => !position(value))) throw new Error('vertices_bounds');
        if (new Set(vertices.map(value => value.u + ':' + value.v)).size !== vertices.length) throw new Error('vertices_duplicate');
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const next = (i + 1) % vertices.length;
            area += vertices[i].u * vertices[next].v - vertices[next].u * vertices[i].v;
            for (let j = i + 1; j < vertices.length; j++) {
                const after = (j + 1) % vertices.length;
                if (next === j || after === i) continue;
                if (intersects(vertices[i], vertices[next], vertices[j], vertices[after])) throw new Error('vertices_intersection');
            }
        }
        if (Math.abs(area) <= EPSILON) throw new Error('vertices_area');
        // Adjacent edges cannot fold back over one another, even in a nonzero-area outline.
        for (let i = 0; i < vertices.length; i++) {
            const previous = vertices[(i + vertices.length - 1) % vertices.length], current = vertices[i], next = vertices[(i + 1) % vertices.length];
            if (Math.abs(cross(previous, current, next)) <= EPSILON && onSegment(previous, current, next)) throw new Error('vertices_intersection');
        }
        return vertices.map(({ u, v }) => ({ u, v }));
    }
    function containsPoint(vertices, point) {
        if (!position(point) || !Array.isArray(vertices) || vertices.length < 3) return false;
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const a = vertices[i], b = vertices[j];
            if (onSegment(a, b, point)) return true;
            if ((a.v > point.v) !== (b.v > point.v) && point.u < (b.u - a.u) * (point.v - a.v) / (b.v - a.v) + a.u) inside = !inside;
        }
        return inside;
    }
    function cleanString(value, limit, required = true) {
        if (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f]/.test(value) || required && !value.trim()) throw new Error('invalid_text');
        return value.trim();
    }
    function guardObject(value, depth = 0) {
        if (depth > 8) throw new Error('invalid_document');
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('invalid_document');
            guardObject(value[key], depth + 1);
        }
    }
    function localUrl(value) {
        if (!value) return null;
        if (typeof value !== 'string' || value.length > 512 || !value.startsWith('/') || value.startsWith('//')) throw new Error('invalid_link');
        const url = new URL(value, global.location.href);
        if (url.origin !== global.location.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('invalid_link');
        return url.pathname + url.search + url.hash;
    }
    function imageIdentity(floor) { return floor?.originalImage || floor?.image; }
    function validateDocument(value, catalog) {
        guardObject(value);
        if (!value || value.schemaVersion !== 1 || value.coordinateSystem !== 'image-relative-top-left'
            || !Array.isArray(value.floors) || value.floors.length > (catalog?.floors?.length || 0)) throw new Error('invalid_document');
        const seenFloors = new Set(), seenIds = new Set(); let count = 0;
        const floors = value.floors.map(floor => {
            if (!Number.isInteger(floor.floor) || seenFloors.has(floor.floor)) throw new Error('invalid_floor');
            const native = catalog.floors.find(item => Number(item.id) === floor.floor);
            if (!native || floor.imageId !== imageIdentity(native)) throw new Error('atlas_identity');
            seenFloors.add(floor.floor);
            if (!Array.isArray(floor.regions)) throw new Error('invalid_document');
            const seenEntities = new Set();
            const regions = floor.regions.map(region => {
                if (++count > MAX_REGIONS || !region || typeof region !== 'object') throw new Error('regions_count');
                const id = cleanString(region.id, 100);
                if (!/^[a-zA-Z0-9:_-]+$/.test(id) || seenIds.has(id)) throw new Error('invalid_id');
                seenIds.add(id);
                const entityKey = region.entityKey == null || region.entityKey === '' ? null : cleanString(region.entityKey, 180);
                if (entityKey) {
                    const entity = catalog.index?.find(item => item.key === entityKey && Number(item.floor) === floor.floor && item.kind === 'location' && item.markerType === 'zone');
                    if (!entity || seenEntities.has(entityKey)) throw new Error('invalid_entity');
                    seenEntities.add(entityKey);
                }
                if (!['indicative', 'verified', 'draft'].includes(region.status)) throw new Error('invalid_status');
                const result = { id, entityKey, title: cleanString(region.title, 120), status: region.status, vertices: validateVertices(region.vertices) };
                if (region.baseRevision != null) {
                    if (!Number.isInteger(region.baseRevision) || region.baseRevision < 0) throw new Error('invalid_document');
                    result.baseRevision = region.baseRevision;
                }
                if (region.titleEn != null) result.titleEn = cleanString(region.titleEn, 120);
                if (region.wikiUrl) result.wikiUrl = localUrl(region.wikiUrl);
                return result;
            });
            return { floor: floor.floor, imageId: imageIdentity(native), regions };
        });
        return { schemaVersion: 1, coordinateSystem: 'image-relative-top-left', floors };
    }
    function createHistory(initial) {
        let frames = [copy(initial)], index = 0;
        return {
            push(value) {
                const cloned = copy(value);
                if (JSON.stringify(frames[index]) === JSON.stringify(cloned)) return false;
                frames = frames.slice(0, index + 1); frames.push(cloned);
                if (frames.length > 100) frames.shift(); index = frames.length - 1; return true;
            },
            undo() { if (index > 0) index--; return copy(frames[index]); },
            redo() { if (index < frames.length - 1) index++; return copy(frames[index]); },
            get canUndo() { return index > 0; }, get canRedo() { return index < frames.length - 1; }
        };
    }
    function alive(state) { return active === state && !state.controller.signal.aborted && !state.bridge.signal?.aborted; }
    function floorReady(state) {
        return alive(state) && state.loaded && !state.floorPending && state.floor === Number(state.bridge.getFloor())
            && Number(state.bridge.getData()?.floor) === state.floor;
    }
    function listen(state, element, event, handler) { element?.addEventListener(event, handler, { signal: state.controller.signal }); }
    function listenEditor(state, element, event, handler) { element?.addEventListener(event, handler, { signal: state.editorController.signal }); }
    function register(state, event, handler) { const off = state.bridge.on?.(event, handler); if (off) state.off.push(off); }
    function message(state, fr, en) { if (state.ui.message) state.ui.message.textContent = text(fr, en); }
    function errorMessage(state, error) {
        const messages = {
            vertices_count: ['Le contour nécessite 3 à 96 sommets.', 'The outline needs 3 to 96 vertices.'],
            vertices_bounds: ['Tous les sommets doivent rester dans l’image de la carte.', 'Every vertex must stay inside the map image.'],
            vertices_duplicate: ['Deux sommets sont au même endroit.', 'Two vertices occupy the same position.'],
            vertices_intersection: ['Le contour se croise. Déplacez ou supprimez les sommets concernés.', 'The outline crosses itself. Move or remove the affected vertices.'],
            vertices_area: ['Le contour doit délimiter une surface.', 'The outline must enclose an area.'],
            atlas_identity: ['Ce fichier correspond à une autre image de carte.', 'This file belongs to a different map image.'],
            invalid_entity: ['Une zone liée est inconnue, en double ou appartient à un autre palier.', 'A linked zone is unknown, duplicated or belongs to another floor.'],
            invalid_status: ['Les contours importés doivent être indicatifs.', 'Imported outlines must be indicative.'],
            invalid_text: ['Donnez un nom à la zone (120 caractères maximum).', 'Give the zone a name (120 characters maximum).']
        };
        const content = messages[error?.message] || ['Fichier ou contour invalide. Aucune modification importée.', 'Invalid file or outline. No changes were imported.'];
        message(state, ...content);
    }
    function label(region) { return english() && region.titleEn ? region.titleEn : region.title; }
    function records(state, floor = state.floor) {
        if (state.remoteStatus === 'error' && state.bridge.canEditRegions?.() !== true) return [];
        const base = state.base?.floors.find(item => item.floor === floor)?.regions || [];
        const local = state.local?.floors.find(item => item.floor === floor)?.regions || [];
        const merged = new Map(base.map(region => [region.id, { ...region, local: false }]));
        for (const row of state.remote || []) {
            if (Number(row.floor) !== floor) continue;
            const old = [...merged.values()].find(region => region.entityKey === row.entity_key);
            if (old) merged.delete(old.id);
            if (row.visible !== true || !['indicative', 'verified'].includes(row.status)) continue;
            const entity = state.bridge.catalog.index.find(item => item.key === row.entity_key);
            try {
                const region = { ...(old || {}), id: row.region_id, entityKey: row.entity_key, title: old?.title || entity?.title,
                    titleEn: old?.titleEn || entity?.titleEn, status: row.status, vertices: validateVertices(row.vertices), published: true };
                if (entity && row.image_id === imageIdentity(state.bridge.catalog.floors.find(item => Number(item.id) === floor))) merged.set(region.id, region);
            } catch (_) { /* Malformed shared contours are not displayed. */ }
        }
        if (state.bridge.canEditRegions?.() === true) for (const region of state.workspaceRegions || []) {
            if (region.floor !== floor) continue;
            const old = [...merged.values()].find(item => item.entityKey === region.entityKey);
            if (old) merged.delete(old.id);
            merged.set(region.id, region);
        }
        for (const region of local) merged.set(region.id, { ...region, local: true });
        return [...merged.values()];
    }
    function available(state, region) {
        if (!region.entityKey) return true;
        if (['pending', 'error'].includes(state.bridge.getOverridesStatus?.())) return false;
        const entity = state.bridge.getData()?.entities?.[region.entityKey];
        return !!entity && !['hidden', 'deleted', 'unavailable'].includes(entity.overrideState);
    }
    function selectionStyle(state, region, hover = false) {
        const selected = state.selected === region.id;
        return { color: selected || hover ? '#e6c185' : '#b5a07b', weight: selected ? 2.7 : hover ? 2 : 1.35,
            opacity: selected || hover ? 1 : .75, fillColor: selected || hover ? '#e6c185' : '#405d5a',
            fillOpacity: selected ? .17 : hover ? .13 : .025, dashArray: selected ? '7 4' : '5 6' };
    }
    function clearLayers(state) { state.layers.clearLayers?.(); state.polygons.clear(); }
    function syncSelection(state) {
        for (const [id, polygon] of state.polygons) {
            const region = records(state).find(item => item.id === id); if (region) polygon.setStyle?.(selectionStyle(state, region));
        }
        for (const button of state.ui.list?.querySelectorAll('[data-region-id]') || []) {
            const selected = button.dataset.regionId === state.selected;
            button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
        }
    }
    function renderPublic(state) {
        if (!alive(state)) return;
        state.publicController?.abort(); state.publicController = new AbortController();
        clearLayers(state); state.ui.list?.replaceChildren();
        if (state.ui.toggle?.matches('input[type="checkbox"]')) {
            state.ui.toggle.checked = state.shown; state.ui.toggle.removeAttribute('aria-pressed');
        } else state.ui.toggle?.setAttribute('aria-pressed', String(state.shown));
        if (state.ui.open) state.ui.open.disabled = !floorReady(state);
        if (!floorReady(state)) {
            if (state.ui.status) state.ui.status.textContent = text('Les contours seront disponibles lorsque ce palier sera chargé.', 'Outlines will be available when this floor has loaded.');
            return;
        }
        const all = records(state), visible = all.filter(region => available(state, region) && (!state.filter || normalizeFilter([region.title, region.titleEn].filter(Boolean).join(' ')).includes(state.filter)));
        for (const region of visible) {
            if (state.shown) {
                const coordinates = region.vertices.map(value => state.bridge.getLatLng(value));
                if (coordinates.some(value => !value)) continue;
                const polygon = global.L.polygon(coordinates, { pane: state.pane, bubblingMouseEvents: false, ...selectionStyle(state, region) }).addTo(state.layers);
                const tooltip = node('span', 'map-region-tooltip-name', label(region));
                tooltip.append(node('small', '', region.status === 'verified' ? text('Limites vérifiées', 'Verified boundaries') : text('Contour indicatif', 'Indicative outline') + (region.local ? text(' · brouillon local', ' · local draft') : '')));
                polygon.bindTooltip?.(tooltip, { sticky: true, direction: 'top', className: 'map-region-tooltip', opacity: 1 });
                polygon.on?.('mouseover', () => { if (!state.editing) polygon.setStyle(selectionStyle(state, region, true)); });
                polygon.on?.('mouseout', () => polygon.setStyle(selectionStyle(state, region)));
                polygon.on?.('click', () => { if (!state.editing) select(state, region.id); });
                polygon.getElement?.()?.setAttribute('aria-hidden', 'true');
                polygon.getElement?.()?.classList.add('map-region-outline');
                if (polygon.getElement?.()) polygon.getElement().dataset.regionId = region.id;
                if (state.editing && polygon.getElement?.()) polygon.getElement().style.pointerEvents = 'none';
                state.polygons.set(region.id, polygon);
            }
            const button = node('button', 'map-region-choice'); button.type = 'button'; button.dataset.regionId = region.id;
            button.append(node('span', '', label(region)), node('small', '', region.local ? text('Brouillon', 'Draft') : region.status === 'verified' ? text('Vérifié', 'Verified') : text('Indicatif', 'Indicative')));
            button.addEventListener('click', () => select(state, region.id), { signal: state.publicController.signal }); state.ui.list?.append(button);
        }
        if (state.ui.status) {
            state.ui.status.textContent = state.remoteStatus === 'error' ? text('Les dernières limites publiées ne sont pas disponibles. Réessayez.', 'The latest published boundaries are unavailable. Please retry.')
                : all.length ? text(visible.length + ' zones · sélectionnez un contour', visible.length + ' regions · select an outline')
                : text('Aucun contour proposé sur ce palier.', 'No outlines proposed on this floor.');
        }
        syncSelection(state);
    }
    function settleCamera(state) {
        if (state.zooming) return;
        const intent = state.pendingCamera; state.pendingCamera = null;
        if (!intent || !floorReady(state) || state.editing || state.floor !== intent.floor
            || state.selectionGeneration !== intent.generation) return;
        if (intent.type === 'view') {
            if (intent.href !== global.location.href) return;
            if (state.bridge.viewCamera) state.bridge.viewCamera(intent.center,intent.zoom,{animate:false});
            else { state.bridge.map.stop?.(); state.bridge.map.setView(intent.center,intent.zoom,{animate:false}); }
            return;
        }
        const region = records(state).find(item => item.id === intent.id);
        if (!region || state.selected !== intent.id || !available(state,region)) return;
        const options = { padding: global.innerWidth <= 768 ? [28, 28] : [48, 48], maxZoom: 0, animate: !reduced(), duration: .45 };
        if (state.bridge.fitCamera) state.bridge.fitCamera(intent.bounds, options);
        else { state.bridge.map.stop?.(); state.bridge.map.fitBounds(intent.bounds, options); }
    }
    function requestCamera(state, region, generation) {
        state.pendingCamera = { id:region.id, floor:state.floor, generation,
            bounds:global.L.latLngBounds(region.vertices.map(value => state.bridge.getLatLng(value))) };
        settleCamera(state);
    }
    function focusByEntity(state, key) {
        if (!floorReady(state) || state.editing) return false;
        const region = records(state).find(item => item.entityKey === key);
        if (!region || !available(state, region)) return false;
        state.selectionEntity = key; state.selected = region.id;
        const generation = ++state.selectionGeneration; syncSelection(state);
        requestCamera(state, region, generation); return true;
    }
    function restoreView(state,center,zoom) {
        if (!floorReady(state) || state.editing || !Array.isArray(center) || center.length !== 2
            || center.some(value => !Number.isFinite(value)) || !Number.isFinite(zoom)) return false;
        const native = state.bridge.catalog.floors.find(item => Number(item.id) === state.floor), bounds = native.maxBounds || native.bounds;
        if (center[0] < bounds[0][0] || center[0] > bounds[1][0] || center[1] < bounds[0][1] || center[1] > bounds[1][1]) return false;
        state.pendingCamera = {type:'view',center:[...center],zoom,href:global.location.href,floor:state.floor,generation:state.selectionGeneration};
        settleCamera(state); return true;
    }
    async function select(state, id, center = true) {
        if (!floorReady(state) || state.editing) return false;
        const region = records(state).find(item => item.id === id); if (!region || !available(state, region)) return false;
        const generation = ++state.selectionGeneration, floor = state.floor;
        state.selectionEntity = region.entityKey;
        state.selected = id; syncSelection(state);
        if (region.entityKey) await state.bridge.selectEntity(region.entityKey, { center: false });
        else state.bridge.showRegion?.(copy(region));
        if (!floorReady(state) || generation !== state.selectionGeneration || state.floor !== floor) return false;
        state.selected = id; syncSelection(state);
        if (center) requestCamera(state, region, generation);
        return true;
    }
    function blank(state) {
        return { id: 'local-' + (global.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)), entityKey: null,
            title: text('Nouvelle zone', 'New zone'), status: 'indicative', vertices: [] };
    }
    function cleanDraft(state) {
        if (!floorReady(state) || state.draftFloor !== state.floor) throw new Error('atlas_identity');
        const floor = { floor: state.floor, imageId: imageIdentity(state.bridge.catalog.floors.find(item => Number(item.id) === state.floor)), regions: [state.draft] };
        return validateDocument({ schemaVersion: 1, coordinateSystem: 'image-relative-top-left', floors: [floor] }, state.bridge.catalog).floors[0].regions[0];
    }
    function commitDraft(state, value, selectedVertex = state.vertex) {
        if (!floorReady(state) || state.draftFloor !== state.floor || state.bridge.canEditRegions?.() !== true) return;
        state.draft = copy(value); state.history.push(state.draft); state.vertex = selectedVertex;
        renderEditorState(state); renderDraft(state);
        changed(state);
    }
    function changed(state) {
        state.bridge.root?.dispatchEvent(new CustomEvent('nameless:region-draft', { detail: { draft: state.draft ? copy(state.draft) : null, floor: state.floor } }));
    }
    function syncFields(state) {
        state.ui.name.value = state.draft.title; state.ui.entity.value = state.draft.entityKey || '';
        state.ui.selector.value = state.draft.id;
    }
    function renderEditorState(state) {
        if (!state.editing) return;
        syncFields(state);
        const count = state.draft.vertices.length;
        state.ui.count.textContent = count + (count === 1 ? text(' point', ' point') : text(' points', ' points'));
        state.ui.vertex.textContent = state.vertex == null ? text('Sélectionnez un point sur la carte pour l’ajuster.', 'Select a point on the map to adjust it.')
            : text('Sommet ', 'Vertex ') + (state.vertex + 1) + ' / ' + count;
        state.ui.instructions.textContent = state.mode === 'draw'
            ? count < 3
                ? text('Cliquez sur la carte pour placer les points du contour. Trois points minimum.', 'Click the map to place the outline points. At least three are needed.')
                : text('Continuez à placer des points ou fermez le contour pour l’ajuster.', 'Continue placing points or close the outline to adjust it.')
            : text('Déplacez les points sur la carte. Les flèches du clavier permettent un ajustement précis.', 'Drag points on the map. Arrow keys allow precise adjustments.');
        for (const button of state.ui.host.querySelectorAll('[data-region-action]')) {
            const action = button.dataset.regionAction;
            button.classList.toggle('is-active', action === state.mode);
            if (['draw', 'edit'].includes(action)) button.setAttribute('aria-pressed', String(action === state.mode));
            if (action === 'undo') button.disabled = !state.history.canUndo;
            else if (action === 'redo') button.disabled = !state.history.canRedo;
            else if (action === 'delete-vertex') button.disabled = state.mode !== 'edit' || count <= 3 || state.vertex == null;
            else if (action === 'add-vertex') button.disabled = state.mode !== 'edit' || count < 2 || count >= MAX_VERTICES || state.vertex == null;
            else if (action === 'finish') { button.hidden = state.mode !== 'draw'; button.disabled = state.mode !== 'draw' || count < 3; }
            else if (action === 'edit') button.disabled = count < 3;
            else if (action === 'save') button.disabled = state.mode !== 'edit' || count < 3;
            else if (action === 'clear') button.disabled = count === 0;
        }
        state.ui.finishControls.hidden = state.mode !== 'draw';
        state.ui.vertexTools.hidden = state.mode !== 'edit' || state.vertex == null;
        state.ui.vertex.hidden = state.mode !== 'edit';
        state.ui.host.dataset.mode = state.mode;
    }
    function clearDraftLayers(state) {
        state.handleController?.abort(); state.handleController = new AbortController();
        for (const marker of state.handles) marker.off?.();
        state.handles = []; state.editLayers.clearLayers?.();
    }
    function changeVertex(state, index, point, focus = false) {
        if (!floorReady(state) || state.draftFloor !== state.floor || state.mode !== 'edit') return false;
        if (!position(point)) { errorMessage(state, new Error('vertices_bounds')); renderDraft(state); return false; }
        const draft = copy(state.draft); draft.vertices[index] = { u: point.u, v: point.v };
        commitDraft(state, draft, index);
        if (focus) state.handles[index]?.getElement?.()?.focus();
        return true;
    }
    function renderDraft(state) {
        clearDraftLayers(state); if (!state.editing || !floorReady(state) || state.draftFloor !== state.floor) return;
        const points = state.draft.vertices.map(value => state.bridge.getLatLng(value));
        if (points.length >= 2) {
            const draw = state.mode === 'draw' ? global.L.polyline : global.L.polygon;
            draw(points, { pane: state.editPane, color: '#f4d39a', weight: 2.5, opacity: 1, fillOpacity: .1, dashArray: state.mode === 'draw' ? '5 4' : null, interactive: false }).addTo(state.editLayers);
        }
        state.draft.vertices.forEach((point, index) => {
            const icon = global.L.divIcon({ className: 'map-region-vertex' + (index === state.vertex ? ' is-selected' : ''),
                html: '<span aria-hidden="true">' + (index + 1) + '</span>', iconSize: [44, 44], iconAnchor: [22, 22] });
            const marker = global.L.marker(state.bridge.getLatLng(point), { icon, pane: state.editPane, draggable: state.mode === 'edit', keyboard: true,
                title: text('Sommet ', 'Vertex ') + (index + 1), bubblingMouseEvents: false }).addTo(state.editLayers);
            marker.on?.('click', () => { state.vertex = index; renderEditorState(state); for (let i = 0; i < state.handles.length; i++) state.handles[i].getElement?.()?.classList.toggle('is-selected', i === index); });
            marker.on?.('dragend', () => changeVertex(state, index, state.bridge.getRelative(marker.getLatLng())));
            const element = marker.getElement?.();
            if (element) {
                element.setAttribute('aria-label', text('Sommet ', 'Vertex ') + (index + 1) + text(' ; flèches pour déplacer', '; arrow keys to move'));
                element.setAttribute('role', 'button'); element.tabIndex = 0;
                element.addEventListener('keydown', event => {
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                        event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? .0001 : .001;
                        const moved = { ...state.draft.vertices[index] };
                        moved.u += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
                        moved.v += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
                        changeVertex(state, index, moved, true);
                    } else if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault(); event.stopPropagation(); state.vertex = index; deleteVertex(state);
                    }
                }, { signal: state.handleController.signal });
            }
            state.handles.push(marker);
        });
    }
    function addPoint(state, point) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor || state.mode !== 'draw') return;
        if (!position(point)) { errorMessage(state, new Error('vertices_bounds')); return; }
        if (state.draft.vertices.length >= MAX_VERTICES) { errorMessage(state, new Error('vertices_count')); return; }
        const draft = copy(state.draft); draft.vertices.push({ u: point.u, v: point.v });
        commitDraft(state, draft, draft.vertices.length - 1);
        message(state, draft.vertices.length + ' sommets placés.', draft.vertices.length + ' vertices placed.');
    }
    function addVertex(state) {
        if (!floorReady(state) || state.draftFloor !== state.floor || state.mode !== 'edit') return false;
        const points = state.draft.vertices, index = state.vertex;
        if (index == null || points.length < 2 || points.length >= MAX_VERTICES) return false;
        const next = points[(index + 1) % points.length];
        const draft = copy(state.draft); draft.vertices.splice(index + 1, 0, { u: (points[index].u + next.u) / 2, v: (points[index].v + next.v) / 2 });
        commitDraft(state, draft, index + 1); state.handles[index + 1]?.getElement?.()?.focus(); return true;
    }
    function deleteVertex(state) {
        if (!floorReady(state) || state.draftFloor !== state.floor || state.mode !== 'edit') return false;
        if (state.vertex == null || state.draft.vertices.length <= 3) return false;
        const draft = copy(state.draft); draft.vertices.splice(state.vertex, 1);
        commitDraft(state, draft, Math.min(state.vertex, draft.vertices.length - 1));
        state.handles[state.vertex]?.getElement?.()?.focus(); return true;
    }
    function mode(state, value) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor || !['draw', 'edit'].includes(value)) return false;
        if (value === 'edit') { try { cleanDraft(state); } catch (error) { errorMessage(state, error); return false; } }
        state.mode = value; renderEditorState(state); renderDraft(state); return true;
    }
    function finish(state) {
        if (state.mode !== 'draw') return false;
        if (!mode(state, 'edit')) return false;
        message(state, 'Tracé fermé. Vérifiez les limites puis enregistrez dans ce navigateur.', 'Outline closed. Check the boundaries, then save in this browser.'); return true;
    }
    function emptyDocument() { return { schemaVersion: 1, coordinateSystem: 'image-relative-top-left', floors: [] }; }
    function save(state) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor || state.bridge.canEditRegions?.() !== true) return false;
        try {
            const draft = cleanDraft(state), local = copy(state.local || emptyDocument());
            const revision = state.bridge.getRegionRevision?.(draft.entityKey);
            if (Number.isInteger(revision) && revision >= 0) draft.baseRevision = revision;
            let floor = local.floors.find(item => item.floor === state.floor);
            if (!floor) { floor = { floor: state.floor, imageId: imageIdentity(state.bridge.catalog.floors.find(item => Number(item.id) === state.floor)), regions: [] }; local.floors.push(floor); }
            // A linked region has one outline: local edits replace the original rather than creating duplicates.
            if (draft.entityKey) {
                const base = records(state).find(region => region.entityKey === draft.entityKey);
                if (base && base.id !== draft.id) draft.id = base.id;
            }
            floor.regions = floor.regions.filter(region => region.id !== draft.id && (!draft.entityKey || region.entityKey !== draft.entityKey));
            floor.regions.push(draft);
            const validated = validateDocument(local, state.bridge.catalog);
            global.localStorage.setItem(state.bridge.getRegionDraftKey?.() || STORAGE_KEY, JSON.stringify(validated));
            state.local = validated; state.draft = copy(draft); state.selected = draft.id;
            state.history = createHistory(draft); renderPublic(state); populateSelectors(state); renderEditorState(state); renderDraft(state);
            message(state, 'Contour indicatif enregistré dans ce navigateur uniquement.', 'Indicative outline saved in this browser only.'); return true;
        } catch (error) {
            if (error?.name === 'QuotaExceededError' || error?.name === 'SecurityError') message(state, 'Le navigateur ne permet pas l’enregistrement. Exportez le fichier JSON.', 'This browser cannot save locally. Export the JSON file.');
            else errorMessage(state, error); return false;
        }
    }
    function reset(state) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor || state.bridge.canEditRegions?.() !== true) return false;
        try {
            const local = copy(state.local || emptyDocument());
            const floor = local.floors.find(item => item.floor === state.floor);
            if (floor) floor.regions = floor.regions.filter(region => region.id !== state.draft?.id);
            local.floors = local.floors.filter(item => item.regions.length);
            global.localStorage.setItem(state.bridge.getRegionDraftKey?.() || STORAGE_KEY, JSON.stringify(local)); state.local = local;
            const base = records(state).find(region => region.id === state.draft?.id);
            state.draft = copy(base || blank(state)); state.history = createHistory(state.draft); state.vertex = null;
            state.mode = state.draft.vertices.length >= 3 ? 'edit' : 'draw';
            renderPublic(state); populateSelectors(state); renderEditorState(state); renderDraft(state); changed(state);
            message(state, 'La proposition d’origine est restaurée ; le contour local est retiré.', 'The original proposal is restored; the local outline was removed.'); return true;
        } catch (_) { message(state, 'La modification locale n’a pas pu être retirée.', 'The local edit could not be removed.'); return false; }
    }
    function importDocument(state, value) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor || state.bridge.canEditRegions?.() !== true) return false;
        try {
            const validated = validateDocument(value, state.bridge.catalog);
            // Stage imported contours; persistence remains an explicit Save action.
            state.imported = validated;
            const incoming = validated.floors.find(item => item.floor === state.floor)?.regions || [];
            if (!incoming.length) { message(state, 'Aucun contour de ce fichier ne concerne le palier affiché.', 'No outline in this file belongs to the displayed floor.'); return false; }
            state.draft = copy(incoming[0]); state.history = createHistory(state.draft); state.vertex = null; state.mode = 'edit';
            populateSelectors(state); renderEditorState(state); renderDraft(state); changed(state);
            message(state, incoming.length + ' contours importés pour révision. Choisissez un contour puis enregistrez-le localement.', incoming.length + ' outlines imported for review. Choose an outline, then save it locally.'); return true;
        } catch (error) { errorMessage(state, error); return false; }
    }
    function exportDocument(state) {
        if (!floorReady(state)) throw new Error('atlas_identity');
        const floors = state.bridge.catalog.floors.map(config => ({ floor: Number(config.id), imageId: imageIdentity(config), regions: records(state, Number(config.id)).map(({ local, ...region }) => copy(region)) })).filter(floor => floor.regions.length);
        if (state.editing && state.draft?.vertices.length) {
            const draft = cleanDraft(state);
            let floor = floors.find(item => item.floor === state.floor);
            if (!floor) { floor = { floor: state.floor, imageId: imageIdentity(state.bridge.catalog.floors.find(item => Number(item.id) === state.floor)), regions: [] }; floors.push(floor); }
            floor.regions = floor.regions.filter(region => region.id !== draft.id && (!draft.entityKey || region.entityKey !== draft.entityKey)); floor.regions.push(draft);
        }
        return validateDocument({ schemaVersion: 1, coordinateSystem: 'image-relative-top-left', floors }, state.bridge.catalog);
    }
    function download(state) {
        try {
            const data = exportDocument(state), url = global.URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
            const anchor = node('a'); anchor.href = url; anchor.download = 'nameless-contours-indicatifs.json'; document.body.append(anchor); anchor.click(); anchor.remove();
            global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
            message(state, 'Fichier exporté. Il contient des limites indicatives, sans publication.', 'File exported. It contains indicative boundaries and publishes nothing.');
        } catch (error) { errorMessage(state, error); }
    }
    function populateSelectors(state) {
        const merged = new Map(records(state).map(region => [region.id, region]));
        for (const region of state.imported?.floors.find(item => item.floor === state.floor)?.regions || []) merged.set(region.id, region);
        if (state.draft) merged.set(state.draft.id, state.draft);
        state.ui.selector.replaceChildren();
        for (const region of merged.values()) { const option = node('option', '', label(region)); option.value = region.id; state.ui.selector.append(option); }
        state.ui.entity.replaceChildren(); const none = node('option', '', text('Zone personnelle sans fiche', 'Personal zone without an entry')); none.value = ''; state.ui.entity.append(none);
        for (const entity of state.bridge.catalog.index.filter(item => Number(item.floor) === state.floor && item.kind === 'location' && item.markerType === 'zone')) {
            const option = node('option', '', english() && entity.titleEn ? entity.titleEn : entity.title); option.value = entity.key; state.ui.entity.append(option);
        }
    }
    function editorMarkup(state) {
        state.editorController?.abort(); state.editorController = new AbortController();
        const host = state.ui.host; host.replaceChildren();
        const head = node('div', 'map-region-editor-heading'); head.append(node('h2', '', text('Modifier une zone', 'Edit a zone')));
        const close = node('button', 'map-region-editor-close', '×'); close.type = 'button'; close.dataset.regionAction = 'close'; close.setAttribute('aria-label', text('Fermer l’éditeur des contours', 'Close the outline editor')); head.append(close); host.append(head);
        function field(parent, content, element) { const label = node('label', 'map-region-field'); label.append(node('span', '', content), element); parent.append(label); return element; }
        function action(parent, value, fr, en, className = '') {
            const button = node('button', 'nm-game-button ' + className, text(fr, en));
            button.type = 'button'; button.dataset.regionAction = value; parent.append(button); return button;
        }
        const choice = node('div', 'map-region-selection');
        state.ui.selector = field(choice, text('Zone à modifier', 'Zone to edit'), node('select', 'map-region-selector'));
        action(choice, 'new', '+ Nouvelle', '+ New').setAttribute('aria-label', text('Créer une nouvelle zone', 'Create a new zone')); host.append(choice);
        const identity = node('details', 'map-region-identity'); identity.append(node('summary', '', text('Nom et fiche associée', 'Name and linked entry')));
        state.ui.name = field(identity, text('Nom de la zone', 'Zone name'), node('input', 'map-region-name')); state.ui.name.type = 'text'; state.ui.name.maxLength = 120;
        state.ui.entity = field(identity, text('Fiche associée', 'Linked entry'), node('select', 'map-region-entity')); host.append(identity);
        const toolbox = node('section', 'map-region-toolbox'); toolbox.setAttribute('aria-label', text('Modifier le contour', 'Edit the outline'));
        const toolbar = node('div', 'map-region-tool-modes'); toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', text('Outil du contour', 'Outline tool'));
        action(toolbar, 'draw', 'Dessiner', 'Draw'); action(toolbar, 'edit', 'Ajuster', 'Adjust');
        state.ui.count = node('span', 'map-region-point-count'); toolbar.append(state.ui.count); toolbox.append(toolbar);
        state.ui.instructions = node('p', 'map-region-instructions'); toolbox.append(state.ui.instructions);
        state.ui.finishControls = node('div', 'map-region-editor-actions map-region-finish-actions');
        action(state.ui.finishControls, 'finish', 'Fermer le contour', 'Close outline', 'is-primary'); toolbox.append(state.ui.finishControls);
        state.ui.vertex = node('p', 'map-region-current-vertex'); toolbox.append(state.ui.vertex);
        state.ui.vertexTools = node('div', 'map-region-editor-actions map-region-vertex-actions');
        action(state.ui.vertexTools, 'add-vertex', 'Ajouter un point', 'Add a point');
        action(state.ui.vertexTools, 'delete-vertex', 'Supprimer le point', 'Delete point'); toolbox.append(state.ui.vertexTools);
        const history = node('div', 'map-region-editor-actions map-region-history');
        const undo = action(history, 'undo', '↶ Annuler', '↶ Undo'), redo = action(history, 'redo', '↷ Rétablir', '↷ Redo');
        undo.title = text('Annuler la dernière modification (Ctrl + Z)', 'Undo the last change (Ctrl + Z)');
        redo.title = text('Rétablir la modification (Ctrl + Maj + Z)', 'Redo the change (Ctrl + Shift + Z)');
        toolbox.append(history); host.append(toolbox);
        const draftControls = node('div', 'map-region-editor-actions map-region-draft-actions');
        action(draftControls, 'save', 'Enregistrer le brouillon', 'Save draft'); host.append(draftControls);
        host.append(node('p', 'map-region-local-note', text('Enregistrer conserve un brouillon privé dans ce navigateur. Publier rend les limites visibles sur le site.', 'Save keeps a private draft in this browser. Publish makes the boundaries visible on the site.')));
        const advanced = node('details', 'map-region-advanced'); advanced.append(node('summary', '', text('Fichiers et restauration', 'Files and restore')));
        const controls = node('div', 'map-region-editor-actions');
        action(controls, 'import', 'Importer JSON', 'Import JSON'); action(controls, 'export', 'Exporter JSON', 'Export JSON');
        action(controls, 'reset', 'Restaurer la proposition', 'Restore proposal'); action(controls, 'clear', 'Effacer le contour', 'Clear outline'); advanced.append(controls); host.append(advanced);
        state.ui.file = node('input', 'map-region-file'); state.ui.file.type = 'file'; state.ui.file.accept = 'application/json,.json'; state.ui.file.hidden = true; host.append(state.ui.file);
        state.ui.message = node('p', 'map-region-message'); state.ui.message.setAttribute('role', 'status'); state.ui.message.setAttribute('aria-live', 'polite'); host.append(state.ui.message);
        listenEditor(state, host, 'click', event => {
            const action = event.target.closest('[data-region-action]')?.dataset.regionAction; if (!action || !state.editing) return;
            if (action === 'close') closeEditor(state);
            else if (action === 'new') { startDraft(state, blank(state)); identity.open = true; state.ui.name.focus({ preventScroll: true }); }
            else if (action === 'draw' || action === 'edit') mode(state, action);
            else if (action === 'finish') finish(state);
            else if (action === 'add-vertex') addVertex(state);
            else if (action === 'delete-vertex') deleteVertex(state);
            else if (action === 'undo' || action === 'redo') historyMove(state, action);
            else if (action === 'clear') { const draft = copy(state.draft); draft.vertices = []; state.mode = 'draw'; commitDraft(state, draft, null); }
            else if (action === 'save') save(state);
            else if (action === 'reset') reset(state);
            else if (action === 'import') state.ui.file.click();
            else if (action === 'export') download(state);
        });
        listenEditor(state, state.ui.selector, 'change', () => {
            const imported = state.imported?.floors.find(item => item.floor === state.floor)?.regions.find(region => region.id === state.ui.selector.value);
            const region = imported || records(state).find(item => item.id === state.ui.selector.value); if (region) startDraft(state, region);
        });
        listenEditor(state, state.ui.name, 'change', () => { const draft = copy(state.draft); draft.title = state.ui.name.value.trim(); delete draft.titleEn; commitDraft(state, draft); });
        listenEditor(state, state.ui.entity, 'change', () => { const draft = copy(state.draft); draft.entityKey = state.ui.entity.value || null; delete draft.wikiUrl; commitDraft(state, draft); });
        listenEditor(state, state.ui.file, 'change', async () => {
            const file = state.ui.file.files?.[0], generation = ++state.importGeneration, floor = state.floor;
            if (!file) return;
            if (file.size > 1024 * 1024) { message(state, 'Le fichier JSON doit faire moins de 1 Mo.', 'The JSON file must be smaller than 1 MB.'); state.ui.file.value = ''; return; }
            try {
                const source = await file.text();
                if (!alive(state) || generation !== state.importGeneration || floor !== state.floor || !state.editing) return;
                importDocument(state, JSON.parse(source));
            } catch (error) { if (alive(state) && generation === state.importGeneration) errorMessage(state, error); }
            finally { if (alive(state) && generation === state.importGeneration) state.ui.file.value = ''; }
        });
    }
    function startDraft(state, region) {
        state.draftFloor = state.floor;
        state.draft = copy(region); delete state.draft.local;
        state.history = createHistory(state.draft); state.vertex = null; state.mode = state.draft.vertices.length >= 3 ? 'edit' : 'draw';
        populateSelectors(state); renderEditorState(state); renderDraft(state); message(state, '', '');
        fitEditorBounds(state);
        changed(state);
    }
    function fitEditorBounds(state) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor || state.draft.vertices.length < 3) return;
        const coordinates = state.draft.vertices.map(point => state.bridge.getLatLng(point));
        if (coordinates.some(point => !point)) return;
        const sheetHeight = global.innerWidth <= 768 && !state.bridge.root?.classList.contains('map-admin-workspace') ? Math.max(0, state.ui.host.getBoundingClientRect().height || 0) : 0;
        const bounds = global.L.latLngBounds(coordinates), options = { paddingTopLeft: [20, 20], paddingBottomRight: [20, sheetHeight + 20], maxZoom: 0, animate: !reduced(), duration: .32 };
        if (state.bridge.fitCamera) state.bridge.fitCamera(bounds, options);
        else { state.bridge.map.invalidateSize?.({ pan: true, animate: false }); state.bridge.map.stop?.(); state.bridge.map.fitBounds(bounds, options); }
    }
    function historyMove(state, direction) {
        if (!floorReady(state) || !state.editing || state.draftFloor !== state.floor) return false;
        state.draft = state.history[direction](); state.vertex = state.draft.vertices.length ? Math.min(state.vertex ?? 0, state.draft.vertices.length - 1) : null;
        if (state.draft.vertices.length < 3) state.mode = 'draw'; renderEditorState(state); renderDraft(state); changed(state); return true;
    }
    function openEditor(state, id) {
        if (!floorReady(state) || !state.ui.host || state.bridge.canEditRegions?.() !== true) return false;
        state.pendingCamera = null;
        state.bridge.cancelCamera?.();
        state.opener = document.activeElement; state.editing = true; state.importGeneration++;
        state.bridge.setRegionEditorMode?.(true); state.ui.host.hidden = false;
        state.bridge.root?.classList.add('has-region-editor');
        editorMarkup(state);
        startDraft(state, records(state).find(region => region.id === (id || state.selected)) || records(state)[0] || blank(state));
        renderPublic(state); state.bridge.syncViewport?.();
        state.ui.selector.focus({ preventScroll: true }); return true;
    }
    function closeEditor(state, restoreFocus = true) {
        if (!state.editing) return;
        state.bridge.cancelCamera?.();
        state.editing = false; state.importGeneration++; state.imported = null; clearDraftLayers(state);
        state.editorController?.abort();
        state.bridge.setRegionEditorMode?.(false); state.ui.host.hidden = true; state.bridge.root?.classList.remove('has-region-editor');
        renderPublic(state); state.bridge.syncViewport?.();
        if (restoreFocus) (state.opener?.isConnected ? state.opener : state.ui.open)?.focus?.({ preventScroll: true });
    }
    function setFloor(state, value) {
        const id = Number(value?.floor ?? state.bridge.getFloor());
        if (id !== Number(state.bridge.getFloor()) || Number(state.bridge.getData()?.floor) !== id) return;
        closeEditor(state, false); state.selectionGeneration++; state.pendingCamera = null; state.floor = id; state.floorPending = false; state.selected = null;
        renderPublic(state);
    }
    async function reloadRemote(state) {
        const generation = state.remoteGeneration = (state.remoteGeneration || 0) + 1;
        if (!global.supabase?.rpc) { state.remoteStatus = 'archive'; return; }
        try {
            const result = await global.supabase.rpc('read_map_regions');
            if (!alive(state) || generation !== state.remoteGeneration) return;
            if (result.error) throw result.error;
            state.remote = Array.isArray(result.data) ? result.data : []; state.remoteStatus = 'ready';
            renderPublic(state);
        } catch (error) {
            if (!alive(state) || generation !== state.remoteGeneration) return;
            if (error?.code === 'PGRST202') { state.remoteStatus = 'archive'; return; }
            state.remoteStatus = 'error'; renderPublic(state);
            if (state.ui.status) state.ui.status.textContent = text('Les dernières limites publiées ne sont pas disponibles. Réessayez.', 'The latest published boundaries are unavailable. Please retry.');
        }
    }
    async function init(bridge) {
        if (!bridge?.map || !bridge.catalog?.floors || !global.L) return null;
        if (active?.bridge === bridge && alive(active)) return active.ready;
        destroy();
        const query = id => bridge.root?.querySelector('#' + id);
        const state = { bridge, controller: new AbortController(), off: [], floor: Number(bridge.getFloor()), base: emptyDocument(), local: emptyDocument(),
            selected: null, filter: '', shown: true, editing: false, loaded: false, floorPending: false, draftFloor: null, polygons: new Map(), handles: [], selectionGeneration: 0, importGeneration: 0, zooming:!!bridge.isViewportZooming?.(), pendingCamera:null,
            pane: 'nameless-regions', editPane: 'nameless-region-edit', ui: { toggle: query('map-regions-toggle'), open: query('map-regions-tools'), list: query('map-region-list'), status: query('map-region-status'), host: query('map-regions-editor') } };
        active = state;
        if (state.ui.toggle?.matches('input[type="checkbox"]')) state.shown = state.ui.toggle.checked;
        const pane = bridge.map.getPane?.(state.pane) || bridge.map.createPane(state.pane); pane.style.zIndex = '450';
        const editPane = bridge.map.getPane?.(state.editPane) || bridge.map.createPane(state.editPane); editPane.style.zIndex = '650';
        state.layers = global.L.layerGroup().addTo(bridge.map); state.editLayers = global.L.layerGroup().addTo(bridge.map);
        state.api = { select: id => select(state, id), focusByEntity:key => focusByEntity(state,key), restoreView:(center,zoom)=>restoreView(state,center,zoom), cancelCamera(){state.pendingCamera=null;state.bridge.cancelCamera?.();}, findByEntity: key => floorReady(state) ? records(state).find(region => region.entityKey === key) || null : null,
            filter(value) { state.filter = normalizeFilter(value); renderPublic(state); },
            clearSelection() { state.selected = null; state.selectionGeneration++; state.pendingCamera = null; syncSelection(state); },
            getRegions: () => floorReady(state) ? copy(records(state)) : [],
            setWorkspaceRecords(rows) {
                if (state.bridge.canEditRegions?.() !== true) return;
                state.workspaceRegions = [];
                for (const row of Array.isArray(rows) ? rows : []) {
                    const entity = state.bridge.catalog.index.find(item => item.key === row.entity_key);
                    const floor = state.bridge.catalog.floors.find(item => Number(item.id) === Number(row.floor));
                    if (!entity || !floor || row.image_id !== imageIdentity(floor)) continue;
                    try { state.workspaceRegions.push({ id: row.region_id, entityKey: row.entity_key, title: entity.title, titleEn: entity.titleEn,
                        status: row.status, vertices: validateVertices(row.vertices), floor: Number(row.floor), baseRevision: row.revision, local: false }); } catch (_) {}
                }
                renderPublic(state);
            },
            setRemoteRecords(rows) { state.remote = Array.isArray(rows) ? copy(rows) : []; state.remoteStatus = 'ready'; renderPublic(state); },
            reloadRemote: () => reloadRemote(state),
            editor: { open: id => openEditor(state, id), close: () => closeEditor(state), save: () => save(state), reset: () => reset(state),
                acceptPublished(row) {
                    if (state.bridge.canEditRegions?.() !== true || !row || state.draft?.entityKey !== row.entity_key) return false;
                    const local = copy(state.local || emptyDocument());
                    for (const floor of local.floors) floor.regions = floor.regions.filter(region => region.entityKey !== row.entity_key);
                    local.floors = local.floors.filter(floor => floor.regions.length);
                    try { global.localStorage.setItem(state.bridge.getRegionDraftKey?.() || STORAGE_KEY, JSON.stringify(local)); } catch (_) {}
                    state.local = local;
                    const region = records(state).find(region => region.entityKey === row.entity_key);
                    if (region) startDraft(state, { ...region, baseRevision: row.revision });
                    return true;
                },
                load(region) { if (state.bridge.canEditRegions?.() !== true || !floorReady(state)) return false; if (!state.editing && !openEditor(state)) return false; startDraft(state, region); return true; },
                importDocument: value => importDocument(state, value), exportDocument: () => exportDocument(state), mode: value => mode(state, value),
                undo: () => historyMove(state, 'undo'), redo: () => historyMove(state, 'redo'), getDraft: () => state.draft ? copy(state.draft) : null } };
        const mapClick = event => {
            if (event.originalEvent?.target?.closest?.('.map-region-vertex')) return;
            addPoint(state, bridge.getRelative(event.latlng));
        };
        bridge.map.on('click', mapClick); state.off.push(() => bridge.map.off('click', mapClick));
        const zoomStarted = () => { state.zooming = true; };
        const zoomFinished = () => { state.zooming = false; settleCamera(state); };
        bridge.map.on('zoomstart',zoomStarted); bridge.map.on('zoomend',zoomFinished);
        state.off.push(() => bridge.map.off('zoomstart',zoomStarted), () => bridge.map.off('zoomend',zoomFinished));
        register(state, 'region-click', event => addPoint(state, event.relative || bridge.getRelative(event.latlng)));
        register(state, 'floor-pending', value => {
            state.floorPending = true; state.pendingCamera = null; closeEditor(state, false); state.selectionGeneration++;
            state.floor = Number(value?.floor ?? state.bridge.getFloor()); state.selected = null;
            renderPublic(state);
        });
        register(state, 'floor', value => setFloor(state, value));
        register(state, 'selection', entity => {
            if (state.editing || !floorReady(state)) return;
            if (entity?.key !== state.selectionEntity) { state.selectionGeneration++; state.pendingCamera = null; }
            state.selected = records(state).find(region => region.entityKey === entity?.key)?.id || null; syncSelection(state);
        });
        register(state, 'markers', () => { if (state.loaded) renderPublic(state); });
        register(state, 'editor', enabled => { if (enabled) closeEditor(state, false); });
        if (state.ui.toggle?.matches('input[type="checkbox"]')) listen(state, state.ui.toggle, 'change', () => { state.shown = state.ui.toggle.checked; renderPublic(state); });
        else listen(state, state.ui.toggle, 'click', () => { state.shown = !state.shown; renderPublic(state); });
        listen(state, state.ui.open, 'click', () => state.editing ? closeEditor(state) : openEditor(state));
        listen(state, document, 'keydown', event => {
            const target = event.target?.closest ? event.target : document.activeElement;
            if (event.defaultPrevented || document.querySelector('dialog[open]')
                || target?.closest?.('[role="dialog"][aria-modal="true"]')
                || document.activeElement?.closest?.('[role="dialog"][aria-modal="true"]')) return;
            if (event.key === 'Escape' && state.editing) { event.preventDefault(); closeEditor(state); }
            else if (state.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.target.matches('input,textarea,select')) {
                event.preventDefault(); historyMove(state, event.shiftKey ? 'redo' : 'undo');
            }
        });
        listen(state, document, 'nameless:languagechange', () => {
            renderPublic(state);
            if (state.editing) { const draft = copy(state.draft), history = state.history, vertex = state.vertex, currentMode = state.mode;
                editorMarkup(state); state.draft = draft; state.history = history; state.vertex = vertex; state.mode = currentMode;
                populateSelectors(state); renderEditorState(state); renderDraft(state); state.ui.name.focus({ preventScroll: true }); }
        });
        bridge.signal?.addEventListener('abort', () => { if (active === state) destroy(); }, { once: true, signal: state.controller.signal });
        try {
            const saved = global.localStorage.getItem(state.bridge.getRegionDraftKey?.() || STORAGE_KEY);
            if (state.bridge.canEditRegions?.() === true && saved && saved.length <= 1024 * 1024) state.local = validateDocument(JSON.parse(saved), bridge.catalog);
        } catch (_) { if (state.ui.status) state.ui.status.textContent = text('Les anciens contours locaux ne correspondent pas à cet atlas.', 'The previous local outlines do not match this atlas.'); }
        renderPublic(state);
        state.ready = (async () => {
            try {
                const response = await global.fetch('/assets/map/regions.json', { credentials: 'same-origin', cache: 'no-cache', signal: state.controller.signal });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const document = validateDocument(await response.json(), bridge.catalog); if (!alive(state)) return null;
                state.base = document; state.loaded = true;
                await reloadRemote(state); if (!alive(state)) return null;
                const initial = bridge.getSelection?.();
                state.selected = records(state).find(region => region.entityKey === (initial?.key || initial))?.id || null;
                renderPublic(state); return state.api;
            } catch (error) {
                if (!alive(state)) return null;
                state.loaded = true; renderPublic(state);
                if (state.ui.status) state.ui.status.textContent = text('Les propositions de contours ne sont pas disponibles. Le dessin local reste accessible.', 'Proposed outlines are unavailable. Local drawing remains available.');
                return state.api;
            }
        })();
        return state.ready;
    }
    function destroy() {
        const state = active; if (!state) return;
        closeEditor(state, false); active = null; state.controller.abort(); state.selectionGeneration++; state.importGeneration++; state.pendingCamera = null;
        state.publicController?.abort(); state.editorController?.abort(); state.handleController?.abort();
        for (const off of state.off) off(); state.off = [];
        clearLayers(state); clearDraftLayers(state); state.bridge.map.removeLayer?.(state.layers); state.bridge.map.removeLayer?.(state.editLayers);
        if (state.ui.host) { state.ui.host.hidden = true; state.ui.host.replaceChildren(); }
        state.ui.list?.replaceChildren(); state.bridge.root?.classList.remove('has-region-editor');
    }
    const api = global.NamelessMapRegions = { init, destroy, validateDocument, validateVertices, containsPoint, createHistory, STORAGE_KEY };
    Object.defineProperty(api, 'active', { get: () => active?.api || null });
})(window);
