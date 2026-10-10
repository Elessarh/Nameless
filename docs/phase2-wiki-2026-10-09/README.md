# Phase 2 — Wiki et guides

Vérification locale du 10 octobre 2026 : **30 contrôles navigateur réussis**, aucune erreur JavaScript ou ressource locale manquante. Les **55 articles existants** sont conservés.

L’accueil distingue trois parcours illustrés et neuf catégories. Les articles disposent d’un sommaire observé, de liens liés et d’une navigation précédente/suivante. La recherche locale utilise le contenu réel des guides.

Captures avant/après aux largeurs **360, 390, 768, 1280, 1920 et 2560 px** : aucun débordement horizontal ni image visible cassée. Contrôles : clavier, liens natifs, ancres/focus/offset du header, historique, navigation SPA, recherche vide, FR/EN persistant, première ouverture SPA en anglais, tiroir mobile exclusif au menu global et préférence de mouvement réduit. Le menu de gauche et le sommaire restent sous le header pendant la lecture et respectent la fin de leur bloc.

- [Avant, accueil desktop](before-home-1920x1080.png) · [Après](after-home-1920x1080.png)
- [Avant, article desktop](before-article-1920x1080.png) · [Après](after-article-1920x1080.png)
- [Accueil mobile](after-home-390x844.png) · [Article mobile](after-article-390x844.png)
- [Démonstration réelle — 17,76 s](phase2-wiki-motion.webm)
- [Rapport détaillé](after-verification.json)

Reproduction : `node tools/verify-phase2-wiki.mjs --after`, après build et lancement de l’aperçu local sur le port 4173. Aucun déploiement ni changement de base de données.
