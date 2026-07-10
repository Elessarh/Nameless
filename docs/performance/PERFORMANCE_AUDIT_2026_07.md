# Audit performance Nameless — juillet 2026

Date : 2026-07-10
Portée : SPA publique + pages protégées, assets, audio, carte Leaflet.

## Problèmes trouvés → corrections appliquées

| Problème | Correction |
|---|---|
| `404.html` (fallback SPA) chargeait `style.css?v=nameless-1.0` alors qu'index et les pages utilisaient `1.1`, et bestiaire/quêtes/wiki/connexion étaient encore en `1.0` : jusqu'à trois copies cache différentes du CSS global selon la page d'entrée | Version unique `?v=20260710a` partout |
| Route `/` sans CSS/scripts dans le registry : accueil « brut » (sans home.css, effets, carrousel) quand la session SPA démarrait sur une route propre servie par 404.html | `home.css`, `nameless-effects.css` et `home-carousel.js` déclarés sur la route home ; 404.html aligné sur le socle d'index.html (fonts Cinzel/Inter incluses, absentes avant) |
| 3 MP3 dupliqués à la racine d'`assets/` (`Nameless — *.mp3`), identiques octet à octet aux fichiers d'`assets/audio/` et référencés par rien | Supprimés : **−11,7 Mo** de repo/déploiement |
| `leaflet.js` chargé en synchrone bloquant sur `pages/map.html` | Passé en `defer` (ordre d'exécution conservé avant `map.js`) |
| Images des cartes bestiaire/items sans hint de décodage | `decoding="async"` ajouté (le `loading="lazy"` existait déjà) |

## Ce qui était déjà sain (vérifié)

- Leaflet (JS+CSS) chargé **uniquement** sur `/carte` (registry par route).
- Scripts admin/guilde/chat/DM chargés uniquement sur leurs routes.
- `ensureStyles`/`ensureScripts` dédupliquent par URL exacte : pas de double
  chargement en navigation SPA.
- Audio : player créé une fois par `audio-controller.js` (chargé dans le
  `<head>` initial, jamais par le registry), survit aux navigations SPA.
- Fonts Google en `display=swap`, preconnect en place.
- `index.html` précharge uniquement le critique (style.css + logo).
- Legacy archivé (`legacy/`) : plus rien ne le référence ni ne le charge.

## Fichiers lourds (état, non modifiés)

| Fichier | Poids | Note |
|---|---|---|
| `assets/carte.png` | 9,3 Mo | Fond de carte Leaflet palier 1 — chargé seulement sur /carte |
| `assets/Palier2-map.png` | 6,4 Mo | idem palier 2 (au changement de palier) |
| `assets/Palier3-map.png` | 2,5 Mo | idem palier 3 |
| `assets/audio/*.mp3` | 3×~3,9 Mo | Lecture à la demande (player) |
| `assets/brand/page-font-*.png` | ~2–2,5 Mo chacun | Décors de fond des sections |

## Optimisations restantes (non appliquées ici)

1. **Recompresser les fonds de carte** (`carte.png`, `Palier2/3-map.png`) en
   WebP qualité ~80 ou PNG optimisé (pngquant/squoosh) : gain estimé 50-70 %.
   Nécessite un contrôle visuel — non automatisé pour ne pas dégrader la carte.
2. Idem pour les décors `page-font-*.png` (WebP + `image-set()`).
3. Convertir les plus gros PNG de mobs en WebP/AVIF (beaucoup existent déjà
   en AVIF).
4. Sous-ensembles de fonts auto-hébergés si l'on veut se passer de Google
   Fonts (bonus RGPD).
5. Minification JS/CSS au déploiement (aujourd'hui les sources sont servies
   telles quelles) — nécessiterait un petit build step.
