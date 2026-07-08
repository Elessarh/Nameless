# Rapport de sécurité — Phase 1 (XSS / handlers inline / localStorage)

Projet : site de guilde (Iron Oath → Nameless). Branche : `refonte-nameless`.
Périmètre : **sécurité uniquement**, aucune refonte visuelle, aucun renommage,
aucun changement de domaine. Objectif : neutraliser les injections (XSS) qui
avaient déjà frappé le site en public, sans casser les fonctionnalités.

---

## 1. Commits réalisés (branche `refonte-nameless`)
| # | Hash | Objet |
|---|------|-------|
| 1  | `c6c93f0` | Fondation anti-XSS : `js/security-utils.js` + chargement sur 11 pages |
| 2  | `ddbb06c` | Chat de guilde (`guild-chat.js`) : rendu DOM + délégation |
| 3  | `c8d2f9d` | Messages privés (`guild-dm.js`) : rendu DOM + délégation |
| 4  | `3253b2f` | Boîte mail (`mailbox.js`) : sinks échappés + handlers retirés |
| 5a | `24c65b6` | HDV (`hdv.js`) : échappement des données affichées |
| 5b | `b522fe9` | HDV : suppression des handlers inline (délégation) |
| 5c | `053f88a` | HDV : retrait backdoor `forceAccess` + note identité |
| 6  | `7cf8018` | Espace guilde (`espace-guilde.js`) : mur d'activité + onglets |
| 7  | `8dac9ed` | Admin (`admin-dashboard.js`) : XSS + handlers inline |
| 8  | `d892e36` | Auth (`auth-supabase.js`) : unification helpers + uuid encodé |

(+ commit du présent rapport et de la checklist RLS.)

---

## 2. Fichiers modifiés
**Nouveaux**
- `js/security-utils.js` — helpers centralisés `NamelessSecurity`
  (`escapeHtml`, `escapeAttr`, `sanitizeUrl`, `sanitizeImageUrl`).
- `docs/XSS_TEST_PAYLOADS.md`, `docs/SUPABASE_RLS_CHECKLIST.md`,
  `docs/SECURITY_REPORT_PHASE_1.md`.

**JS métier durcis**
- `guild-chat.js`, `guild-dm.js`, `mailbox.js`, `hdv.js`, `espace-guilde.js`,
  `admin-dashboard.js`, `auth-supabase.js`.

