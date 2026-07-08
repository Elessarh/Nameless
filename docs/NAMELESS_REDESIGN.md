# NAMELESS — Direction artistique & design system

Refonte du portail de guilde **Iron Oath → Nameless**. Sombre, premium,
fantasy-tech, sobre et lisible. Document de référence pour toute la refonte.

> **Règles de sécurité pendant la refonte (non négociables)**
> - Ne pas réintroduire d'`innerHTML` avec des données utilisateur (garder
>   `createElement`/`textContent` + `NamelessSecurity`).
> - Aucun `onclick`/`onerror`/`oninput` inline — délégation + `addEventListener`.
> - `security-utils.js` reste chargé **avant** les scripts métier sur chaque page.
> - Ne pas faire confiance à `localStorage` pour une action sensible.
> - Ne pas toucher la config Supabase, le CNAME/domaine, ni déployer.
> - Le CSS ne doit pas casser les pages existantes : on rethème via les
>   variables partagées (`:root`), on n'enlève pas de sélecteurs.

---

## 1. Identité Nameless
Une guilde de **survivants oubliés d'Aincrad**. Ceux qui ont refusé la gloire et
choisi l'ombre. Discrétion, loyauté, maîtrise. On ne se vante pas — on subsiste,
ensemble. Le ton est **noble, sérieux, mystérieux**, jamais tape-à-l'œil.

- Nom affiché : **NAMELESS** (capitales, lettrage espacé).
- Anti-patterns : cartoon, flashy, surcharge d'emojis, copie directe de SAO.
- À viser : gravure, métal, brume, silence, filets d'or fins.

## 2. Slogans
- Principal : **« Sans nom. Jamais seuls. »**
- Hero long : *« Nous avons survécu à Aincrad. Nous avons choisi l'oubli. »*
- Alternatives : « L'ombre a une garde. » · « Ceux qui restent. » ·
  « La discrétion est une force. »

## 3. Palette
| Rôle | Token | Valeur |
|---|---|---|
| Noir bleuté (fond) | `--nm-black` | `#05070d` |
| Navy profond | `--nm-navy` | `#0a0f1d` |
| Or métallique (base) | `--sao-gold` | `#c2a367` |
| Or clair | `--sao-gold-light` | `#e4cd97` |
| Or sombre | `--sao-gold-dark` | `#8a6c3c` |
| Dégradé métal | `--nm-gold-grad` | `#e4cd97 → #c2a367 → #8a6c3c` |
| Gris acier (texte) | `--sao-text` | `#c3c8d2` |
| Acier sourd | `--nm-steel` | `#8b93a3` |
| Glow bleu (subtil) | `--nm-blue-glow` | `rgba(91,127,166,.35)` |
| Filet d'or | `--nm-hairline` | `rgba(194,163,103,.22)` |

Principe : **fonds très sombres**, or réservé aux accents/titres/traits, bleu
acier uniquement pour les états actifs/hover. Jamais de blanc pur, jamais de
couleurs saturées en aplat.

## 4. Typographies
- **Titres / display** : `Cinzel` (gravure romane, fantasy noble) →
  `--font-title`. Fallback `Orbitron`, puis `serif`.
- **Texte** : `Inter` (lisibilité) → `--font-text`. Fallback `Exo 2`.
- **Données/stats** : Inter en capitales espacées (pas de police mono ajoutée
  pour rester léger).
- Chargées via Google Fonts (`display=swap`). Pas de fichier de police hébergé.

