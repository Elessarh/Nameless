# Tests XSS manuels — Nameless (Phase 1 sécurité)

But : vérifier qu'aucune donnée utilisateur ne s'exécute. Le contenu
dangereux doit s'afficher **comme texte** ou être **rejeté** — jamais exécuté.

Méthode : ouvrir la page, la console (F12), envoyer/saisir les payloads,
et vérifier qu'**aucune `alert`** ne s'ouvre et qu'aucune erreur CSP/JS
inattendue n'apparaît.

## Payloads de référence

| # | Payload | Attendu |
|---|---------|---------|
| P1 | `<img src=x onerror=alert(1)>` | Affiché comme texte littéral |
| P2 | `');alert(1);//` | Affiché comme texte littéral |
| P3 | `"><script>alert(1)</script>` | Affiché comme texte littéral |
| P4 | `javascript:alert(1)` (comme image_url) | Image non affichée, message OK |
| P5 | pseudo/mention avec `"` `<b>` `">` | Affiché comme texte, mention OK |

---

## Module : Chat de guilde (`js/guild-chat.js`) — ✅ traité (sous-étape 2)

Page : `pages/espace-guilde.html` → onglet chat général.
Prérequis : compte `membre` ou `admin`.

### Contenu de message
1. Envoyer P1, P2, P3 dans le chat.
   - Attendu : chaque message s'affiche tel quel, en texte. Aucune `alert`.
   - Vérifié aussi hors-ligne : rendu 100% via `createTextNode`/`textContent`
     (voir preuve `appendParsedMentions`, tous les payloads → texte échappé).

### Réponse (bouton ↩️ Répondre)
2. Répondre à un message contenant P2/P3.
   - Attendu : l'aperçu de réponse montre le texte littéral (via `textContent`).
   - Le bouton fonctionne toujours (délégation `data-action="reply"` + `messageCache`).

### Suppression (admin, 🗑️)
3. En admin, supprimer un message.
   - Attendu : suppression OK (délégation `data-action="delete"`, `messageId` UUID).

### Image de message (`image_url`)
4. Insérer en base une ligne `guild_chat` avec `image_url = javascript:alert(1)`
   (ou `data:text/html,...`, ou `http://…`, ou `https://evil.com/x.png`).
   - Attendu : **aucune image affichée**, le texte du message reste visible.
   - `image_url = https://mc-heads.net/...` ou `https://<projet>.supabase.co/...`
     → image affichée normalement, clic ouvre l'onglet (`window.open(..., 'noopener')`).

### Mentions / autocomplétion
5. Créer un profil avec un `username` contenant `"`, `<b>`, `">` puis le mentionner
   via `@`.
   - Attendu : la suggestion affiche le pseudo en texte (`textContent` + `data-username`),
     le clic insère le pseudo littéral dans l'input (pas de HTML), aucune `alert`.

### innerHTML restants dans guild-chat.js (audités, sûrs)
- `displayNoMessages` / `displayError` : markup **statique**, aucune donnée user.
- `container.innerHTML = ''`, `preview.innerHTML = ''`, `autocomplete.innerHTML = ''` :
  vidage de conteneur, aucune donnée.
- `chatEscapeHtml` fallback : `textContent`→`innerHTML` en **lecture** (échappement).

---

## Module : Messages privés (`js/guild-dm.js`) — ✅ traité (sous-étape 3)

Page : `pages/espace-guilde.html` → onglet chat → messages privés.

### Liste des membres
1. Créer un profil avec `username` contenant `"`, `'`, `<b>`, `">` et le retrouver
   dans la liste des DM.
   - Attendu : pseudo affiché en texte (`textContent` + `data-username`), aucun
     `alert`. Le clic ouvre bien la conversation (délégation `.dm-member-item`).

### Contenu de message privé
2. Envoyer P1, P2, P3 en message privé.
   - Attendu : texte littéral, aucune exécution (bulle rendue via `textContent`).
   - Auteur avec balises/guillemets → affiché en texte.

### Image de message privé (`image_url`)
3. Injecter en base un DM avec `image_url = javascript:alert(1)` / `data:...` /
   `http://...` / `https://evil.com/x.png`.
   - Attendu : **aucune image**, le reste du message intact.
   - `https://mc-heads.net/...` ou `https://<projet>.supabase.co/...` → image affichée,
     clic ouvre l'onglet (`window.open(..., 'noopener')`).

