/* Authenticated headquarters: real planning, Paris calendar and persisted attendance.
   New services are optional until migration 007 is applied; existing planning remains usable. */
(function (global) {
    'use strict';
    global.NamelessTranslations = global.NamelessTranslations || {};
    global.NamelessTranslations.en = global.NamelessTranslations.en || {};
    Object.assign(global.NamelessTranslations.en, {
        "Guilde Nameless · SAO France": "Nameless Guild · SAO France",
        "Organisez vos expéditions et suivez la vie de la guilde.": "Organise expeditions and follow guild life.",
        "Ouverture du quartier général…": "Opening headquarters…",
        "Aperçu": "Overview", "Expéditions": "Expeditions", "Membres": "Members", "Paramètres": "Settings",
        "Prochaines expéditions": "Upcoming expeditions", "Voir toutes ›": "View all ›", "Voir tous ›": "View all ›",
        "Chargement des événements publiés…": "Loading published events…", "Mois précédent": "Previous month", "Mois suivant": "Next month",
        "Événements du mois": "Events this month", "Dernières annonces": "Latest announcements", "Chargement des annonces…": "Loading announcements…",
        "Membres de la guilde": "Guild members", "Chargement de l’annuaire…": "Loading member directory…", "Membres enregistrés dans la guilde.": "Registered guild members.",
        "Accès rapides": "Quick access", "Guide de la guilde": "Guild guide", "Voir les objectifs ›": "View objectives ›", "Chargement des objectifs…": "Loading objectives…",
        "Créer une expédition": "Create expedition", "Rechercher une expédition…": "Search expeditions…", "Rechercher une expédition": "Search expeditions",
        "Tous les types": "All types", "Actualiser": "Refresh", "Annuaire des membres": "Member directory", "Gérer les membres ›": "Manage members ›",
        "Rechercher un membre…": "Search members…", "Rechercher un membre": "Search members", "Objectifs et ressources": "Objectives and resources", "Administrer ›": "Administration ›",
        "Personnage et présence": "Character and attendance", "Modifier mon profil ›": "Edit my profile ›", "Bienvenue au quartier général": "Welcome to headquarters",
        "Connectez-vous avec votre compte membre pour retrouver les expéditions, le calendrier et les échanges de la guilde.": "Sign in with your member account to access expeditions, the calendar and guild discussions.",
        "Connexion à la guilde": "Guild sign in", "Fermer la fiche": "Close details", "Ouverte": "Open", "En préparation": "Preparing", "Fermée": "Closed", "Annulée": "Cancelled",
        "inscrits": "registered", "événements": "events", "Administration": "Administration", "Membre": "Member", "Participants": "Participants",
        "Aucune expédition publiée pour cette sélection.": "No expeditions published for this selection.", "Le calendrier n’a pas pu être chargé.": "The calendar could not be loaded.",
        "Sélectionnez un jour marqué pour voir ses expéditions.": "Select a marked day to view its expeditions.", "Aucun événement publié ce mois-ci.": "No events published this month.",
        "L’annuaire n’a pas pu être chargé.": "The member directory could not be loaded.", "Aucun membre pour cette sélection.": "No members match this selection.",
        "Les inscriptions et les checklists attendent l’activation du service de guilde. Le planning reste disponible.": "Registration and checklists are awaiting guild service activation. The schedule remains available.",
        "Les inscriptions et les checklists attendent l’activation du service de guilde.": "Registration and checklists are awaiting guild service activation.",
        "Le planning n’a pas pu être chargé. Utilisez Actualiser pour réessayer.": "The schedule could not be loaded. Use Refresh to try again.", "Chargement du calendrier…": "Loading calendar…",
        "Les détails d’inscription n’ont pas pu être chargés.": "Registration details could not be loaded.", "Aucune inscription pour le moment.": "No registrations yet.",
        "Votre rôle dans le groupe": "Your group role", "Modifier mon inscription": "Update my registration", "M’inscrire": "Register", "Me désinscrire": "Unregister",
        "Enregistrement…": "Saving…", "Inscription enregistrée.": "Registration saved.", "Désinscription enregistrée.": "Registration cancelled.", "Ma préparation": "My preparation", "Préparation enregistrée.": "Preparation saved.",
        "Ce groupe est complet pour le rôle choisi.": "This group is full for the selected role.", "Les inscriptions sont fermées pour cette expédition.": "Registration is closed for this expedition.",
        "Votre accès ne permet pas cette action.": "Your access does not permit this action.", "La modification n’a pas pu être enregistrée. Réessayez.": "The change could not be saved. Try again.",
        "Date et heure · Paris": "Date and time · Paris", "Palier (facultatif)": "Floor (optional)", "Lieu (facultatif)": "Location (optional)", "Places (facultatif)": "Slots (optional)",
        "Capacité totale (facultatif)": "Total capacity (optional)", "Checklist · une ligne par préparation": "Checklist · one preparation per line", "Publier l’expédition": "Publish expedition",
        "Les places par rôle et les checklists attendent l’activation du service de guilde.": "Role slots and checklists are awaiting guild service activation.",
        "Cette date n’existe pas dans le fuseau de Paris.": "This date does not exist in the Paris time zone.", "Choisissez une date future.": "Choose a future date.", "Publication…": "Publishing…"
    });
    var state = null;
    var typeLabels = { raid: 'Raid', reunion: 'Réunion', event: 'Événement', pvp: 'PvP', construction: 'Construction', autre: 'Autre' };
    var statusLabels = { open: 'Ouverte', preparing: 'En préparation', closed: 'Fermée', cancelled: 'Annulée' };
    var roles = ['Tank', 'DPS', 'Support'];
    function el(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
    function empty(target, text) { target.replaceChildren(el('div', 'hq-empty', text)); }
    function tr(text) { return global.NamelessI18n ? global.NamelessI18n.translate(text) : text; }
    function locale() { return global.NamelessI18n ? global.NamelessI18n.getLocale() : 'fr-FR'; }
    function key(date) { return global.NamelessGuildDates.dateKey(date); }
    function fmt(date, opts) { return new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: 'Europe/Paris' }, opts)).format(new Date(date)); }
    function valid(s) { return state === s && !s.controller.signal.aborted && !!global.currentUser && global.currentUser.id === s.user.id; }
    function listen(s, target, event, fn) { if (target) target.addEventListener(event, fn, { signal: s.controller.signal }); }
    function esc(text) { return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function errorText(error) {
        var code = String(error && (error.message || error.code) || '');
        if (/event_full|role_full/.test(code)) return tr('Ce groupe est complet pour le rôle choisi.');
        if (/event_closed/.test(code)) return tr('Les inscriptions sont fermées pour cette expédition.');
        if (/guild_access_denied|admin_required/.test(code)) return tr('Votre accès ne permet pas cette action.');
        return tr('La modification n’a pas pu être enregistrée. Réessayez.');
    }
    function switchTab(s, name, focus) {
        var target = s.root.querySelector('[data-hq-tab="' + name + '"]');
        if (!target) return;
        s.root.querySelectorAll('[data-hq-tab]').forEach(function (button) { var active = button === target; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
        s.root.querySelectorAll('[data-hq-panel]').forEach(function (panel) { panel.hidden = panel.dataset.hqPanel !== name; });
        if (focus) target.focus();
    }
    function eventCard(s, event) {
        var button = el('button', 'hq-event'); button.type = 'button'; button.dataset.type = event.type_event;
        button.setAttribute('aria-haspopup', 'dialog'); button.dataset.eventId = event.id; button.dataset.selected = String(s.selectedEvent === event.id);
        var art = el('span', 'hq-event-art'); art.setAttribute('aria-hidden', 'true');
        var copy = el('span', 'hq-event-copy'); copy.appendChild(el('strong', '', event.titre));
        var where = [tr(typeLabels[event.type_event] || event.type_event)];
        if (event.floor != null) where.unshift(tr('Palier') + ' ' + event.floor);
        if (event.location) where.push(event.location);
        copy.appendChild(el('p', '', where.join(' · ')));
        copy.appendChild(el('p', 'item-date', fmt(event.date_event, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · Paris'));
        var people = s.attendance.filter(function (row) { return row.event_id === event.id; });
        if (s.services) {
            var roleLine = el('span', 'hq-event-roles');
            roles.forEach(function (role) { var count = people.filter(function (p) { return p.group_role === role; }).length; var max = event[role.toLowerCase() + '_slots']; roleLine.appendChild(el('span', '', role + ' ' + count + (max == null ? '' : '/' + max))); });
            copy.appendChild(roleLine);
        }
        var side = el('span', 'hq-event-side');
        if (s.services) side.appendChild(el('span', '', people.length + (event.capacity == null ? ' ' + tr('inscrits') : ' / ' + event.capacity)));
        var closed = event.status === 'closed' || event.status === 'cancelled';
        side.appendChild(el('span', 'hq-tag' + (closed ? ' closed' : ''), tr(statusLabels[event.status || 'open'] || event.status)));
        side.appendChild(el('span', '', '›'));
        button.append(art, copy, side);
        listen(s, button, 'click', function () { openEvent(s, event, button); });
        return button;
    }
    function renderEvents(s) {
        if (!valid(s)) return;
        var query = (s.root.querySelector('[data-guild-event-search]').value || '').trim().toLocaleLowerCase();
        var type = s.root.querySelector('[data-guild-event-type]').value;
        s.root.querySelectorAll('[data-guild-events]').forEach(function (list) {
            var rows = list.dataset.guildEvents === 'upcoming' ? s.upcoming.slice(0, 3) : s.upcoming.filter(function (event) { return (!type || event.type_event === type) && (!query || (event.titre + ' ' + (event.location || '') + ' ' + (event.description || '')).toLocaleLowerCase().includes(query)); });
            list.replaceChildren();
            if (!rows.length) empty(list, tr('Aucune expédition publiée pour cette sélection.'));
            else rows.forEach(function (event) { list.appendChild(eventCard(s, event)); });
        });
    }
    function renderCalendar(s) {
        if (!valid(s)) return;
        var year = s.month.getUTCFullYear(), month = s.month.getUTCMonth();
        s.root.querySelector('#hq-month-label').textContent = fmt(new Date(Date.UTC(year, month, 15, 12)), { month: 'long', year: 'numeric' });
        var grid = s.root.querySelector('#hq-calendar'); grid.replaceChildren();
        for (var weekday = 0; weekday < 7; weekday++) grid.appendChild(el('span', 'hq-weekday', fmt(new Date(Date.UTC(2026, 0, 5 + weekday, 12)), { weekday: 'short' })));
        var offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
        for (var blank = 0; blank < offset; blank++) { var filler = el('span'); filler.setAttribute('aria-hidden', 'true'); grid.appendChild(filler); }
        var count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        for (var day = 1; day <= count; day++) {
            var date = new Date(Date.UTC(year, month, day, 12)); var dateKey = key(date);
            var events = s.monthEvents.filter(function (event) { return key(event.date_event) === dateKey; });
            var node = el(events.length ? 'button' : 'span', 'hq-day', String(day));
            if (dateKey === key(new Date())) node.setAttribute('aria-current', 'date');
            if (events.length) {
                node.type = 'button'; node.dataset.count = String(events.length); node.dataset.day = dateKey;
                node.setAttribute('aria-label', fmt(date, { day: 'numeric', month: 'long' }) + ' · ' + events.length + ' ' + tr('événements'));
                node.setAttribute('aria-pressed', String(s.selectedDay === dateKey));
                listen(s, node, 'click', function (event) { s.selectedDay = event.currentTarget.dataset.day; renderCalendar(s); });
            }
            grid.appendChild(node);
        }
        var rows = s.root.querySelector('#hq-day-events'); rows.replaceChildren();
        if (s.selectedDay) s.monthEvents.filter(function (event) { return key(event.date_event) === s.selectedDay; }).forEach(function (event) { rows.appendChild(eventCard(s, event)); });
        grid.setAttribute('aria-busy', String(!!s.monthLoading));
        s.root.querySelector('#hq-calendar-note').textContent = s.monthLoading ? tr('Chargement du calendrier…') : s.calendarError ? tr('Le calendrier n’a pas pu être chargé.') : s.monthEvents.length ? tr('Sélectionnez un jour marqué pour voir ses expéditions.') : tr('Aucun événement publié ce mois-ci.');
    }
    function renderMembers(s) {
        if (!valid(s)) return;
        var query = (s.root.querySelector('[data-guild-member-search]').value || '').toLocaleLowerCase();
        s.root.querySelector('[data-guild-member-count]').textContent = s.memberError ? '' : '(' + s.members.length + ')';
        s.root.querySelectorAll('[data-guild-members]').forEach(function (list) {
            var rows = s.members.filter(function (member) { return ((member.minecraft_username || '') + ' ' + (member.username || '')).toLocaleLowerCase().includes(query); });
            if (list.dataset.guildMembers === 'preview') rows = s.members.slice(0, 5);
            list.replaceChildren();
            if (!rows.length) { empty(list, s.memberError ? tr('L’annuaire n’a pas pu être chargé.') : tr('Aucun membre pour cette sélection.')); return; }
            rows.forEach(function (member) {
                var row = el('div', 'hq-member');
                var image = el('img'); image.alt = ''; image.loading = 'lazy';
                image.src = member.minecraft_username && /^[A-Za-z0-9_]{3,16}$/.test(member.minecraft_username) ? 'https://mc-heads.net/avatar/' + encodeURIComponent(member.minecraft_username) + '/32' : '/assets/brand/nameless-emblem-64.webp';
                listen(s, image, 'error', function () { if (!image.src.includes('/assets/brand/')) image.src = '/assets/brand/nameless-emblem-64.webp'; });
                row.appendChild(image);
                var name = el('span', 'hq-member-name', member.minecraft_username || member.username); name.appendChild(el('small', '', member.role === 'admin' ? tr('Administration') : tr('Membre'))); row.appendChild(name);
                if (member.classe) row.appendChild(el('span', '', tr(member.classe)));
                list.appendChild(row);
            });
        });
    }
    async function loadAttendance(s) {
        var request = ++s.attendanceRequest;
        var ids = Array.from(new Set(s.upcoming.concat(s.monthEvents).map(function (event) { return event.id; }).filter(Boolean)));
        if (!ids.length) { s.attendance = []; return; }
        var result = await s.client.from('guild_event_attendance').select('event_id,user_id,group_role').in('event_id', ids);
        if (!valid(s) || request !== s.attendanceRequest) return;
        if (result.error) { s.services = false; s.attendance = []; } else s.attendance = result.data || [];
    }
    async function loadMonth(s) {
        var request = ++s.monthRequest;
        s.monthLoading = true; renderCalendar(s);
        var year = s.month.getUTCFullYear(), month = s.month.getUTCMonth();
        function boundary(delta) { var date = new Date(Date.UTC(year, month + delta, 1)); return global.NamelessGuildDates.dateInputToISOString(date.toISOString().slice(0, 10) + 'T00:00'); }
        var result;
        try { result = await s.client.from('guild_planning').select('*').gte('date_event', boundary(0)).lt('date_event', boundary(1)).order('date_event', { ascending: true }); }
        catch (error) { result = { error: error }; }
        if (!valid(s) || request !== s.monthRequest) return;
        s.calendarError = !!result.error; s.monthEvents = result.error ? [] : result.data || [];
        if (s.services) await loadAttendance(s);
        if (!valid(s) || request !== s.monthRequest) return;
        s.monthLoading = false;
        renderCalendar(s); renderEvents(s);
    }
    function updateSetup(s) {
        s.root.querySelector('[data-guild-setup]').textContent = s.services ? '' : tr('Les inscriptions et les checklists attendent l’activation du service de guilde. Le planning reste disponible.');
    }
    async function refresh(s) {
        var request = ++s.refreshRequest;
        var results = await Promise.allSettled([
            s.client.from('guild_planning').select('*').gte('date_event', new Date().toISOString()).order('date_event', { ascending: true }).limit(100),
            s.client.from('user_profiles').select('id,username,minecraft_username,classe,niveau,role').in('role', ['membre', 'admin']).order('username'),
            s.client.from('guild_event_attendance').select('event_id,user_id,group_role').limit(1)
        ]);
        if (!valid(s) || request !== s.refreshRequest) return;
        var planning = results[0].status === 'fulfilled' ? results[0].value : { error: true };
        var members = results[1].status === 'fulfilled' ? results[1].value : { error: true };
        var attendance = results[2].status === 'fulfilled' ? results[2].value : { error: true };
        s.services = !attendance.error;
        s.upcoming = planning.error ? [] : planning.data || []; s.members = members.error ? [] : members.data || []; s.memberError = !!members.error;
        if (s.services) await loadAttendance(s);
        if (!valid(s) || request !== s.refreshRequest) return;
        renderEvents(s); renderMembers(s); updateSetup(s);
        if (planning.error) s.root.querySelectorAll('[data-guild-events]').forEach(function (list) { empty(list, tr('Le planning n’a pas pu être chargé. Utilisez Actualiser pour réessayer.')); });
        await loadMonth(s);
    }
    function showDialog(s, trigger) {
        if (s.closeTimer) global.clearTimeout(s.closeTimer);
        s.closeTimer = null; s.dialog.classList.remove('is-closing');
        s.returnFocus = trigger || document.activeElement;
        if (!s.dialog.open) s.dialog.showModal();
    }
    function closeDialog(s) {
        if (!s.dialog.open || s.dialog.classList.contains('is-closing')) return;
        s.dialogRequest++;
        if (!global.matchMedia || global.matchMedia('(prefers-reduced-motion: reduce)').matches) { s.dialog.close(); return; }
        s.dialog.classList.add('is-closing');
        s.closeTimer = global.setTimeout(function () { s.closeTimer = null; if (valid(s)) { s.dialog.close(); s.dialog.classList.remove('is-closing'); } }, 155);
    }
    async function openEvent(s, event, trigger) {
        var request = ++s.dialogRequest; s.selectedEvent = event.id; s.returnEventId = event.id; var wasOpen = s.dialog.open;
        s.root.querySelectorAll('[data-event-id]').forEach(function (button) { button.dataset.selected = String(button.dataset.eventId === event.id); });
        var content = s.root.querySelector('[data-guild-dialog-content]');
        content.replaceChildren(el('h2', '', event.titre)); content.firstChild.id = 'guild-event-dialog-title';
        content.appendChild(el('p', 'hq-calendar-note', fmt(event.date_event, { dateStyle: 'full', timeStyle: 'short' }) + ' · Paris'));
        if (event.description) content.appendChild(el('p', 'hq-description', event.description));
        showDialog(s, trigger);
        if (!s.services) { content.appendChild(el('p', 'hq-calendar-note', tr('Les inscriptions et les checklists attendent l’activation du service de guilde.'))); return; }
        var results = await Promise.allSettled([
            s.client.from('guild_event_attendance').select('event_id,user_id,group_role').eq('event_id', event.id),
            s.client.from('guild_event_checklist').select('id,label,sort_order').eq('event_id', event.id).order('sort_order'),
            s.client.from('guild_event_checks').select('checklist_id,done').eq('user_id', s.user.id)
        ]);
        if (!valid(s) || request !== s.dialogRequest || !s.dialog.open) return;
        var values = results.map(function (result) { return result.status === 'fulfilled' ? result.value : { error: true }; });
        if (values.some(function (result) { return result.error; })) { content.appendChild(el('p', 'hq-feedback', tr('Les détails d’inscription n’ont pas pu être chargés.'))); return; }
        var attendance = values[0].data || [], own = attendance.find(function (row) { return row.user_id === s.user.id; });
        content.appendChild(el('h3', '', tr('Participants') + ' (' + attendance.length + (event.capacity == null ? '' : '/' + event.capacity) + ')'));
        var people = el('div', 'hq-members'); content.appendChild(people);
        if (!attendance.length) empty(people, tr('Aucune inscription pour le moment.'));
        attendance.forEach(function (row) { var member = s.members.find(function (m) { return m.id === row.user_id; }); var item = el('div', 'hq-member'); item.append(el('span', 'hq-member-name', member ? member.minecraft_username || member.username : tr('Membre')), el('span', '', row.group_role)); people.appendChild(item); });
        var form = el('form', 'hq-form hq-signup-actions');
        var label = el('label', '', tr('Votre rôle dans le groupe')); var select = el('select'); select.name = 'group_role';
        roles.forEach(function (role) { var option = el('option', '', role); option.value = role; option.selected = !!own && own.group_role === role; select.appendChild(option); }); label.appendChild(select);
        var save = el('button', 'hq-button', tr(own ? 'Modifier mon inscription' : 'M’inscrire')); save.type = 'submit';
        save.disabled = !!(event.status && event.status !== 'open') || new Date(event.date_event) <= new Date();
        form.append(label, save);
        var feedback = el('p', 'hq-feedback'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
        async function mutate(name, args) {
            form.querySelectorAll('button').forEach(function (button) { button.disabled = true; }); feedback.textContent = tr('Enregistrement…');
            var result;
            try { result = await s.client.rpc(name, args); } catch (error) { result = { error: error }; }
            if (!valid(s)) return;
            if (result.error) {
                if (request === s.dialogRequest && s.dialog.open) { feedback.textContent = errorText(result.error); form.querySelectorAll('button').forEach(function (button) { button.disabled = false; }); }
                return;
            }
            await refresh(s);
            if (!valid(s) || request !== s.dialogRequest || !s.dialog.open) return;
            var latest = s.upcoming.concat(s.monthEvents).find(function (item) { return item.id === event.id; }) || event;
            await openEvent(s, latest, s.returnFocus);
            var message = s.root.querySelector('[data-guild-dialog-content] .hq-feedback'); if (message) message.textContent = tr(name === 'guild_event_unregister' ? 'Désinscription enregistrée.' : 'Inscription enregistrée.');
        }
        listen(s, form, 'submit', function (e) { e.preventDefault(); mutate('guild_event_register', { target_event: event.id, requested_role: select.value }); });
        if (own) { var cancel = el('button', 'hq-button', tr('Me désinscrire')); cancel.type = 'button'; listen(s, cancel, 'click', function () { mutate('guild_event_unregister', { target_event: event.id }); }); form.appendChild(cancel); }
        content.append(form, feedback);
        if (wasOpen) select.focus();
        var checklist = values[1].data || [], checks = values[2].data || [];
        if (checklist.length) {
            content.appendChild(el('h3', '', tr('Ma préparation')));
            checklist.forEach(function (item) {
                var checkLabel = el('label', 'hq-check'); var check = el('input'); check.type = 'checkbox'; check.checked = checks.some(function (entry) { return entry.checklist_id === item.id && entry.done; });
                listen(s, check, 'change', async function () {
                    var wanted = check.checked; check.disabled = true;
                    var result; try { result = await s.client.rpc('guild_event_set_check', { target_checklist: item.id, completed: wanted }); } catch (error) { result = { error: error }; }
                    if (!valid(s) || request !== s.dialogRequest) return;
                    check.disabled = false; if (result.error) { check.checked = !wanted; feedback.textContent = errorText(result.error); } else feedback.textContent = tr('Préparation enregistrée.');
                });
                checkLabel.append(check, document.createTextNode(item.label)); content.appendChild(checkLabel);
            });
        }
    }
    function openCreate(s, trigger) {
        if (s.role !== 'admin') return;
        s.dialogRequest++; s.selectedEvent = null; s.returnEventId = null;
        var content = s.root.querySelector('[data-guild-dialog-content]');
        content.innerHTML = '<h2 id="guild-event-dialog-title">' + esc(tr('Créer une expédition')) + '</h2><form class="hq-form" data-create-form><label>' + esc(tr('Titre')) + '<input name="titre" required maxlength="120"></label><div class="hq-form-row"><label>' + esc(tr('Date et heure · Paris')) + '<input name="date_event" type="datetime-local" required></label><label>' + esc(tr('Type')) + '<select name="type_event">' + Object.keys(typeLabels).map(function (type) { return '<option value="' + type + '">' + esc(tr(typeLabels[type])) + '</option>'; }).join('') + '</select></label><label>' + esc(tr('Palier (facultatif)')) + '<input name="floor" type="number" min="1" max="100"' + (s.services ? '' : ' disabled') + '></label></div><label>' + esc(tr('Description')) + '<textarea name="description" rows="3" maxlength="8000"></textarea></label>' + (s.services ? '<label>' + esc(tr('Lieu (facultatif)')) + '<input name="location" maxlength="160"></label><div class="hq-form-row">' + roles.map(function (role) { return '<label>' + role + ' · ' + esc(tr('Places (facultatif)')) + '<input type="number" name="' + role.toLowerCase() + '_slots" min="0" max="100"></label>'; }).join('') + '</div><label>' + esc(tr('Capacité totale (facultatif)')) + '<input type="number" name="capacity" min="1" max="300"></label><label>' + esc(tr('Checklist · une ligne par préparation')) + '<textarea name="checklist" rows="3" maxlength="4000"></textarea></label>' : '<p class="hq-calendar-note">' + esc(tr('Les places par rôle et les checklists attendent l’activation du service de guilde.')) + '</p>') + '<button class="hq-button" type="submit">' + esc(tr('Publier l’expédition')) + '</button><p class="hq-feedback" role="status" aria-live="polite"></p></form>';
        var form = content.querySelector('form'); var request = s.dialogRequest;
        listen(s, form, 'submit', async function (event) {
            event.preventDefault(); var data = new FormData(form); var feedback = form.querySelector('.hq-feedback');
            var date; try { date = global.NamelessGuildDates.dateInputToISOString(data.get('date_event')); } catch (_) { feedback.textContent = tr('Cette date n’existe pas dans le fuseau de Paris.'); return; }
            if (new Date(date) <= new Date()) { feedback.textContent = tr('Choisissez une date future.'); return; }
            var payload = { titre: String(data.get('titre') || '').trim(), date_event: date, type_event: data.get('type_event'), description: String(data.get('description') || '').trim(), created_by: s.user.id };
            var submit = form.querySelector('button[type="submit"]'); submit.disabled = true; feedback.textContent = tr('Publication…');
            var result;
            try {
                if (s.services) {
                    var config = { floor: nullableNumber(data.get('floor')), location: String(data.get('location') || '').trim() || null, capacity: nullableNumber(data.get('capacity')) };
                    roles.forEach(function (role) { config[role.toLowerCase() + '_slots'] = nullableNumber(data.get(role.toLowerCase() + '_slots')); });
                    var checklist = String(data.get('checklist') || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
                    result = await s.client.rpc('guild_event_create', { event_title: payload.titre, event_date: date, event_type: payload.type_event, event_description: payload.description, event_config: config, preparation: checklist });
                } else result = await s.client.from('guild_planning').insert(payload);
            } catch (error) { result = { error: error }; }
            if (!valid(s)) return;
            if (result.error) { if (request === s.dialogRequest && s.dialog.open) { submit.disabled = false; feedback.textContent = errorText(result.error); } return; }
            if (request === s.dialogRequest && s.dialog.open) closeDialog(s);
            await refresh(s);
        });
        showDialog(s, trigger);
    }
    function nullableNumber(value) { return value == null || String(value).trim() === '' ? null : Number(value); }
    function destroy() {
        if (!state) return;
        var old = state; state = null; old.controller.abort(); old.monthRequest++; old.dialogRequest++;
        if (old.closeTimer) global.clearTimeout(old.closeTimer);
        if (old.dialog.open) old.dialog.close();
    }
    async function init(root, options) {
        destroy();
        if (!root || !root.matches('[data-guild-hq]') || !options || !options.client || !options.user || !['membre', 'admin'].includes(options.role)) return;
        var today = key(new Date()).split('-');
        var s = { root: root, client: options.client, user: options.user, role: options.role, controller: new AbortController(), month: new Date(Date.UTC(Number(today[0]), Number(today[1]) - 1, 1)), monthRequest: 0, dialogRequest: 0, refreshRequest: 0, attendanceRequest: 0, services: false, upcoming: [], monthEvents: [], members: [], attendance: [], selectedDay: null, dialog: root.querySelector('#guild-event-dialog') };
        state = s;
        if (global.NamelessI18n) global.NamelessI18n.apply(root);
        root.querySelectorAll('[data-hq-tab]').forEach(function (button) {
            listen(s, button, 'click', function () { switchTab(s, button.dataset.hqTab); });
            listen(s, button, 'keydown', function (event) {
                var tabs = Array.from(root.querySelectorAll('[data-hq-tab]')), index = tabs.indexOf(button), next;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = tabs.length - 1; else return;
                event.preventDefault(); switchTab(s, tabs[next].dataset.hqTab, true);
            });
        });
        root.querySelectorAll('[data-hq-go]').forEach(function (button) { listen(s, button, 'click', function () { switchTab(s, button.dataset.hqGo, true); }); });
        root.querySelectorAll('[data-calendar-offset]').forEach(function (button) { listen(s, button, 'click', function () { s.month.setUTCMonth(s.month.getUTCMonth() + Number(button.dataset.calendarOffset)); s.selectedDay = null; s.monthEvents = []; loadMonth(s); }); });
        root.querySelectorAll('[data-guild-admin],[data-guild-create]').forEach(function (node) { node.hidden = options.role !== 'admin'; });
        listen(s, root.querySelector('[data-guild-create]'), 'click', function (event) { openCreate(s, event.currentTarget); });
        listen(s, root.querySelector('[data-guild-refresh]'), 'click', function () { refresh(s); });
        listen(s, root.querySelector('[data-guild-event-search]'), 'input', function () { renderEvents(s); });
        listen(s, root.querySelector('[data-guild-event-type]'), 'change', function () { renderEvents(s); });
        listen(s, root.querySelector('[data-guild-member-search]'), 'input', function () { renderMembers(s); });
        listen(s, root.querySelector('[data-guild-dialog-close]'), 'click', function () { closeDialog(s); });
        listen(s, s.dialog, 'cancel', function (event) { event.preventDefault(); closeDialog(s); });
        listen(s, s.dialog, 'close', function () {
            s.dialogRequest++; var trigger = s.returnFocus;
            if (!trigger || !trigger.isConnected) trigger = Array.from(root.querySelectorAll('[data-event-id]')).find(function (button) { return button.dataset.eventId === s.returnEventId && !button.closest('[data-hq-panel]').hidden; });
            if (!trigger) trigger = root.querySelector('[data-hq-tab][aria-selected="true"]');
            if (trigger && trigger.isConnected) trigger.focus();
        });
        listen(s, document, 'nameless:languagechange', function () { renderEvents(s); renderCalendar(s); renderMembers(s); updateSetup(s); });
        switchTab(s, 'overview'); renderCalendar(s);
        await refresh(s);
    }
    global.NamelessGuildExpeditions = { init: init, destroy: destroy };
})(window);