**HTML** (chargement du helper + retrait d'onclick inline)
- Les 11 pages (`index.html` + `pages/*.html`) chargent `security-utils.js`.
- `pages/espace-guilde.html` et `pages/admin-dashboard.html` : onclick inline
  d'onglets/modals retirés → listeners.

**Non modifiés (volontairement)**
- `hdv-supabase.js`, `mailbox-supabase.js` : couches données pures, aucun rendu.
- `profil.js` : `.src` via propriété DOM (pas d'innerHTML) — sûr.
- `wiki.js`, `map.js` : paramètres d'URL utilisés de façon sûre (voir §6).

---

## 3. Failles corrigées
- **XSS stocké via messages** (chat général + privés) : `content`, `username`,
  `image_url` étaient concaténés dans de l'`innerHTML`. → rendu 100 % DOM
  (`createTextNode`/`textContent`), `image_url` validée.
- **XSS stocké via boîte mail** : `username`/`id` en état vide, en-tête modal.
- **XSS stocké via HDV** : `item_name`/`item_image` (marché, mes ordres,
  historique) injectés bruts ; `traderName`/`itemName` dans des `onclick`
  (contexte JS, non protégé par l'échappement HTML). → échappement + délégation.
- **XSS stocké via mur d'activité / admin** : `image_url` (breakout d'attribut
  car l'ancien `escapeHtml` n'échappait pas les guillemets), `minecraft_uuid`
  dans les URLs d'avatar, `progression`/`statut` dans `style`/`class`.
- **Échappement des guillemets** : tous les `escapeHtml` maison
  (`textContent`→`innerHTML`) délèguent désormais à `NamelessSecurity.escapeHtml`
  qui échappe aussi `" ' \``, sûr en contexte texte ET attribut.
- **Validation d'URL** : `sanitizeUrl`/`sanitizeImageUrl` imposent https et
  bloquent `javascript:` / `data:` / `blob:` / `vbscript:` / `file:`.
- **Backdoor d'identité** : `forceAccess()` (HDV) qui fabriquait un utilisateur
  dans `localStorage` supprimée.

Preuves : tests Node autonomes (échappement + rendus) → tous « SAFE ». Matrice
de tests navigateur dans `docs/XSS_TEST_PAYLOADS.md`.

---

## 4. Handlers inline supprimés
- `guild-chat.js` : `replyToMessage`, `deleteMessage` (×2), `insertMention`,
  `clearImagePreview`, `window.open(image)`.
- `guild-dm.js` : `openDMChat`, `window.open(image)`, `clearDmImagePreview`.
- `mailbox.js` : `openMessage`, dismiss notif, compose (état vide), retry (×2).
- `hdv.js` : ~19 `onclick`/`onerror` → une délégation unique `data-hdv-action`.
- `espace-guilde.html` : onglets `switchGuildeTab` (×3).
- `admin-dashboard.js` : `deleteGuildItem` (×3), `editActivity`, `deleteActivity`.
- `admin-dashboard.html` : `switchGuildTab` (×3), `closeRoleModal`,
  `confirmRoleChange`.

Principe appliqué : les actions ne transportent que des **ID de lignes**
(`data-*`), jamais de contenu utilisateur ; le contexte (nom d'item, pseudo)
est mémorisé en JS (`messageCache`, `pendingFinalize`, `pendingContact`).

**Handlers inline restants (non-XSS, documentés)** : `bestiaire.js`,
`quetes.js`, `map.js`, `item-selector.js` et leurs pages génèrent des `onclick`
sur des **données statiques du code** (numéros de page, IDs internes, noms du
catalogue codé en dur) — aucune donnée Supabase/localStorage/URL. Pas de risque
XSS. S'y ajoutent quelques handlers **statiques** en HTML :
`pages/hdv.html` (bouton d'ouverture boîte mail + un bouton « Actualiser »
historique) et `pages/quetes.html` (`onchange="changeTier(this.value)"`, valeur
d'un `<select>`). Aucun ne transporte de donnée utilisateur. Ils ne sont pas
retirés car (a) sans valeur sécurité et (b) ce sont ces handlers — avec les
blocs `<script>` inline — qui empêchent encore une CSP stricte (voir §7).

---

## 5. innerHTML restants (sûrs)
Après la phase 1, les `innerHTML` restants dans les fichiers traités sont :
- des **templates statiques** (états vides, chargement, erreurs génériques) ;
- des **vidages** (`= ''`) ;
- des champs **échappés** (`escapeHtml`) ou **assainis** (`sanitizeUrl`,
  coercition numérique, tokens `[a-z0-9_-]`).
Détail par module dans `docs/XSS_TEST_PAYLOADS.md`.

---

## 6. localStorage encore sensible
- `hdv.js` `getCurrentUserInfo()` : peut retomber sur `localStorage.currentUser`.
  Désormais **documenté comme source d'affichage uniquement** ; les écritures
  Supabase utilisent la session authentifiée. La propriété réelle des lignes
  doit être imposée par RLS (`user_id = auth.uid()`). Backdoor `forceAccess`
  retirée.
- Divers caches (`hdv_orders`, `knownUsers`, état carte, onglets actifs) :
  non sensibles, réinjectés en `value`/`textContent`, pas en HTML.
- `searchItemFromBestiaire` (bestiaire→items) : lu puis mis dans
  `searchInput.value` (pas d'innerHTML) → sûr.
- Paramètres d'URL : `wiki.js` (`location.hash` → `getElementById`) et `map.js`
  (`x/y/floor` → nombres) — pas d'injection DOM.

---

## 7. CSP — actuelle et recommandée
**Actuelle (identique sur les 11 pages)** :
```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com;
style-src  'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
font-src   'self' https://fonts.gstatic.com;
img-src    'self' https://mc-heads.net https://*.supabase.co data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://playerdb.co https://cdn.jsdelivr.net https://unpkg.com;
frame-src  'self' https://www.youtube.com;
base-uri 'self'; form-action 'self';
```

**Statut `unsafe-inline` (script)** : **conservé volontairement**. Le retirer
casserait le site tant que subsistent :
- des blocs `<script>` inline (`index.html`, `items.html`, `quetes.html`) ;
- des `onclick`/`onerror` inline générés par `bestiaire.js`, `quetes.js`,
  `map.js`, `item-selector.js`.

**Cible recommandée** (après nettoyage complet, à faire avec test navigateur
page par page) :
- `script-src 'self' https://cdn.jsdelivr.net https://unpkg.com` **sans**
  `'unsafe-inline'` — nécessite : déplacer les blocs `<script>` inline vers des
  fichiers `.js`, et convertir les derniers handlers inline en délégation.
- `style-src` : `'unsafe-inline'` peut rester en dernier (risque faible ;
  beaucoup de `style="…"` générés). Le durcir est optionnel.
- Retirer `data:` de `img-src` si l'aperçu d'image local est retravaillé.

> Recommandation : traiter le durcissement CSP comme une **sous-phase dédiée
> avec tests navigateur**, idéalement pendant la refonte Nameless (les pages
> statiques seront de toute façon refaites).

---

## 8. Tests XSS
Payloads testés/documentés (chat, MP, mail, HDV, espace guilde, admin) :
```
<img src=x onerror=alert(1)>
');alert(1);//
"><script>alert(1)</script>
javascript:alert(1)
data:text/html,<script>alert(1)</script>
pseudo avec " ' < > `
```
- **Automatisé (Node)** : échappement (`escapeHtml`/`escapeAttr`),
  `sanitizeUrl`/`sanitizeImageUrl`, rendus chat/DM/mailbox → **tous SAFE**.
- **À refaire manuellement en navigateur** avant remise en public : injecter
  ces payloads via l'API Supabase (pour simuler un attaquant qui contourne le
  JS) dans `guild_chat`, `messages`, `market_orders`, `guild_activity_wall`,
  puis vérifier qu'aucune `alert` ne se déclenche et que l'UI reste
  fonctionnelle. Procédure détaillée : `docs/XSS_TEST_PAYLOADS.md`.

---

## 9. Risques restants
1. **RLS non vérifié** (risque #1). Toute la sécurité d'accès/propriété repose
   sur des policies côté serveur non auditées depuis ce dépôt. Voir
   `docs/SUPABASE_RLS_CHECKLIST.md`.
2. **Clé anon publique** : normale, mais implique que RLS doit être strict.
   `crypto-keys.js` ne protège rien.
3. **`unsafe-inline` (script)** encore actif (pages statiques). Réduit la
   défense en profondeur mais l'échappement/délégation couvrent les zones à
   données utilisateur.
4. **Champs numériques HDV** (`price`/`quantity`) : coercés à l'affichage, mais
   la validation de type/bornes doit être imposée côté base.
5. **Identité HDV via localStorage** : affichage seulement ; les actions
   sensibles dépendent de RLS.
6. **Pages statiques** (`bestiaire`, `quetes`, `wiki`, `map`, `items`) : pas de
   données utilisateur dynamiques, mais conservent des handlers inline.

---

## 10. Actions obligatoires côté Supabase (avant public)
Voir la checklist complète. Minimum vital :
- [ ] RLS activé sur **toutes** les tables.
- [ ] Auto-promotion `role` **impossible** (trigger `prevent_role_change`).
- [ ] `market_orders` / `messages` / `guild_chat` privés : propriété par RLS.
- [ ] Écritures planning / objectifs / activité / rôles : **admin only** par RLS.
- [ ] RPC `delete_user_completely` protégée par `is_admin()`.
- [ ] Contraintes numériques sur prix/quantité/progression.

---

## 11. Verdict : remise en public maintenant ?
**Non — pas encore.** Le code client est désormais **beaucoup plus sûr** contre
le XSS (injections neutralisées, handlers inline retirés sur les zones à données
utilisateur), ce qui traite directement le type d'attaque déjà subi.

**Mais** la sécurité d'un site statique + Supabase repose *in fine* sur **RLS**,
qui n'a **pas** pu être vérifié depuis ce dépôt. Tant que la checklist RLS
(§10 / `SUPABASE_RLS_CHECKLIST.md`) n'est pas validée dans le dashboard Supabase,
un attaquant peut contourner le JS et lire/écrire directement (messages privés,
ordres, rôles). 

**Condition de remise en public** :
1. Valider la checklist RLS (surtout : rôle non auto-modifiable, messages privés
   cloisonnés, écritures admin verrouillées).
2. Rejouer les tests XSS en navigateur via l'API (§8).
3. Ensuite seulement, envisager la refonte visuelle Nameless.