### innerHTML restants dans guild-dm.js (audités, sûrs)
- `displayNoDmMessages` / `displayDmError` : markup **statique**.
- `list.innerHTML=''`, `container.innerHTML=''`, `preview.innerHTML=''` : vidages.
- `escapeHtml` fallback : `textContent`→`innerHTML` en lecture (échappement).

---

## Module : Boîte mail (`js/mailbox.js`) — ✅ traité (sous-étape 4)

Page : `pages/hdv.html` → boîte mail (icône / Ctrl+M).
`js/mailbox-supabase.js` = couche données pure (aucun rendu HTML) → non modifié.

### État initial (déjà correct, conservé)
- `renderMessage` échappe déjà sujet/contenu/expéditeur (`escapeHtml`) et les
  attributs `data-sender`/`data-subject` (`escapeAttribute`, échappe les quotes).
- Boutons répondre / marquer lu / supprimer : `data-message-id` + délégation
  (`initializeEventListeners`), pas d'`onclick` inline. Inchangé.

### Corrigé cette sous-étape
1. **Sinks non échappés** : `userInfo.username`/`id` (état vide reçus) et
   `currentUser.username` (en-tête modal) étaient injectés bruts en `innerHTML`
   → désormais via `escapeHtml`. Test : mettre son propre pseudo à
   `<img src=x onerror=alert(1)>`, ouvrir la boîte mail → affiché en texte.
2. **Handlers inline supprimés** (5) : `openMessage`, dismiss (notif item),
   « Écrire un message » (état vide), « Réessayer » reçus/envoyés →
   `addEventListener`.
3. `escapeHtml` délègue à `NamelessSecurity` (échappe aussi quotes/backticks).

### Tests
- Sujet `<img src=x onerror=alert(1)>`, contenu `');alert(1);//` et
  `"><script>alert(1)</script>`, expéditeur avec guillemets/apostrophes/balises
  → tout s'affiche en **texte**, aucune `alert`.
- Répondre pré-remplit destinataire/sujet en texte (via `value`, pas d'HTML).
- Ouvrir / supprimer / marquer lu / répondre : fonctionnels.

### innerHTML restants dans mailbox.js (audités, sûrs)
- Templates **statiques** : loading/erreur/état vide envoyés, formulaire compose,
  `getMailboxHTML`, messages de validation, `no-messages`.
- Champs utilisateur : tous via `escapeHtml` (texte) ou `escapeAttribute` (attr).
- `showContactNotification` : code mort (appel commenté), champs échappés.

---

## Module : HDV (`js/hdv.js`) — ✅ traité (sous-étapes 5a + 5b)

Page : `pages/hdv.html`. `js/hdv-supabase.js` = couche données pure → non modifié.

### 5a — Échappement
- `_hdvEsc`/`_hdvEscA` délèguent à `NamelessSecurity`.
- `item.name`, `item.image`, `error.message` échappés partout (cartes marché,
  mes ordres, historique, placeholder du textarea contact). Neutralise le
  **stored XSS** via `market_orders`/`purchase_history` (item_name/item_image
  insérés par l'API).

### 5b — Handlers inline
- Tous les `onclick`/`onerror` supprimés (≈19). Une seule délégation
  `data-hdv-action` sur `document` + fallback image en phase de capture.
- Les actions ne transportent que `data-order-id` (ID DB) ; jamais de pseudo
  ni de nom d'item. `openFinalizeModal`/`contactTrader` retrouvent l'ordre par
  ID ; les modals mémorisent le contexte en JS (`pendingFinalize`,
  `pendingContact`), plus aucune string utilisateur dans un handler.

### Tests
- Créer un ordre dont l'item a un nom piégé (via API directe :
  `item_name = <img src=x onerror=alert(1)>` / `"><script>…`) → affiché en
  texte sur le marché, aucune `alert`. Contacter / finaliser / supprimer :
  fonctionnels.
- Pseudo (`username`/`creator`) avec `"`/`<>` → texte.

### Limites (hors client — voir SUPABASE_RLS_CHECKLIST)
- Champs numériques (`price`, `quantity`, `total`) rendus bruts : à garantir
  numériques côté schéma/RLS.
- `market_orders.username`/`creator` viennent du client (spoofables) : le
  serveur doit dériver l'identité de l'utilisateur authentifié, pas du client.

---

## Module : Espace guilde (`js/espace-guilde.js`) — ✅ traité (sous-étape 6)

Page : `pages/espace-guilde.html`.

- `escapeHtml` délègue à `NamelessSecurity` (échappe les quotes).
- **Mur d'activité** : `image_url` validée par `sanitizeUrl` (https, pas de
  `javascript:`/`data:`), sinon image ignorée. Avant : injectée via un
  `escapeHtml` textContent (quotes non échappées) → **breakout d'attribut**.
