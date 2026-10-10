/* Administrator map workbench. Local drafts are private; every shared write is an explicit RPC. */
(function (global) {
    'use strict';
    let active = null;
    const TYPES = { town:'Ville', dungeon:'Donjon', zone:'Zone', merchant:'Marchand', 'quest-primary':'Quête principale', 'quest-secondary':'Quête secondaire', npc:'PNJ', teleporter:'Téléporteur', boss:'Boss', creature:'Créature' };
    const clone = value => JSON.parse(JSON.stringify(value));
    const point = value => value && Number.isFinite(value.u) && Number.isFinite(value.v) && value.u >= 0 && value.u <= 1 && value.v >= 0 && value.v <= 1;
    function el(tag, className, text) { const n=document.createElement(tag); if(className)n.className=className; if(text!=null)n.textContent=text; return n; }
    function alive(s) { return active===s && !s.controller.signal.aborted; }
    function canEdit(s) { return alive(s) && s.authorized===true && !!s.uid; }
    function on(s, target, event, fn) { target?.addEventListener(event, fn, {signal:s.controller.signal}); }
    function message(s, text) { if(alive(s))s.root.querySelector('#workspace-message').textContent=text; }
    function image(s) { const config=s.bridge.catalog.floors.find(f=>Number(f.id)===s.bridge.getFloor()); return config.originalImage||config.image; }
    function localKey(s) { return 'nameless.map-marker-drafts.v1.'+s.uid; }
    function errorText(error) {
        const source=String(error?.message||error?.code||'');
        if(/revision|conflict|stale/i.test(source))return 'Une autre personne a modifié cette entrée. Rechargez les données avant de republier ; votre dessin reste dans l’éditeur.';
        if(/permission|admin|unauthorized|42501|JWT|session/i.test(source))return 'Votre accès administrateur doit être vérifié à nouveau. Aucune modification publiée.';
        if(/rate|limit|budget/i.test(source))return 'Trop de modifications rapprochées. Attendez une minute avant de republier.';
        if(/vertices|polygon|geometry/i.test(source))return 'Le contour doit rester dans l’image et ne pas se croiser.';
        return 'La publication a échoué. Votre brouillon est conservé. Vérifiez la connexion puis réessayez.';
    }
    function syncActions(s) {
        for (const selector of ['.map-controls-container','.workspace-tool-tabs','#workspace-inspector','.map-wrapper']) {
            const host=s.root.querySelector(selector); if(host)host.inert=s.busy;
        }
        for(const id of ['workspace-region-publish','workspace-region-reset','workspace-marker-publish','workspace-marker-reset','workspace-marker-delete']) {
            const button=s.root.querySelector('#'+id); if(button)button.disabled=!canEdit(s)||!s.serverReady||s.busy;
        }
        const gate=s.root.querySelector('#workspace-service'); gate.hidden=s.serverReady;
        if(!s.serverReady) gate.replaceChildren(el('strong','', 'Publication partagée indisponible. '),document.createTextNode('L’éditeur local reste accessible. La migration cartographique 008 doit être appliquée dans Supabase pour publier zones et repères.'));
    }
    async function verified(s) {
        if(!canEdit(s))throw new Error('admin_required');
        const uid=s.uid, generation=s.authGeneration;
        const user=await global.supabase.auth.getUser();
        if(!canEdit(s)||generation!==s.authGeneration||user.error||user.data?.user?.id!==uid) { if(alive(s)&&generation===s.authGeneration)lock(s,'Votre session a changé. Connectez-vous de nouveau.',true); throw new Error('session_changed'); }
        const role=await global.supabase.rpc('current_user_role');
        if(!canEdit(s)||generation!==s.authGeneration||role.error||role.data!=='admin') { if(alive(s)&&generation===s.authGeneration)lock(s,'Votre accès administrateur n’est plus disponible.'); throw new Error('admin_required'); }
        return {uid,generation};
    }
    async function readShared(s) {
        const uid=s.uid,generation=s.authGeneration;
        const result=await global.supabase.rpc('map_workspace_read');
        if(!canEdit(s)||uid!==s.uid||generation!==s.authGeneration)return false;
        if(result.error) {
            if(/admin_required|permission|42501|JWT|PGRST30[12]/i.test(String(result.error.message||'')+' '+String(result.error.code||''))) {
                lock(s,'Votre accès administrateur n’est plus disponible.'); return false;
            }
            s.serverReady=false; syncActions(s); return false;
        }
        const data=result.data;
        if(!data||!Array.isArray(data.registry)||!Array.isArray(data.markers)||!Array.isArray(data.regions)) { s.serverReady=false; syncActions(s); return false; }
        s.shared=data; s.serverReady=true; global.NamelessMapRegions.active?.setWorkspaceRecords?.(data.regions); syncActions(s); return true;
    }
    function rememberCommit(s, name, params, data) {
        if(!s.shared||!Number.isInteger(data?.revision))return;
        const kind=name.includes('custom_marker')?'custom':name.endsWith('_region')?'region':'marker';
        const list=kind==='custom'?'custom_markers':kind==='region'?'regions':'markers';
        const key=data.record?.entity_key||params.p_entity_key;
        s.shared[list]=(s.shared[list]||[]).filter(row=>row.entity_key!==key);
        if(data.record)s.shared[list].push(clone(data.record));
        if(kind!=='custom') {const row=s.shared.registry.find(row=>row.entity_key===key);if(row)row[kind+'_revision']=data.revision;}
    }
    async function mutate(s, name, params, success) {
        if(s.busy||!s.serverReady||!canEdit(s))return false;
        const floor=s.bridge.getFloor(),editGeneration=s.editGeneration;
        s.busy=true; syncActions(s); message(s,'Vérification et publication…');
        try {
            const session=await verified(s);
            if(s.bridge.getFloor()!==floor||s.editGeneration!==editGeneration)throw new Error('editing_changed');
            const result=await global.supabase.rpc(name,params);
            if(!canEdit(s)||s.uid!==session.uid||s.authGeneration!==session.generation)return false;
            if(result.error)throw result.error;
            rememberCommit(s,name,params,result.data);
            const refreshed=await readShared(s); if(!canEdit(s)||s.uid!==session.uid||s.authGeneration!==session.generation)return false;
            await Promise.all([s.bridge.reloadOverrides(),global.NamelessMapRegions.active.reloadRemote()]);
            if(!canEdit(s)||s.uid!==session.uid||s.authGeneration!==session.generation)return false;
            if(s.bridge.getFloor()===floor&&s.editGeneration===editGeneration)success?.(result.data);
            message(s,refreshed?'Modification publiée. La carte publique utilise ces données.':'Modification enregistrée sur le serveur. La relecture est indisponible : rechargez les données avant une nouvelle publication.'); return true;
        } catch(error) { if(/admin_required|permission|42501|JWT|PGRST30[12]/i.test(String(error?.message||'')+' '+String(error?.code||'')))lock(s,'Votre accès administrateur n’est plus disponible.');else message(s,errorText(error)); return false; }
        finally { if(alive(s)){s.busy=false;syncActions(s);if(s.bridge&&s.bridge.getFloor()!==floor)setMode(s,s.mode);} }
    }
    function revision(s, key, kind) {
        if(kind==='custom')return s.shared?.custom_markers?.find(r=>r.entity_key===key)?.revision||0;
        const record=s.shared?.registry?.find(r=>r.entity_key===key);
        return Number(record?.[kind+'_revision']||0);
    }
    function regionChanged(s) {
        if(!canEdit(s))return;
        const draft=global.NamelessMapRegions.active?.editor.getDraft();
        const key=draft?.entityKey;
        if(key!==s.regionKey) {
            s.regionKey=key; s.regionRevision=Number.isInteger(draft?.baseRevision)?draft.baseRevision:revision(s,key,'region');
            const record=s.shared?.regions?.find(r=>r.entity_key===key);
            s.root.querySelector('#workspace-region-status').value=record?.status||draft?.status||'indicative';
            s.root.querySelector('#workspace-region-visible').checked=record?.visible!==false;
        }
        const name=s.root.querySelector('.map-region-name'); if(name)name.readOnly=!!key;
        const publish=s.root.querySelector('#workspace-region-publish'); if(publish)publish.disabled=!s.serverReady||s.busy||!key;
    }
    async function publishRegion(s) {
        const draft=global.NamelessMapRegions.active?.editor.getDraft();
        if(!canEdit(s)||!draft?.entityKey) { message(s,'Associez le contour à une fiche de zone existante pour le publier. Les zones personnelles peuvent être exportées en JSON.'); return false; }
        try { global.NamelessMapRegions.validateVertices(draft.vertices); } catch(_) { message(s,'Le contour doit avoir au moins trois sommets, rester dans l’image et ne pas se croiser.'); return false; }
        const key=draft.entityKey, floor=s.bridge.getFloor();
        return mutate(s,'map_workspace_save_region',{p_entity_key:key,p_region_id:draft.id,p_floor:floor,p_image_id:image(s),p_status:s.root.querySelector('#workspace-region-status').value,
            p_visible:s.root.querySelector('#workspace-region-visible').checked,p_vertices:draft.vertices,p_expected_revision:s.regionRevision},data=>{s.regionRevision=data.revision;global.NamelessMapRegions.active.editor.acceptPublished(data.record);});
    }
    async function resetRegion(s) {
        if(!s.regionKey)return false;
        return mutate(s,'map_workspace_reset_region',{p_entity_key:s.regionKey,p_expected_revision:s.regionRevision},data=>{ s.regionRevision=data.revision;global.NamelessMapRegions.active.editor.reset();});
    }
    function field(host, title, id, element) { element.id=id; const label=el('label');label.append(el('span','',title),element);host.append(label);return element; }
    function selectOptions(select, options) { for(const [value,title] of options){const n=el('option','',title);n.value=value;select.append(n);} }
    function renderMarkerForm(s) {
        const host=s.root.querySelector('#workspace-marker-tool');host.replaceChildren(el('h2','','Modifier les repères'),el('p','','Sélectionnez une entrée, puis placez ou déplacez son repère. Le public ne voit que les modifications publiées.'));
        const select=field(host,'Entrée du palier','workspace-marker-select',el('select'));
        const custom=s.shared?.custom_markers||[];
        const registered=new Set((s.shared?.registry||s.bridge.catalog.registry||[]).map(row=>row.entity_key||row.key));
        selectOptions(select,[['','Choisir un repère…'],...s.bridge.catalog.index.filter(e=>Number(e.floor)===s.bridge.getFloor()&&!e.custom&&registered.has(e.key)).map(e=>[e.key,e.title]),...custom.filter(e=>e.floor===s.bridge.getFloor()&&e.state!=='deleted').map(e=>[e.entity_key,e.title+' · ajouté'])]);
        const create=el('button','','＋ Nouveau repère');create.id='workspace-marker-new';create.type='button';host.append(create);
        const title=field(host,'Nom','workspace-marker-title',el('input'));title.maxLength=160;
        const description=field(host,'Description','workspace-marker-description',el('textarea'));description.maxLength=2048;
        const type=field(host,'Icône','workspace-marker-type',el('select'));selectOptions(type,Object.entries(TYPES));
        const state=field(host,'Publication','workspace-marker-state',el('select'));selectOptions(state,[['visible','Visible sur la carte'],['hidden','Masqué'],['draft','Brouillon partagé · invisible au public']]);
        const coordinates=el('div','workspace-coordinate-fields');host.append(coordinates);
        for(const axis of ['u','v']) {const input=field(coordinates,axis==='u'?'Horizontal (0 à 1)':'Vertical (0 à 1)','workspace-marker-'+axis,el('input'));input.type='number';input.min='0';input.max='1';input.step='.0001';}
        host.append(el('p','workspace-marker-position','Cliquez sur la carte pour placer le repère, ou déplacez le point doré.'));
        const actions=el('div','workspace-marker-actions');host.append(actions);
        for(const [id,text] of [['place','Placer sur la carte'],['undo','Annuler'],['redo','Rétablir'],['local','Enregistrer le brouillon'],['reset','Restaurer la position'],['delete','Retirer ce repère']]) {const b=el('button','',text);b.type='button';b.id='workspace-marker-'+id;actions.append(b);}
        const publish=el('button','is-primary','Publier le repère');publish.type='button';publish.id='workspace-marker-publish';host.append(publish);
        on(s,select,'change',()=>loadMarker(s,select.value));on(s,create,'click',()=>newMarker(s));
        for(const id of ['title','description','type','state','u','v'])on(s,s.root.querySelector('#workspace-marker-'+id),'change',()=>captureMarker(s));
        on(s,s.root.querySelector('#workspace-marker-place'),'click',()=>{if(!s.marker)newMarker(s);s.placing=true;message(s,'Cliquez dans l’image pour placer le repère.');});
        on(s,s.root.querySelector('#workspace-marker-local'),'click',()=>saveMarkerLocal(s));
        on(s,publish,'click',()=>publishMarker(s));
        on(s,s.root.querySelector('#workspace-marker-reset'),'click',()=>resetMarker(s));
        on(s,s.root.querySelector('#workspace-marker-delete'),'click',()=>deleteMarker(s));
        for(const direction of ['undo','redo'])on(s,s.root.querySelector('#workspace-marker-'+direction),'click',()=>{if(s.history){s.marker=s.history[direction]();syncMarker(s);}});
        syncMarker(s);syncActions(s);
    }
    function markerDraftKey(s) {return s.marker?.key||'new:'+s.bridge.getFloor();}
    function savedMarkers(s) { try{const data=JSON.parse(global.localStorage.getItem(localKey(s))||'{}');return data&&typeof data==='object'?data:{};}catch(_){return{};} }
    function loadMarker(s,key) {
        if(!canEdit(s)||!key)return;
        const custom=s.shared?.custom_markers?.find(r=>r.entity_key===key);
        const entity=s.bridge.getData()?.entities[key];
        if(custom&&(custom.floor!==s.bridge.getFloor()||custom.image_id!==image(s)))return;
        const override=s.shared?.markers?.find(r=>r.entity_key===key);
        if(!custom&&!entity)return;
        const native=custom||entity;
        const pos=custom||override||entity.position;
        s.marker={key,title:native.title,description:native.description||'',type:custom?.marker_type||override?.marker_type||native.markerType,state:custom?.state||override?.state||'visible',u:point(pos)?pos.u:null,v:point(pos)?pos.v:null,custom:!!custom,floor:s.bridge.getFloor(),imageId:image(s)};
        s.markerRevision=revision(s,key,custom?'custom':'marker');
        const saved=savedMarkers(s)[key];
        if(saved&&saved.floor===s.marker.floor&&saved.imageId===image(s)&&saved.key===key&&saved.custom===s.marker.custom) {s.marker={...s.marker,...saved};s.markerRevision=Number.isInteger(saved.baseRevision)?saved.baseRevision:-1;message(s,'Brouillon local restauré. Il n’est pas publié. Rechargez les données si sa révision est ancienne.');}
        s.editGeneration++;
        s.history=global.NamelessMapRegions.createHistory(s.marker);s.placing=false;syncMarker(s);
    }
    function newMarker(s) {
        if(!canEdit(s)||s.busy)return;s.editGeneration++;
        s.marker={key:null,title:'Nouveau repère',description:'',type:'zone',state:'visible',u:null,v:null,custom:true,floor:s.bridge.getFloor(),imageId:image(s)};
        const saved=savedMarkers(s)['new:'+s.marker.floor];
        const restored=saved&&saved.key===null&&saved.custom===true&&saved.floor===s.marker.floor&&saved.imageId===image(s);
        if(restored)s.marker={...s.marker,...saved};
        s.markerRevision=0;s.history=global.NamelessMapRegions.createHistory(s.marker);s.placing=!point(s.marker);syncMarker(s);message(s,restored?'Brouillon du nouveau repère restauré. Il n’est pas publié.':'Nouveau repère privé. Cliquez sur la carte pour le placer.');
    }
    function captureMarker(s) {
        if(!canEdit(s)||!s.marker)return;
        const value=id=>s.root.querySelector('#workspace-marker-'+id).value;
        const previous=clone(s.marker);
        if(s.marker.custom){s.marker.title=value('title').trim();s.marker.description=value('description').trim();}
        s.marker.type=value('type');s.marker.state=value('state');
        s.marker.u=value('u')===''?null:Number(value('u'));s.marker.v=value('v')===''?null:Number(value('v'));
        if(JSON.stringify(previous)!==JSON.stringify(s.marker))s.history.push(s.marker);
        syncMarker(s);
    }
    function moveMarker(s, position) {
        if(!canEdit(s)||s.busy||s.mode!=='markers'||!s.marker||!point(position))return false;
        s.marker.u=position.u;s.marker.v=position.v;s.history.push(s.marker);s.placing=false;syncMarker(s);return true;
    }
    function clearDraftPoint(s){s.draftPoint?.off();if(s.draftPoint)s.bridge?.map.removeLayer(s.draftPoint);s.draftPoint=null;}
    function syncMarker(s) {
        clearDraftPoint(s);if(s.mode!=='markers')return;
        const get=id=>s.root.querySelector('#workspace-marker-'+id),m=s.marker;
        for(const id of ['title','description','type','state','u','v']) {const input=get(id);if(!input)continue;input.disabled=!m;input.value=m?String(m[id==='type'?'type':id]??''):'';}
        if(get('title')){get('title').readOnly=!m?.custom;get('description').readOnly=!m?.custom;get('state').querySelector('[value=draft]').disabled=!m?.custom;get('select').value=m?.key||'';}
        if(get('undo'))get('undo').disabled=!s.history?.canUndo;if(get('redo'))get('redo').disabled=!s.history?.canRedo;
        if(m&&point(m)) {
            const icon=global.L.divIcon({className:'workspace-draft-marker',iconSize:[32,32],iconAnchor:[16,16]});
            s.draftPoint=global.L.marker(s.bridge.getLatLng(m),{icon,draggable:true,bubblingMouseEvents:false,title:'Déplacer le repère'}).addTo(s.bridge.map);
            s.draftPoint.on('dragend',()=>moveMarker(s,s.bridge.getRelative(s.draftPoint.getLatLng())));
        }
    }
    function saveMarkerLocal(s) {
        if(!canEdit(s)||!s.marker)return false;captureMarker(s);
        try {const saved=savedMarkers(s);saved[markerDraftKey(s)]={...s.marker,baseRevision:s.markerRevision};global.localStorage.setItem(localKey(s),JSON.stringify(saved));message(s,'Brouillon enregistré dans ce navigateur. Aucune modification publiée.');return true;}
        catch(_){message(s,'Le navigateur ne permet pas d’enregistrer le brouillon.');return false;}
    }
    function forgetMarkerLocal(s,key){try{const saved=savedMarkers(s);delete saved[key];global.localStorage.setItem(localKey(s),JSON.stringify(saved));}catch(_){} }
    async function publishMarker(s) {
        if(!canEdit(s)||!s.marker)return false;captureMarker(s);const m=clone(s.marker);
        if(!point(m)||!m.title.trim()||!Object.hasOwn(TYPES,m.type)){message(s,'Renseignez un nom et placez le repère à l’intérieur de l’image.');return false;}
        const params=m.custom?{p_entity_key:m.key,p_title:m.title,p_description:m.description,p_marker_type:m.type,p_floor:m.floor,p_image_id:m.imageId,p_state:m.state,p_u:m.u,p_v:m.v,p_expected_revision:s.markerRevision}
            :{p_entity_key:m.key,p_marker_type:m.type,p_state:m.state,p_u:m.u,p_v:m.v,p_expected_revision:s.markerRevision};
        return mutate(s,m.custom?'map_workspace_save_custom_marker':'map_workspace_save_marker',params,data=>{forgetMarkerLocal(s,m.key||'new:'+m.floor);s.markerRevision=data.revision;const key=data.record?.entity_key||m.key;renderMarkerForm(s);loadMarker(s,key);});
    }
    async function resetMarker(s) {
        if(!s.marker?.key||s.marker.custom){message(s,'La restauration d’origine concerne les fiches déjà présentes dans l’atlas.');return false;}
        const key=s.marker.key;
        return mutate(s,'map_workspace_reset_marker',{p_entity_key:key,p_expected_revision:s.markerRevision},data=>{forgetMarkerLocal(s,key);s.markerRevision=data.revision;loadMarker(s,key);});
    }
    async function deleteMarker(s) {
        if(!s.marker?.key)return false;const m=clone(s.marker);
        const params={p_entity_key:m.key,p_expected_revision:s.markerRevision};
        if(!m.custom)Object.assign(params,{p_state:'deleted',p_u:m.u,p_v:m.v,p_marker_type:m.type});
        return mutate(s,m.custom?'map_workspace_delete_custom_marker':'map_workspace_save_marker',params,()=>{forgetMarkerLocal(s,m.key);s.marker=null;renderMarkerForm(s);});
    }
    function setMode(s, mode) {
        if(!canEdit(s)||!s.bridge||!['regions','markers','atlas'].includes(mode)||s.busy)return false;
        s.editGeneration++;s.mode=mode;s.placing=false;clearDraftPoint(s);s.bridge.closeSelection();
        global.NamelessMapRegions.active?.editor.close();s.bridge.setEditorMode(mode==='markers');
        for(const name of ['regions','markers','atlas']) {s.root.querySelector('#workspace-'+(name==='regions'?'region':name==='markers'?'marker':'atlas')+'-tool').hidden=name!==mode;}
        for(const button of s.root.querySelectorAll('[data-workspace-mode]')){const selected=button.dataset.workspaceMode===mode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
        if(mode==='regions'){global.NamelessMapRegions.active.setWorkspaceRecords(s.shared?.regions||[]);global.NamelessMapRegions.active.editor.open();regionChanged(s);}
        else if(mode==='markers')renderMarkerForm(s);
        else {
            const config=s.bridge.catalog.floors.find(f=>Number(f.id)===s.bridge.getFloor()),host=s.root.querySelector('#workspace-atlas-tool');
            host.replaceChildren(el('h2','','Atlas du palier '+config.id),el('p','',config.width+' × '+config.height+' pixels'),el('p','','Les sommets et repères utilisent la position relative dans cette image. La calibration X/Z est conservée.'),el('a','','Ouvrir l’image originale ↗'));host.lastChild.href=config.originalImage;host.lastChild.target='_blank';host.lastChild.rel='noopener';
        }
        syncActions(s);s.bridge.map.invalidateSize({pan:true,animate:false});return true;
    }
    function lock(s, text, login=false) {
        s.authorized=false;s.uid=null;s.authGeneration++;s.serverReady=false;
        for(const off of s.off)off();s.off=[];
        global.NamelessMapRegions.active?.editor.close();clearDraftPoint(s);global.NamelessMapPage.destroy();s.bridge=null;
        s.marker=null;s.markerRevision=0;s.history=null;s.shared=null;s.regionKey=null;s.regionRevision=0;s.busy=false;s.editGeneration++;
        s.root.querySelector('#workspace-marker-tool').replaceChildren();s.root.querySelector('#workspace-message').textContent='';
        s.root.querySelector('#map-workspace').hidden=true;s.root.querySelector('#workspace-service').hidden=true;s.root.querySelector('#map-workspace-gate').hidden=false;
        s.root.querySelector('#map-workspace-gate-message').textContent=text;s.root.querySelector('#map-workspace-login').hidden=!login;
    }
    async function authorize(s) {
        if(!alive(s))return;
        lock(s,'Vérification de votre accès…');const generation=s.authGeneration;
        const db=global.supabase;if(!db?.auth?.getUser){lock(s,'Le service de connexion est indisponible. Réessayez.');return;}
        try {
            const user=await db.auth.getUser();if(!alive(s)||generation!==s.authGeneration)return;
            if(user.error||!user.data?.user){lock(s,'Connectez-vous avec un compte administrateur pour ouvrir l’atelier.',true);return;}
            const role=await db.rpc('current_user_role');if(!alive(s)||generation!==s.authGeneration)return;
            if(role.error||role.data!=='admin'){lock(s,'Cet atelier est réservé aux administrateurs du site.');return;}
            s.uid=user.data.user.id;s.authorized=true;
            await readShared(s);if(!canEdit(s)||generation!==s.authGeneration)return;
            s.root.querySelector('#map-workspace-gate').hidden=true;s.root.querySelector('#map-workspace').hidden=false;
            s.bridge=await global.NamelessMapPage.init(s.root,{canEdit:()=>canEdit(s),regionDraftKey:()=>global.NamelessMapRegions.STORAGE_KEY+'.'+s.uid,
                regionRevision:key=>s.regionKey===key?s.regionRevision:revision(s,key,'region')});
            if(!canEdit(s)||generation!==s.authGeneration||!s.bridge)return;
            const off=s.bridge.on('floor',()=>{s.marker=null;s.history=null;s.regionKey=null;setMode(s,s.mode);});s.off.push(off);
            s.off.push(s.bridge.on('selection',entity=>{if(s.mode==='markers'&&entity?.key)loadMarker(s,entity.key);}));
            s.off.push(s.bridge.on('marker',event=>{if(s.mode==='markers')loadMarker(s,event.entities?.[0]?.key);}));
            const click=event=>{if(s.mode==='markers'&&s.placing)moveMarker(s,s.bridge.getRelative(event.latlng));};s.bridge.map.on('click',click);s.off.push(()=>s.bridge?.map.off('click',click));
            setMode(s,s.mode);s.bridge.map.invalidateSize({pan:false});
        }catch(_){if(alive(s)&&generation===s.authGeneration)lock(s,'L’accès ne peut pas être vérifié. Réessayez dans quelques instants.');}
    }
    async function init(root) {
        const main=(root?.matches?.('.map-admin-workspace')?root:root?.querySelector?.('.map-admin-workspace'))||document.querySelector('.map-admin-workspace');if(!main)return;
        if(active?.root===main)return active.api;destroy();
        const s={root:main,controller:new AbortController(),off:[],authorized:false,uid:null,authGeneration:0,editGeneration:0,serverReady:false,busy:false,mode:'regions',marker:null,shared:null};active=s;
        s.api={getState:()=>({authorized:canEdit(s),serverReady:s.serverReady,mode:s.mode,busy:s.busy,marker:clone(s.marker),regionRevision:s.regionRevision}),mode:value=>setMode(s,value),selectMarker:key=>loadMarker(s,key),newMarker:()=>newMarker(s),moveMarker:value=>moveMarker(s,value),saveLocal:()=>saveMarkerLocal(s),publishMarker:()=>publishMarker(s),publishRegion:()=>publishRegion(s),resetRegion:()=>resetRegion(s),resetMarker:()=>resetMarker(s),refresh:async()=>{await verified(s);await readShared(s);await Promise.all([s.bridge.reloadOverrides(),global.NamelessMapRegions.active.reloadRemote()]);s.regionKey=null;regionChanged(s);const draft=global.NamelessMapRegions.active.editor.getDraft();if(draft?.entityKey)s.regionRevision=revision(s,draft.entityKey,'region');if(s.marker?.key){s.markerRevision=revision(s,s.marker.key,s.marker.custom?'custom':'marker');delete s.marker.baseRevision;}message(s,'Données rechargées. Votre brouillon peut être publié sur cette nouvelle révision.');}};
        on(s,document,'nameless:auth-changed',()=>authorize(s));on(s,main.querySelector('#workspace-retry'),'click',()=>authorize(s));
        on(s,main,'nameless:region-draft',()=>regionChanged(s));
        on(s,main.querySelector('#workspace-region-publish'),'click',()=>publishRegion(s));on(s,main.querySelector('#workspace-region-reset'),'click',()=>resetRegion(s));
        on(s,main.querySelector('#workspace-refresh'),'click',()=>s.api.refresh().catch(error=>message(s,errorText(error))));
        for(const button of main.querySelectorAll('[data-workspace-mode]'))on(s,button,'click',()=>setMode(s,button.dataset.workspaceMode));
        on(s,main.querySelector('.workspace-tool-tabs'),'keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...main.querySelectorAll('[data-workspace-mode]')],index=buttons.indexOf(event.target);if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:-1)+3)%3;buttons[next].click();buttons[next].focus();});
        await authorize(s);return s.api;
    }
    function destroy(){const s=active;if(!s)return;lock(s,'Accès administrateur');active=null;s.controller.abort();for(const off of s.off)off();}
    const api=global.NamelessMapWorkspace={init,destroy};Object.defineProperty(api,'active',{get:()=>active?.api||null});
    function start(){if(!global.NamelessSpaRouter?.controlsLifecycle)init();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
