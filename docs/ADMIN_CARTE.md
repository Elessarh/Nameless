# Administrer la carte Nameless

L’atelier se trouve à `/admin-carte`, depuis **Administrer la carte** sur la carte publique ou **Atelier cartographique** dans le dashboard. Il exige une session dont le rôle Supabase est `admin` ; un membre ou un visiteur ne peut pas publier.

## Zones

1. Choisir le palier, puis l’onglet **Zones** et le contour à modifier.
2. **Ajuster** permet de déplacer les points dorés. Les flèches du clavier déplacent le point sélectionné ; Maj + flèche affine le déplacement.
3. Sélectionner un point pour **Ajouter un point** ou **Supprimer le point**. Pour dessiner, choisir **Dessiner**, poser les points, puis **Fermer le contour**. **Annuler** et **Rétablir** permettent de revenir sur une modification.
4. **Enregistrer le brouillon** conserve le dessin sur cet appareil et pour ce compte administrateur. **Fichiers et restauration** contient l’import/export JSON et la restauration. **Nom et fiche associée** permet de lier un nouveau contour à une fiche existante.
5. Choisir des limites **Indicatives**, **Vérifiées**, ou un **Brouillon partagé** invisible au public, puis **Publier la zone**. Décocher **Zone visible** masque le contour publié.

Les contours publiés doivent être liés à une fiche de zone existante ; les noms de ces fiches sont conservés. Les dessins personnels sans fiche restent des brouillons exportables. Le palier 1 possède douze propositions indicatives. Les paliers 2 et 3 n’ont pas de limites inventées.

**Restaurer les limites d’origine** retire la modification partagée et rétablit la proposition du site. Un contour peut comporter 3 à 96 sommets, sans croisement, dans les limites de l’image.

## Repères

1. Choisir **Repères**, puis une entrée existante ou le bouton **＋** pour créer un repère.
2. Pour une nouvelle entrée, renseigner son nom et sa description. Choisir l’icône et son état de publication.
3. Cliquer **Placer sur la carte**, puis dans l’image, ou déplacer le point doré. Le point fonctionne aussi au clavier (flèches, Maj pour affiner). **Position précise et restauration** contient les coordonnées relatives entre 0 et 1.
4. Enregistrer un brouillon privé ou **Publier le repère**. **Masqué** conserve l’entrée sans l’afficher. Un nouveau repère peut aussi être enregistré comme brouillon partagé.

**Restaurer la position** rétablit la position native d’une fiche existante. **Retirer ce repère** retire sa publication ; une fiche native peut ensuite être restaurée. Les nouveaux repères retirés conservent une trace administrative et leur révision.

## Conflits et atlas

Une révision protège chaque modification partagée. Si une autre personne a publié entre-temps, l’écriture est refusée et le brouillon reste disponible. **Recharger les données** permet de relire la révision actuelle avant de republier son dessin en connaissance de la modification concurrente.

L’onglet **Atlas** affiche les dimensions et l’image originale du palier. Les images, dimensions et calibrations X/Z sont conservées. Remplacer l’image source nécessite aussi de revoir sa calibration et les contours : cet atelier édite les données superposées à l’atlas.

## Activation Supabase

La migration `docs/supabase/SAO_NAMELESS_MAP_WORKSPACE_008.sql` a été appliquée dans le projet Nameless le 10 octobre 2026. Les trois lecteurs publics ont ensuite répondu HTTP 200. La refonte de l’interface réutilise ce service ; aucune nouvelle migration n’est nécessaire.

Les accès en écriture passent par les RPC de l’atelier avec vérification du rôle administrateur. En cas d’indisponibilité, l’édition locale reste accessible et les boutons de publication sont désactivés.

La migration a été exécutée dans PostgreSQL isolé pour tester les droits, les limites des polygones, les révisions, les restaurations, les brouillons privés, l’audit et les budgets atomiques. Les tests de navigateur utilisent une session et une base fictives clairement identifiées ; ils n’écrivent rien dans le projet réel.