- **Objectifs** : `progression` coercée en entier 0-100 (empêche l'injection
  dans l'attribut `style="width:…"`).
- **Présence** : `statut` restreint à un token `[a-z0-9_-]` (utilisé dans des
  classes CSS `presence-card ${statut}` / `status-${statut}`).
- Sorties `formatEventType`/`formatPresenceStatus`/`formatActivityType`/`type`
  échappées / assainies.
- Onglets : `onclick` inline retirés du HTML → délégation `.guilde-tab-btn`
  (`data-tab`).

Tests : titre/contenu d'activité `<img src=x onerror=alert(1)>` → texte ;
`image_url = javascript:alert(1)`/`data:...` → image ignorée ; `progression`
ou `statut` piégés → pas d'exécution.

---

## Module : Admin dashboard (`js/admin-dashboard.js`) — ✅ traité (sous-étape 7)

Page : `pages/admin-dashboard.html`.

- Table des membres : déjà en `createElement`/`textContent` + `.onclick`
  (propriétés DOM, non bloquées par CSP). Conservé.
- `mcHeadHtml` : `minecraft_uuid` passé par `encodeURIComponent` dans l'URL
  d'avatar (avant : brut dans `<img src>` → breakout, l'admin voit tous les
  profils). `size` coercé numérique.
- `escapeHtml` délègue à `NamelessSecurity`.
- Planning/objectifs/présence/activités : `image_url` via `sanitizeUrl` ;
  `progression`/`semaine`/`annee`/`niveau` coercés ; `statut` restreint à un
  token pour les classes CSS ; sorties `format*` échappées.
- Handlers inline supprimés : `deleteGuildItem`×3, `editActivity`,
  `deleteActivity` (JS) → délégation `data-admin-action` (+ `data-id`/`data-table`) ;
  `switchGuildTab`×3, `closeRoleModal`, `confirmRoleChange` (HTML) → listeners.

### ⚠️ Rappel important
Le contrôle admin côté JS (`profile.role !== 'admin'` → redirection) est
**purement cosmétique**. Un utilisateur non-admin peut appeler l'API Supabase
directement avec la clé anon. La sécurité réelle des actions admin (changer un
rôle, supprimer un user/activité/présence) DOIT être imposée par RLS/RPC côté
serveur. Voir SUPABASE_RLS_CHECKLIST.

---

## Module : Auth (`js/auth-supabase.js`) — ✅ traité (sous-étape 8)
Déjà sûr (`_escHtml`/`_escAttr` corrects, pas de handler inline). `_escHtml`/
`_escAttr` délèguent à `NamelessSecurity` ; `minecraft_uuid` des avatars via
`encodeURIComponent`.

---

## Audit global des JS restants — ✅ vérifié (aucun XSS)

Fichiers rendant uniquement des **données statiques du code** (catalogues codés
en dur), pas de Supabase/localStorage/URL utilisateur → pas de XSS. Handlers
inline conservés (non sécurité) ; ils bloquent seulement la CSP stricte :
- `bestiaire.js` : `onclick` goToPage/openCreatureModal/navigateToItem, `onerror`
  fallback — IDs internes + noms du catalogue codé en dur. **Corrigé : non requis.**
- `quetes.js` : pagination `questSystem.*` — index internes. **Non requis.**
- `map.js` : `openQuestPage()` statique ; `x/y/floor` d'URL → nombres (pas d'HTML).
- `item-selector.js` : `onerror` fallback statique.
- `profil.js` : avatar via `.src` (propriété DOM, pas d'innerHTML) — sûr.
- `wiki.js` : `location.hash` → `getElementById('page-'+hash)` (pas d'innerHTML).
- `items.html` : `searchItemFromBestiaire` (localStorage) → `searchInput.value`
  (pas d'innerHTML) — sûr.
- `hdv-supabase.js`, `mailbox-supabase.js` : couches données, aucun rendu.

> Ces handlers inline « statiques » et les blocs `<script>` inline
> (`index/items/quetes`) sont la raison pour laquelle `'unsafe-inline'` (script)
> reste dans la CSP. Voir `SECURITY_REPORT_PHASE_1.md` §7.
