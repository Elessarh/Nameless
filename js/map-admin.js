/* Admin map editor: draft positions stay in memory until an explicit save. */
(function (global) {
    'use strict';
    const TYPES = ['town', 'dungeon', 'zone', 'merchant', 'quest-primary', 'quest-secondary', 'npc', 'teleporter', 'boss', 'creature'];
    const ACTIONS = [['place','Placer / déplacer','Place / move'],['save','Enregistrer','Save'],['hide','Masquer','Hide'],['remove','Supprimer de la carte','Remove from map'],['restore','Rétablir le repère original','Restore original marker']];
    const LABELS = {
        town: ['Ville', 'Town'], dungeon: ['Donjon', 'Dungeon'], zone: ['Zone', 'Zone'], merchant: ['Marchand', 'Merchant'],
        'quest-primary': ['Quête principale', 'Main quest'], 'quest-secondary': ['Quête secondaire', 'Side quest'],
        npc: ['PNJ', 'NPC'], teleporter: ['Téléporteur', 'Teleporter'], boss: ['Boss', 'Boss'], creature: ['Créature', 'Creature']
    };
    let active = null;
    const text = (fr, en) => (document.documentElement.lang || '').toLowerCase().startsWith('en') ? en : fr;
    const validPosition = value => value && Number.isFinite(value.u) && Number.isFinite(value.v)
        && value.u >= 0 && value.u <= 1 && value.v >= 0 && value.v <= 1;
    const isActive = state => active === state && !state.controller.signal.aborted && !state.bridge.signal?.aborted;
    const backendReady = state => !state.bridge.getOverridesStatus || state.bridge.getOverridesStatus() === 'ready';

    function element(tag, className, content) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    }
    function show(state, fr, en) {
        if (!isActive(state)) return;
        const value = text(fr, en);
        state.message = [fr, en];
        state.status.textContent = value;
        state.bridge.notice?.(value);
    }
    function removePreview(state) {
        if (state.preview) {
            state.preview.off?.();
            state.bridge.map.removeLayer(state.preview);
            state.preview = null;
        }
    }
    function setMode(state, enabled) {
        state.mode = enabled;
        state.bridge.setEditorMode?.(enabled);
        state.place.setAttribute('aria-pressed', String(enabled));
        state.preview?.dragging?.[enabled && !state.pending ? 'enable' : 'disable']?.();
    }
    function controls(state) {
        const selected = !!state.selected;
        const record = state.rows.get(state.selected);
        state.host.querySelectorAll('select, button').forEach(node => { node.disabled = state.pending || !state.ready || !backendReady(state); });
        for (const node of [state.place, state.type, state.hide, state.remove]) node.disabled ||= !selected;
        state.save.disabled ||= !selected || !validPosition(state.draft);
        state.restore.disabled ||= !record;
        state.preview?.dragging?.[state.pending || !state.mode ? 'disable' : 'enable']?.();
    }
    function updatePosition(state) {
        state.position.textContent = validPosition(state.draft)
            ? text('Position provisoire : ', 'Draft position: ') + `u ${state.draft.u.toFixed(4)} · v ${state.draft.v.toFixed(4)}`
            : text('Cliquez sur la carte pour choisir une position.', 'Click the map to choose a position.');
        controls(state);
    }
    function choose(state, key) {
        if (!key) {
            removePreview(state); setMode(state, false); state.selected = ''; state.entity.value = ''; state.draft = null; updatePosition(state); return;
        }
        if (!state.entities.some(entry => entry.key === key)) return;
        removePreview(state);
        setMode(state, false);
        state.selected = key;
        state.entity.value = key;
        const record = state.rows.get(key);
        const entity = state.entities.find(entry => entry.key === key);
        state.type.value = TYPES.includes(record?.marker_type) ? record.marker_type : entity.markerType;
        state.draft = validPosition(record) ? { u: record.u, v: record.v } : null;
        state.draftLatLng = null;
        if (state.draft && state.bridge.getLatLng) {
            state.draftLatLng = state.bridge.getLatLng(state.draft);
            makePreview(state, state.draftLatLng);
        }
        const current = record?.state;
        state.status.textContent = current === 'hidden' ? text('Repère masqué.', 'Marker hidden.')
            : current === 'deleted' ? text('Repère supprimé de la carte.', 'Marker removed from the map.') : '';
        state.message = current === 'hidden' ? ['Repère masqué.', 'Marker hidden.']
            : current === 'deleted' ? ['Repère supprimé de la carte.', 'Marker removed from the map.'] : ['', ''];
        updatePosition(state);
    }
    async function stableActor(state) {
        if (!backendReady(state)) throw new Error('map_backend_not_ready');
        const client = global.supabase;
        if (!client?.auth?.getSession || !client.auth.getUser) throw new Error('map_session_required');
        const before = await client.auth.getSession();
        const session = before.data?.session;
        if (before.error || !session?.access_token || !session.user?.id) throw new Error('map_session_required');
        const verified = await client.auth.getUser(session.access_token);
        if (verified.error || verified.data?.user?.id !== session.user.id) throw new Error('map_session_required');
        if (state.actor && verified.data.user.id !== state.actor) throw new Error('map_session_changed');
        const role = await client.rpc('current_user_role');
        if (role.error || role.data !== 'admin') throw new Error('map_admin_required');
        const after = await client.auth.getSession();
        if (after.error || after.data?.session?.access_token !== session.access_token
            || after.data?.session?.user?.id !== session.user.id || !isActive(state)) throw new Error('map_session_changed');
        if (!backendReady(state)) throw new Error('map_backend_not_ready');
        return { client, actor: session.user.id };
    }
    async function readRows(state, client, expectedRevision = state.floorRevision) {
        const floor = state.bridge.getFloor();
        const result = await client.from('map_marker_overrides')
            .select('id,entity_key,floor,marker_type,state,u,v').eq('floor', floor);
        if (result.error) throw result.error;
        if (!isActive(state) || floor !== state.bridge.getFloor() || expectedRevision !== state.floorRevision) return false;
        state.rows = new Map((result.data || []).map(row => [row.entity_key, row]));
        return true;
    }
    function errorMessage(state, error) {
        const message = String(error?.message || error?.code || '');
        if (/rate_limited/.test(message)) show(state, 'Trop de modifications. Réessayez dans une minute.', 'Too many changes. Try again in a minute.');
        else if (/backend_not_ready/.test(message)) {
            state.ready = false; setMode(state, false);
            show(state, 'L’édition nécessite le service de repères disponible.', 'Editing requires the marker service to be available.');
        }
        else if (/session|admin_required/.test(message)) {
            state.ready = false;
            setMode(state, false);
            show(state, 'Votre session administrateur doit être vérifiée à nouveau.', 'Your administrator session must be verified again.');
        } else show(state, 'Modification non enregistrée. Vérifiez la migration et le registre de la carte.', 'Change not saved. Check the map migration and registry.');
    }
    async function write(state, operation) {
        if (!isActive(state) || state.pending || !state.ready || !state.selected) return;
        if (!backendReady(state)) { errorMessage(state, new Error('map_backend_not_ready')); controls(state); return; }
        const entry = state.entities.find(item => item.key === state.selected);
        const registered = state.bridge.catalog.registry?.find(item => item.key === state.selected && item.floor === state.bridge.getFloor());
        if (!entry || !registered || !TYPES.includes(state.type.value)) return;
        if (operation === 'save' && !validPosition(state.draft)) {
            show(state, 'Choisissez une position dans les limites de la carte.', 'Choose a position inside the map.');
            return;
        }
        // Freeze the user's intent before auth awaits. A later floor/selection
        // must never lend its coordinates or type to this mutation.
        const intent = { key: entry.key, floor: registered.floor, revision: state.floorRevision,
            markerType: state.type.value, draft: state.draft ? { ...state.draft } : null,
            existing: state.rows.get(entry.key) ? { ...state.rows.get(entry.key) } : null };
        const sameIntent = () => isActive(state) && state.floorRevision === intent.revision
            && state.selected === intent.key && state.bridge.getFloor() === intent.floor;
        state.pending = true;
        controls(state);
        let committed = false;
        const refreshFailure = () => {
            state.ready = false; state.rows.clear(); removePreview(state); setMode(state, false);
            show(state, 'Modification enregistrée, mais affichage non actualisé. Rechargez la page avant une autre modification.',
                'Change saved, but the display could not be refreshed. Reload the page before making another change.');
        };
        try {
            const { client } = await stableActor(state);
            if (!sameIntent()) return;
            const existing = intent.existing;
            let query;
            if (operation === 'restore') {
                if (!existing) return;
                query = client.from('map_marker_overrides').delete().eq('id', existing.id);
            } else {
                const payload = {
                    entity_key: intent.key, floor: intent.floor, marker_type: intent.markerType,
                    state: operation === 'hide' ? 'hidden' : operation === 'remove' ? 'deleted' : 'visible',
                    u: validPosition(intent.draft) ? intent.draft.u : null,
                    v: validPosition(intent.draft) ? intent.draft.v : null
                };
                query = existing
                    ? client.from('map_marker_overrides').update(payload).eq('id', existing.id)
                    : client.from('map_marker_overrides').insert(payload);
            }
            // SELECT returning distinguishes a successful write from zero rows
            // after a concurrent deletion or role revocation.
            const result = await query.select('id');
            if (result.error) throw result.error;
            if (!result.data?.length) throw new Error('map_write_not_applied');
            committed = true;
            if (!isActive(state)) return;
            let refreshed = true;
            // Refresh the shared public projection immediately after commit,
            // before any private read or intent check can suspend/abandon it.
            // This also updates tombstones when the admin changed floors.
            try { await state.bridge.reloadOverrides(); }
            catch (_) { refreshed = false; }
            if (!isActive(state)) return;
            if (!refreshed || !backendReady(state)) { refreshFailure(); return; }
            if (!sameIntent()) return;
            try { refreshed = await readRows(state, client, intent.revision); }
            catch (_) { refreshed = false; }
            if (!sameIntent()) return;
            if (!refreshed) { refreshFailure(); return; }
            choose(state, entry.key);
            show(state, operation === 'restore' ? 'Repère original rétabli.' : 'Modification enregistrée.',
                operation === 'restore' ? 'Original marker restored.' : 'Change saved.');
        } catch (error) {
            if (isActive(state)) { if (committed) refreshFailure(); else errorMessage(state, error); }
        } finally {
            if (isActive(state)) { state.pending = false; controls(state); }
        }
    }
    function makePreview(state, latlng) {
        if (!state.preview && global.L?.marker) {
            state.preview = global.L.marker(latlng, { draggable: true, keyboard: true, title: text('Position provisoire', 'Draft position') }).addTo(state.bridge.map);
            state.preview.on('dragend', () => placeDraft(state, state.preview.getLatLng()));
        } else state.preview?.setLatLng(latlng);
    }
    function placeDraft(state, latlng) {
        if (!isActive(state) || !state.mode || state.pending || !state.selected) return;
        const position = state.bridge.getRelative(latlng);
        if (!validPosition(position)) {
            if (state.preview && state.draftLatLng) state.preview.setLatLng(state.draftLatLng);
            show(state, 'Le repère doit rester dans les limites de la carte.', 'The marker must stay inside the map.');
            return;
        }
        state.draft = { u: position.u, v: position.v };
        state.draftLatLng = latlng;
        makePreview(state, latlng);
        updatePosition(state);
        show(state, 'Position provisoire. Enregistrez pour la publier.', 'Draft position. Save to publish it.');
    }
    async function loadFloor(state) {
        const generation = ++state.floorRevision;
        state.ready = false;
        state.selected = '';
        state.draft = null;
        state.rows.clear();
        removePreview(state);
        setMode(state, false);
        const floor = state.bridge.getFloor();
        const registry = state.bridge.catalog.registry || [];
        const keys = new Set(registry.filter(item => item.floor === floor).map(item => item.key));
        state.entities = (state.bridge.catalog.index || []).filter(item => item.floor === floor && keys.has(item.key));
        state.entity.replaceChildren(element('option', '', text('Choisir une entité', 'Choose an entity')));
        state.entity.firstChild.value = '';
        for (const entry of state.entities) {
            const option = element('option', '', (document.documentElement.lang === 'en' ? entry.titleEn : entry.title) || entry.title || entry.key);
            option.value = entry.key;
            state.entity.appendChild(option);
        }
        updatePosition(state);
        if (!state.entities.length) {
            show(state, 'Aucune entité enregistrée pour ce palier.', 'No registered entities on this floor.');
            return;
        }
        try {
            const { client, actor } = await stableActor(state);
            if (generation !== state.floorRevision || !isActive(state)) return;
            state.actor = actor;
            if (!await readRows(state, client, generation) || generation !== state.floorRevision) return;
            state.ready = true;
            state.status.textContent = text('Choisissez une entité existante.', 'Choose an existing entity.');
            state.message = ['Choisissez une entité existante.', 'Choose an existing entity.'];
            controls(state);
        } catch (error) { if (generation === state.floorRevision && isActive(state)) errorMessage(state, error); }
    }
    function destroy() {
        const state = active;
        if (!state) return;
        active = null;
        state.controller.abort();
        state.cleanups.forEach(unsubscribe => unsubscribe?.());
        removePreview(state);
        state.bridge.setEditorMode?.(false);
        state.rows.clear();
        state.draft = null;
        state.host.replaceChildren();
    }
    async function init(bridge) {
        destroy();
        if (!bridge?.map || bridge.signal?.aborted) return false;
        const host = bridge.root?.querySelector?.('#map-admin-host') || document.getElementById('map-admin-host');
        if (!host) return false;
        const state = { bridge, host, controller: new AbortController(), cleanups: [], rows: new Map(),
            actor: null, selected: '', draft: null, preview: null, ready: false, pending: false, mode: false, floorRevision: 0, entities: [] };
        active = state;
        const signal = state.controller.signal;
        host.replaceChildren();
        host.classList.add('map-editor');
        // This module renders both languages itself, including draft/status
        // updates; prevent the site's text observer from caching a second copy.
        host.setAttribute('data-i18n-ignore', '');
        state.title = element('h2', 'map-editor-title', text('Édition de la carte', 'Map editor')); host.appendChild(state.title);
        const entityLabel = element('label', 'map-editor-field', text('Entité', 'Entity'));
        state.entity = element('select', 'map-editor-entity'); state.entity.id = 'map-editor-entity';
        entityLabel.appendChild(state.entity);
        state.entityLabel = entityLabel.firstChild;
        const typeLabel = element('label', 'map-editor-field', text('Type de repère', 'Marker type'));
        state.type = element('select', 'map-editor-type'); state.type.id = 'map-editor-type';
        for (const type of TYPES) { const option = element('option', '', text(...LABELS[type])); option.value = type; state.type.appendChild(option); }
        typeLabel.appendChild(state.type);
        state.typeLabel = typeLabel.firstChild;
        state.position = element('p', 'map-editor-position');
        state.status = element('p', 'map-editor-status'); state.status.setAttribute('role', 'status'); state.status.setAttribute('aria-live', 'polite');
        const actions = element('div', 'map-editor-actions');
        for (const [name, fr, en] of ACTIONS) {
            const button = element('button', 'map-editor-' + name, text(fr, en)); button.type = 'button'; state[name] = button; actions.appendChild(button);
        }
        host.append(entityLabel, typeLabel, state.position, actions, state.status);
        state.entity.addEventListener('change', () => { if (state.pending) return; choose(state, state.entity.value); if (state.selected) bridge.selectEntity(state.selected); }, { signal });
        state.place.addEventListener('click', () => { setMode(state, !state.mode); }, { signal });
        for (const action of ['save','hide','remove','restore']) state[action].addEventListener('click', () => write(state, action), { signal });
        const mapClick = event => placeDraft(state, event.latlng);
        bridge.map.on('click', mapClick);
        state.cleanups.push(() => bridge.map.off('click', mapClick));
        if (bridge.on) {
            const floorChanged = () => { loadFloor(state); };
            const entitySelected = event => { if (!state.pending && state.ready) choose(state, typeof event === 'string' ? event : event?.key); };
            for (const event of ['floor', 'floorchange']) state.cleanups.push(bridge.on(event, floorChanged));
            for (const event of ['selection', 'entityselect']) state.cleanups.push(bridge.on(event, entitySelected));
            state.cleanups.push(bridge.on('overrides', () => {
                if (!backendReady(state)) { errorMessage(state, new Error('map_backend_not_ready')); controls(state); }
                else if (!state.ready && !state.pending) loadFloor(state);
            }));
            state.cleanups.push(bridge.on('marker', event => {
                if (state.pending || !state.ready) return;
                const entries = event?.entities || [];
                if (entries.length !== 1) {
                    show(state, 'Plusieurs entités partagent ce point. Choisissez l’entité dans la liste.', 'Several entities share this point. Choose the entity in the list.');
                    state.entity.focus(); return;
                }
                choose(state, entries[0].key);
                const position = bridge.getRelative(event.latlng);
                if (validPosition(position) && !state.draft) {
                    state.draft = { u: position.u, v: position.v }; state.draftLatLng = event.latlng;
                    makePreview(state, event.latlng); updatePosition(state);
                }
            }));
        }
        document.addEventListener('nameless:auth-changed', event => {
            if (!event.detail?.user || event.detail.user.id !== state.actor) destroy();
        }, { signal });
        document.addEventListener('nameless:languagechange', () => {
            state.title.textContent = text('Édition de la carte', 'Map editor');
            state.entityLabel.textContent = text('Entité', 'Entity');
            state.typeLabel.textContent = text('Type de repère', 'Marker type');
            for (const [name, fr, en] of ACTIONS) state[name].textContent = text(fr, en);
            for (const option of state.type.options) option.textContent = text(...LABELS[option.value]);
            for (const option of state.entity.options) {
                const entry = state.entities.find(item => item.key === option.value);
                option.textContent = entry ? (document.documentElement.lang === 'en' ? entry.titleEn : entry.title) || entry.title || entry.key : text('Choisir une entité', 'Choose an entity');
            }
            if (state.message) state.status.textContent = text(...state.message);
            updatePosition(state);
        }, { signal });
        bridge.signal?.addEventListener('abort', destroy, { once: true, signal });
        await loadFloor(state);
        return isActive(state) && state.ready;
    }
    global.NamelessMapAdmin = { init, destroy };
})(window);