## 5. Logo / marque
- **Wordmark** `NAMELESS` en Cinzel, `letter-spacing` large, dégradé or métal.
- **Monogramme** : sceau/glyphe abstrait (pas d'illustration). Pour l'instant on
  réutilise `assets/Logo_3.png` ; un SVG monochrome or est à produire ensuite.
- Traitement : filets d'or 1px, léger halo bleu au survol, pas de relief 3D.

## 6. Design system (tokens)
- Espacements : multiples de 4/8px. Conteneur max `1200px`, gouttières `24px`.
- Rayons : `--nm-radius: 10px` (cartes), `999px` (pilules).
- Bordures : 1px `--sao-border`, hover `--sao-border-hover`.
- Ombres : douces et profondes (`--sao-shadow`), glow **très** discret.
- Transitions : 0.35–0.6s `cubic-bezier(.16,1,.3,1)`.
- Focus visible : `--focus-ring` (anneau bleu acier) sur tous les interactifs.

## 7. Composants UI
- **Navbar** : sombre, fond flouté (`backdrop-filter`), filet d'or en bas, liens
  discrets avec soulignement or animé, lien actif or.
- **Boutons** : `primary` = bordure or + fond translucide + halo au survol ;
  `secondary` = contour acier. Pilule, majuscules légères.
- **Cartes** (`feature-card`, `stat-card`) : fond `--sao-bg-card`, bordure fine,
  survol = remontée légère + bordure or + glow bleu ténu.
- **Sections** : titres centrés avec surtitre en petites capitales or.
- **Accès rapides** : grille d'entrées vers Carte/Bestiaire/Items/HDV/Quêtes/Wiki.
- **Barres de progression** : rail sombre + remplissage or, valeur en capitales.
- **Bloc recrutement** : panneau encadré or, CTA fort.

## 8. Structure de la landing (index.html)
1. Header/navbar Nameless.
2. **Hero** : `NAMELESS`, slogan fort, 2 CTA (« Rejoindre la guilde » →
   connexion, « Explorer le wiki » → wiki), fond sombre + brume.
3. **Présentation courte** de la guilde (2–3 phrases, ton mystérieux).
4. **Accès rapides** : Carte, Bestiaire, Items, HDV, Quêtes, Wiki.
5. **Progression** : quelques indicateurs (membres, quêtes, items, heures).
6. **Recrutement** : panneau + CTA « Rejoindre la guilde ».
7. **Footer** propre (marque, année, mention discrète).

Vidéo YouTube : conservée mais optionnelle/plus bas (non prioritaire).

## 9. Responsive
- Mobile-first via variables ; grilles en `auto-fit minmax()`.
- Points de rupture existants conservés (768px, 480px, 320px).
- Hero : titre fluide (`clamp()`), CTA empilés en mobile.
- Accès rapides : 3 colonnes → 2 → 1 selon la largeur.
- Navbar : hamburger existant conservé (JS `navbar-mobile.js` inchangé).

## 10. Animations
- **Sobriété** : suppression des particules/scanline/hexagones SAO sur la landing.
- `nameless-effects.css` : brume/aurora très lente en fond, filet d'or animé,
  révélation au scroll (fade + translate léger).
- Respect de `prefers-reduced-motion` : tout se fige proprement.
- Halo bleu au survol des cartes/boutons, jamais clignotant.

## 11. Stratégie technique
- **Zéro dépendance nouvelle**, vanilla HTML/CSS/JS, compatible GitHub Pages.
- Retheme **par variables** dans `css/style.css` (`:root`) → propagé à toutes les
  pages sans toucher leur markup.
- Section « NAMELESS » ajoutée en fin de `style.css` (overrides + composants
  landing), sans supprimer de règles existantes.
- Nouveau `css/nameless-effects.css` (effets sobres) remplace
  `sao-animations.css` **uniquement sur la landing** dans cette passe.
- Les autres pages migreront ensuite (fonts Cinzel + retrait effets SAO) une par
  une, en gardant les correctifs sécurité.

## 12. HDV — désactivé / à archiver plus tard
Le **Hôtel des Ventes** est retiré de l'expérience visible (navbar, accès
rapides, CTA de la landing) car le projet n'en a plus besoin pour l'instant.

- **Non supprimé** : `pages/hdv.html`, `js/hdv.js`, `js/hdv-supabase.js` restent
  en place (rollback possible). Accessibles seulement par URL directe.
- **Supabase intact** : tables `market_orders` / `purchase_history` non touchées.
- **À faire plus tard** : archiver/supprimer définitivement les fichiers HDV et,
  si confirmé, les tables associées (après backup) — décision à valider.

## 13. Dashboard admin — refonte visuelle Nameless
`pages/admin-dashboard.html` migré vers l'identité Nameless (head, favicon SVG,
polices Cinzel + Inter, retrait de `sao-animations.css`, logo navbar SVG,
titres/onglets dé-emojisés, footer Nameless). Le CSS a reçu une section
d'overrides « NAMELESS » en fin de `css/components/admin-dashboard.css`
(couleurs orange/cyan → or/acier/navy) **sans** réécrire la structure : tous les
IDs, classes et attributs `data-*` utilisés par `js/admin-dashboard.js` sont
préservés (`.tab-btn[data-tab]`, `.tab-content[data-tab-content]`,
`.guild-tab[data-guild-tab]`, `.sortable[data-sort]`, `data-admin-action`, etc.).

> **⚠️ Admin UI does not replace Supabase RLS.**
> L'interface d'administration côté client (masquage de la page, vérification du
> rôle en JS, boutons d'action) est **purement cosmétique et pratique**. Elle ne
> constitue **pas** un contrôle de sécurité. La seule barrière réelle est la
> **Row-Level Security (RLS) de Supabase** : toute écriture (changement de rôle,
> présence, planning, objectifs, mur d'activité) doit être autorisée côté base.
> Un utilisateur peut contourner l'UI (DevTools, requêtes directes) ; seule la
> RLS empêche une action non autorisée. Voir `SUPABASE_RLS_ACTION_PLAN.md` et
> `SUPABASE_RLS_CHECKLIST.md` pour les politiques à vérifier/appliquer.

