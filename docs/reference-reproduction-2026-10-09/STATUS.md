# Reproduction des références — 9 octobre 2026

La composition des quatre maquettes fournies est intégrée au site local : décor Minecraft/SAO plein écran, identité N dorée, navigation, catégories illustrées et galerie compacte ; catalogues à trois colonnes avec filtres et fiche latérale ; carte interactive avec panneau de lieu ; quartier général avec cinq onglets et calendrier.

## Interactions intégrées

- Recherche globale et raccourci Ctrl+K, menu ordinateur/mobile, annonces privées, réglage de l’ambiance sonore et pause des animations.
- Bestiaire et objets : cases de filtres avec nombres réels, filtres retirables, tri, grille/liste, sélection, fiches, onglets, drops, sources, objets liés et liens vers la carte.
- Carte : trois paliers réellement disponibles, transitions, zoom, recentrage, plein écran, partage, marqueurs et noms activables, légende, détails et galerie de lieux extraits de l’atlas réel.
- Guilde : planning et calendrier Europe/Paris, participants et rôles Tank/DPS/Support, inscriptions et désinscriptions, préparation persistée, création administrateur, annuaire, annonces, objectifs, présence et communications existantes.
- Focus clavier, fermeture Échap, retour du focus, traduction FR/EN, réduction des mouvements, annulation des réponses périmées et effacement des données privées lors d’un changement de session.

Les noms, équipements, coordonnées, lieux, membres et événements proviennent des données existantes. Les illustrations générées sont des décors, pas de nouvelles données de jeu. Les dix paliers et les personnages fictifs visibles dans les maquettes ne sont pas introduits dans le catalogue.

## Supabase

Migration `docs/supabase/SAO_NAMELESS_GUILD_EXPEDITIONS_007.sql` exécutée avec succès sur le projet **SAO-Nameless**, référence `iwrvdntlrjnoqzbwbsfm`, depuis la session administrateur ouverte par l’utilisateur. Migration additive dans une transaction ; aucune donnée de démonstration ajoutée.

Contrôles après application :

- `guild_event_attendance`, `guild_event_checklist` et `guild_event_checks` existent, avec RLS activée, lecture anonyme et insertion directe des clients refusées.
- Les quatre fonctions `guild_event_create`, `guild_event_register`, `guild_event_unregister` et `guild_event_set_check` existent. Exécution anonyme refusée ; autorisation membre/administrateur vérifiée dans les fonctions.
- L’API publique connaît les trois tables et renvoie `401 / 42501` pour les lectures anonymes, comme attendu.

Preuves : `supabase-migration-verified.jpg`, `supabase-functions-verified.jpg` et `supabase-public-api-verification.json`.

Les créations, inscriptions et checklists ont été testées dans une base PostgreSQL isolée, sans fabriquer d’expédition dans la base réelle. Les contrôles navigateur du quartier général utilisent soit son portail public, soit une fixture locale explicitement identifiée comme données de test.

### Service antérieur de repères administrables

Le contrôle navigateur a relevé une réponse `404 / PGRST202` pour `read_map_marker_overrides`. Vérification directe du schéma : les tables `map_entity_registry`, `map_marker_overrides`, la RPC et les deux fonctions de budget requises par 005 sont absentes. Les atlas et les repères statiques authentiques restent disponibles ; l’éditeur ne simule aucun enregistrement local.

Activer ce service exige les prérequis de `SAO_NAMELESS_HARDENING_004.sql`, puis 005, 006, le registre actuel et son allowlist de publication. 004 change aussi les règles de rôles, de messages et de fichiers ; cette extension a été présentée séparément à l’utilisateur. Aucun de ces anciens scripts n’a été exécuté lors de cette livraison.

## Validation

`npm run build` et `npm test` passent : syntaxe JavaScript, DOM, langues, sources de données, médias, navigation, carte Leaflet, autorisations et scénarios PostgreSQL isolés.

Les captures et la vidéo sont produites avec `tools/verify-reference-reproduction.mjs`. Voir `browser-verification.json` et le README du dossier pour les résultats navigateur.

L’aperçu est servi sur `http://127.0.0.1:4173/`. Les fichiers du site sont préparés dans `_site` ; aucun déploiement du front-end n’a été effectué.
