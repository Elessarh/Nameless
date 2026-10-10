# Carte et atelier administrateur — 10 octobre 2026

La carte publique dispose d’un atlas plus ample, de régions compactes et d’une fiche ouverte seulement après sélection. Le bandeau « Lieux d’intérêt » est retiré du DOM. Les noms des repères sont désactivés par défaut sur téléphone et restent disponibles dans les filtres. Les 15 fichiers de cartes et variantes sont inchangés ; aucune image IA ajoutée.

**44 contrôles navigateur réussis** : 39 principaux, 4 complémentaires, 1 panne de lecture. Six largeurs : 360, 390, 768, 1280, 1920 et 2560 px. Aucun débordement, image cassée ou erreur JavaScript dans les résultats finaux.

L’atelier `/admin-carte/` exige un compte administrateur vérifié. **Zones** : choisir un contour, déplacer ses sommets, puis enregistrer localement ou publier. **Repères** : choisir une entrée ou créer un repère, nommer, placer, puis publier, masquer, retirer ou restaurer. **Atlas** ouvre l’image originale.

Les brouillons sont privés à ce compte et navigateur. La publication partagée nécessite le service Supabase 008 ; sans lui, elle est désactivée explicitement.

Les captures et écritures administrateur utilisent une session QA isolée en mémoire, signalée à l’écran. Aucune donnée réelle modifiée. Vidéos vérifiées : `public-map-motion.webm` (10,64 s) et `admin-map-editor-motion.webm` (9,04 s).
