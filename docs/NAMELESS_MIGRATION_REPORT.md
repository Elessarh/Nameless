# Rapport de migration — Iron Oath → Nameless

Branche : `nameless-redesign-v1`
Nature : refonte visuelle + identité de marque, **site statique multi-pages
conservé** (HTML/CSS/JS vanilla, aucune dépendance nouvelle, aucun framework).
Aucun déploiement effectué. **En attente de validation.**

---

## 1. Pages migrées

| Page | État | Notes |
|------|------|-------|
| `index.html` (Accueil) | ✅ Migré | Hero cinématique boss, carrousel, priorités, pourquoi rejoindre, lecteur audio |
| `pages/map.html` (Carte) | ✅ Migré | Panneau premium + watermark carte, Leaflet intact |
| `pages/bestiaire.html` | ✅ Migré | Hero à scène décorative |
| `pages/items.html` | ✅ Migré | Hero à scène décorative |
| `pages/quetes.html` | ✅ Migré | Hero à scène décorative |
| `pages/wiki.html` | ✅ Migré | Hero d'accueil + rebrand « Wiki Nameless » |
| `pages/connexion.html` | ✅ Migré | Deux panneaux premium |
| `pages/profil.html` | ✅ Migré | Carte joueur premium |
| `pages/espace-guilde.html` | ✅ Migré | QG de guilde (chat/MP/planning/objectifs/présence/activité) |
| `pages/admin-dashboard.html` | ✅ Migré | Dashboard re-skiné (dernière page encore en Iron Oath) |
| `pages/hdv.html` | ⛔ **Non touché** | Volontairement exclu (voir §6 et §8) |

Détail des commits : `git log --oneline --grep=Nameless` (Nameless 1/N → 19/N).

---

## 2. Assets ajoutés

**Marque** (`assets/brand/`)
- `nameless-mark.svg` — monogramme N (navbar).
- `favicon.svg` — favicon N sur navy.
- `nameless-logo.png` — logo complet (N doré + wordmark) → og:image, twitter, apple-touch, favicon PNG de repli.
- `nameless-logo-horizontal.svg` — wordmark horizontal.
- `nameless-hero-boss.png` — artwork Illfang (hero cinématique accueil).
- `nameless-hero.png` — variante hero.

**Scènes de page** (`assets/brand/page-font-*.png`) — copies propres des 5 « image_font » (le fichier source `quêtes` contenait un accent, mauvais pour une URL) :
`page-font-map.png`, `page-font-bestiaire.png`, `page-font-items.png`, `page-font-quetes.png`, `page-font-wiki.png`.

**Audio** (`assets/audio/`) : `nameless-oath.mp3`, `nameless-echoes.mp3`, `nameless-echoes-2.mp3`.

**CSS/JS nouveaux** : `css/nameless-effects.css`, `css/components/audio-player.css`,
`css/components/home.css`, `css/components/page-hero.css`,
`css/components/guilde-nameless.css`, `js/audio-controller.js`, `js/home-carousel.js`.

> Les fichiers sources d'origine (`assets/font_nameless_*.png`, `assets/Nameless — *.mp3`,
> `assets/logo_nameless.png`, `assets/new_nameless_font.png`) restent **non suivis**
> dans le dépôt (non supprimés, non commités) — seules les copies propres sont utilisées.

---

## 3. Audio intégré
- Lecteur d'ambiance discret sur l'**accueil** (`js/audio-controller.js`).
- 3 pistes (Oath / Échos / Échos II), bouton ON/OFF + **piste suivante** + nom de piste.
- Volume 20 % par défaut ; préférences `localStorage` validées (piste, on/off, volume, position).
- **Aucun autoplay** : le son ne démarre que sur clic ; changer de piste à l'arrêt reste silencieux.
- Dégradation propre si une piste manque (passe à la suivante ; sinon le dock disparaît).
- La musique se coupe entre les pages (normal en multi-pages ; sera réglé avec la SPA).

---

