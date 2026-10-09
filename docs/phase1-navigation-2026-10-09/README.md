Phase 1 validée dans Chromium : 21 contrôles de navigation et 6 contrôles supplémentaires de recherche passent.

Le header partagé utilise l’emblème validé avec mot Nameless séparé, les variantes de taille et les favicons. Le hamburger est réservé au mobile ; les réglages d’ambiance et le compte ont leurs fenêtres dédiées.

Captures avant/après aux mêmes résolutions : 360×844, 390×844, 768×1024, 1280×1080, 1920×1080 et 2560×1440. Le header est aussi capturé sur Wiki, Carte, Bestiaire, Objets, Guilde et Profil. La recherche finale est capturée aux six largeurs.

- Desktop : [avant](before-home-1920x1080.png) / [après](after-home-1920x1080.png).
- Mobile : [avant](before-home-390x844.png) / [après](after-home-390x844.png).
- Recherche : [avant](before-search-390x844.png) / [après](after-search-390x844.png).
- [Démonstration réelle, 18,8 secondes](phase1-navigation-motion.webm).

Vérifiés : débordements, images visibles, proportions, focus/Escape, indicateur actif, routes réelles, effacement, favoris persistants, FR/EN, réglages effectifs, mouvement réduit et centrage opaque. Les boutons de recherche mobiles mesurent 40–44 px de hauteur.

Les résultats détaillés sont dans `after-verification.json` et `after-modal-capture.json`. Reproduction : `node tools/verify-phase1-navigation.mjs --after`.

Restent les recompositions des phases 2–6. Le compte et la déconnexion sont contrôlés uniquement dans la fixture QA marquée. Les RPC externes non-GET sont bloqués volontairement ; annulations de requêtes et erreurs sont distinguées. Aucun déploiement.
