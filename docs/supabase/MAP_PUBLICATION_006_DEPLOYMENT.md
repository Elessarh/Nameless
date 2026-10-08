# Publication des repères 006

Cette migration préparée accompagne le retrait public des anciennes quêtes principales. Elle n’a pas été exécutée sur Supabase.

Le catalogue statique exclut les parcours principaux avant de dériver leurs PNJ et relations. Le registre Supabase 005 peut néanmoins conserver des identités et placements historiques après une mise à jour du catalogue. Le nouveau champ `published` est donc faux par défaut. La lecture publique de la table du registre filtre les entités non publiées. La RPC conserve, pour chaque identité non publiée, un tombstone synthétique minimal : ID de placement nul, clé d’entité, palier, type, état `hidden`, coordonnées nulles. Ces clés seules sont nécessaires pour empêcher le retour d’un repère statique précédemment caché, y compris avec un ancien catalogue en cache ou avant l’application de l’allowlist. Aucun ancien parcours, titre, auteur ou placement privé n’est retourné. Les données, placements et accès privés de l’administrateur restent conservés.

Ordre d’application après sauvegarde et validation du projet cible :

1. Schémas existants jusqu’à `SAO_NAMELESS_MAP_MARKERS_005.sql`.
2. `SAO_NAMELESS_MAP_PUBLICATION_006.sql`.
3. `SAO_NAMELESS_MAP_ENTITY_SEED_005.sql`, régénéré avec le catalogue actuel.
4. `SAO_NAMELESS_MAP_PUBLICATION_SEED_006.sql`, qui publie uniquement les IDs de ce catalogue.
5. Livraison du build statique correspondant.

L’étape 006 seule masque les repères statiques du registre jusqu’à l’application de l’allowlist. Elle ne supprime aucune ligne. Le seed de publication peut être réappliqué après une évolution du catalogue ; les anciennes identités restent archivées, avec uniquement leur clé de masquage minimale exposée par la RPC. Réappliquer la migration ne réinitialise pas une allowlist déjà appliquée.

Vérifier en visiteur que les IDs principaux sont absents de la table `map_entity_registry` et qu’aucune ancienne coordonnée ne figure dans `read_map_marker_overrides()`. Une identité non publiée doit y apparaître uniquement sous forme de tombstone minimal, même sans override. Vérifier avec un compte administrateur que les placements historiques demeurent lisibles dans `map_marker_overrides`. Les tombstones des entités publiées doivent également rester visibles, sans coordonnées cachées, afin de masquer correctement les repères statiques. Avant le seed, une sélection d’une ville connue doit ouvrir ses informations sans afficher son ancien repère ni recentrer sur ses coordonnées statiques.