## 4. Image hero intégrée
`assets/brand/nameless-hero-boss.png` (Illfang + chevaliers de la guilde) en fond du
hero cinématique de l'accueil, avec léger zoom lent (`prefers-reduced-motion` respecté)
et overlay de lisibilité. Les pseudos incrustés = **membres actifs** (conservés à la
demande de l'utilisateur).

---

## 5. image_font intégrées
Les 5 scènes sont des **illustrations décoratives** (pas des wordmarks), intégrées en
**watermark derrière le vrai titre HTML** de chaque page via `css/components/page-hero.css` :
- pseudo-élément (pas de balise `<img>` → pas d'icône cassée si le fichier manque),
- `pointer-events: none`, opacité contrôlée, masque dégradé pour la lisibilité,
- le titre reste du **vrai texte** (jamais remplacé par une image).

Carte : la scène `page-font-map.png` sert de watermark très discret dans le **panneau
premium** de la carte (filet doré, vignette, glow bleu), sans gêner Leaflet.

---

## 6. HDV — retiré du visible
- Absent de la **navbar** (toutes les pages), des accès rapides et des CTA.
- `index.html` : « hôtel des ventes »/« HDV » retirés de la description, des keywords et de l'og.
- `pages/hdv.html`, `js/hdv.js`, `js/hdv-supabase.js`, `js/item-selector.js` : **conservés,
  non touchés** ; accessibles uniquement par URL directe. Tables Supabase intactes.
- **Reste visible** (décision à valider) : le **wiki** documente le HDV *en jeu* (lore :
  page `hdv-wiki`, lien de sous-navigation, mentions dans le règlement). Ce n'est pas la
  fonctionnalité du site mais de la documentation du serveur — laissé en place volontairement.

---

## 7. Fichiers modifiés (principaux)
- **Pages** : `index.html`, `pages/{map,bestiaire,items,quetes,wiki,connexion,profil,espace-guilde,admin-dashboard}.html`
- **CSS** : `css/style.css` (tokens `:root`), `css/components/{map,items,bestiaire,quetes,profil,guilde-nameless,admin-dashboard,audio-player,home,page-hero}.css`, `css/nameless-effects.css`
- **JS** : `js/audio-controller.js`, `js/home-carousel.js`, `js/items.js` (nouveaux/refontes) ; `js/profil.js` (1 correctif avatar). Les JS sensibles **non réécrits** : voir §8.
- **Docs** : `docs/NAMELESS_REDESIGN.md`, ce rapport.

---

## 8. Risques restants / limites
1. **Poids des scènes** : `page-font-*.png` ≈ 2–2,5 Mo chacune. Recommandé : conversion **WebP**
   + compression (gain majeur, watermark peu sensible à la qualité).
2. **`js/item-selector.js`** (HDV uniquement, page désactivée) : interpole des noms d'items
   non échappés + un `onerror` inline. Risque **faible** (données = catalogue local fixe, pas
   d'entrée utilisateur) et fichier **hors-scope HDV**. À durcir si le HDV est réactivé.
3. **`js/map.js`** (hors-scope, à ne pas casser) : la recherche échappe le **nom** (`escapeHtmlSearch`)
   mais insère `icon`/`type` (énumérés) et coordonnées (numériques) non échappés → risque faible.
   Le HUD de coordonnées garde un style « SAO » (cyan/Orbitron) généré en JS — cosmétique.
4. **Emojis restants** dans le contenu du **wiki** et des **quêtes** (titres de sections,
   cartes). Non bloquant ; à réduire lors d'une passe éditoriale si souhaité.
5. **Musique coupée entre pages** : inhérent au multi-pages (résolu avec la SPA).

### Audit sécurité (passe globale) — résultat
- Handlers inline (`onclick/onerror/…`) sur pages actives : **0**.
- `outerHTML` / `insertAdjacentHTML` / `document.write` : **0**.
- `innerHTML` sur pages actives : soit vidage (`= ''`), soit **données échappées**
  (`escapeHtml` → `NamelessSecurity`, `escapeHtmlSearch`), soit templates **statiques**.
- `location.search` (map) → parsé en **nombres** ; `location.hash` (wiki) → clé de
  `getElementById` (pas d'injection) ; `localStorage` → uniquement état UI/caches **non sensibles**.
- **Aucune correction de code nécessaire** sur les pages actives → pas de commit dédié étape 6.
- Correctifs XSS existants et `js/security-utils.js` **préservés** ; fichiers sensibles
  (`guild-chat.js`, `guild-dm.js`, `mailbox.js`, `espace-guilde.js`, `admin-dashboard.js`)
  **non réécrits**.

---

## 9. Actions Supabase RLS restantes
> **⚠️ L'UI admin ne remplace pas la RLS.** Le masquage de page et la vérification de rôle
> côté client sont cosmétiques. La seule barrière réelle est la **Row-Level Security de Supabase**.

À vérifier/appliquer côté base (voir `docs/SUPABASE_RLS_ACTION_PLAN.md`,
`SUPABASE_RLS_CHECKLIST.md`, `SUPABASE_RLS_SQL_TO_RUN.md`) :
- Écritures `user_profiles` (changement de rôle) réservées aux admins.
- `guild_planning`, `guild_objectives`, `guild_presence`, `guild_activity_wall` : insertion/suppression admin ; lecture membre.
- `guild_messages` / MP : lecture/écriture limitées aux membres concernés.
- Bucket storage `iron-oath-storage` : politiques d'upload/lecture.
- Confirmer que l'anon key public ne permet aucune écriture non autorisée.

---

## 10. Recommandations avant mise en ligne
1. Tester le **flux d'auth réel** (Microsoft + email) contre Supabase — non testable dans le
   sandbox de prévisualisation (DNS externe bloqué).
2. **Valider la RLS** (§9) avant toute exposition publique.
3. **Optimiser les images** (WebP) — surtout les scènes de hero (~2 Mo).
4. Test **multi-navigateurs** + mobile réel (iOS/Android).
5. (Optionnel) Réduire les **emojis** wiki/quêtes ; décider du sort du **HDV** (archiver
   `hdv.html`/tables après backup, ou réactiver et durcir `item-selector.js`).
6. Décider du sort de la **référence HDV dans le wiki** (§6).
7. Conserver le domaine/**CNAME** `iron-oath.github.io` **inchangé** (non modifié ici).

---

## 11. Prochaine étape : audit SPA
Le site reste **multi-pages statique** pour l'instant. Étape suivante (séparée) :
**audit de faisabilité d'une SPA** — continuité audio entre vues, routeur, réutilisation
des composants Nameless, budget de performance, et migration progressive sans casser
la sécurité ni la RLS. À planifier après validation de la présente refonte.
