Preuves navigateur du 9 octobre 2026, capturées dans Chromium avec les ressources et contrôles réels du site.

Exécution complète : 09/10/2026 à 12:22 (Paris), 29/29 contrôles réussis. Dernier polish guilde : 09/10/2026 à 12:26 (Paris), 6/6 contrôles supplémentaires à 1672, 390 et 420 px. Les captures guilde reflètent ce dernier build.

- `home-reference.png` : accueil 1672 × 941, dimensions de la référence.
- `home-desktop.png` : accueil 1920 × 1080.
- `home-mobile.png` et `home-mobile-full.png` : accueil à 390 px.
- `bestiaire-reference.png`, `items-reference.png` : filtres, sélection et panneaux latéraux réels. Les variantes `-list`, `-mobile` et `-mobile-detail` montrent les autres états.
- `map-reference.png`, `map-floor-2.png`, `map-floor-3.png` : trois cartes originales. `map-selected.png` et `map-legend.png` montrent les interactions.
- `guild-public-reference.png` : accès public avec authentification requise.
- `guild-qa-reference.png` et `guild-qa-mobile-full.png` : interface membre sur fixtures locales explicitement signalées. Données de test en mémoire, aucune API réelle et aucune écriture Supabase.
- `reference-motion-demo.webm` : véritable enregistrement navigateur des apparitions, survols, sélections, onglets et changements de palier.
- `browser-verification.json` : résultats, dimensions, ressources et erreurs observées.
- `guild-polish-verification.json` : validation incrémentale du fond et de la typographie de la guilde, sans répéter les autres parcours.

Observation réseau conservée : le RPC externe `read_map_marker_overrides` répond 404. Les trois cartes et leurs repères documentés fonctionnent avec les ressources locales ; aucune ressource locale manquante ni erreur JavaScript observée.

Pour reproduire : construire le site, lancer le serveur sur `127.0.0.1:4173`, puis exécuter `node tools/verify-reference-reproduction.mjs`. Les outils utilisent Playwright et Chromium déjà installés. Pour les preuves membre isolées, lancer aussi `node tools/serve-ui-fixtures.mjs` et définir `NAMELESS_QA_BASE_URL=http://127.0.0.1:4181` avant la vérification.

Le drapeau `--guild-only` permet de refaire seulement les captures et contrôles du dernier polish guilde, dans le rapport séparé.
