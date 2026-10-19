# Profil, connexion et lecture — 18 octobre 2026

Cette passe termine les retouches commencées le 17 octobre. Elle conserve les illustrations approuvées et les données existantes.

- Profil : panneaux, portrait, champs, focus et retours de formulaire harmonisés. Le récapitulatif du compte conserve son ouverture native au clavier et s'adapte aux petits écrans.
- Connexion : décor partagé, panneaux plus lisibles et bouton Microsoft de 52 px avec états de focus, activation et indisponibilité. Présentation sur une colonne sur mobile.
- Informations : feuille de lecture opaque, sommaire avec cibles de 44 px et textes adaptés au mobile.
- Page introuvable : carte responsive, code 404 décoratif et deux liens natifs vers l'accueil et le codex.
- Les effets respectent la réduction du mouvement, le clavier et les couleurs forcées.

## Correction des ancres de lecture

Le routeur rechargeait la page et ramenait la lecture en haut lorsqu'un lien du sommaire changeait le fragment. Seules les pages de confidentialité et de conditions laissent désormais le navigateur gérer leurs fragments internes. Les changements de requête et les autres routes gardent leur cycle de navigation habituel.

Après un changement de page, le retour à une ancre recherche la section dans le nouveau contenu. La marge sous l'en-tête s'applique aux sections identifiées même avant leur reconnaissance par `:target`.

Contrôle final dans le navigateur à 390 × 844 : confidentialité `#services` → codex → retour arrière. Section à 91,8125 px, bas de l'en-tête à 65 px, marge calculée de 92 px et aucun débordement horizontal, y compris lorsque `:target` est encore absent.

## Validation

- Suite complète `npm test -- --skip-browser` réussie après la correction du routeur. La vérification navigateur en ligne de commande est remplacée par les parcours CUA dans le navigateur intégré.
- Après le dernier ajustement CSS : 205 contrôles `tools/test-native-fragments.mjs` réussis, compilation réussie et `git diff --check` sans erreur.
- Compilation : 13 routes, 14 pages de boss et 1 530 entrées de recherche. Les ressources reconstruites correspondent aux sources modifiées.
- Contrôles visuels à 1280 px et 390 px : profil connecté, connexion anonyme, français/anglais, formulaire et récapitulatif au clavier, sommaire, page introuvable et ses deux destinations. Aucun débordement horizontal observé.
- La vérification de connexion porte sur l'écran et la redirection du compte déjà connecté ; elle n'a pas lancé un nouveau parcours Microsoft. Aucun formulaire de profil ni changement distant n'a été soumis.

## Captures

- [Profil ordinateur](../visual-polish-2026-10-17/profile-desktop.png) et [mobile](../visual-polish-2026-10-17/profile-mobile.png).
- [Connexion ordinateur](../visual-polish-2026-10-17/connexion-desktop.png) et [mobile](../visual-polish-2026-10-17/connexion-mobile.png).
- [Page introuvable ordinateur](404-desktop.png) et [mobile en anglais](404-mobile-en.png).
- [Ancre du sommaire](reading-anchor-mobile.png) et [retour après navigation](reading-return-mobile.png).

## Suite : détails du bestiaire et des objets

Les quatorze fiches complètes de boss et mini-boss utilisent maintenant une feuille de style dédiée. Fil d'Ariane, titre et article sont alignés ; le portrait natif, les informations, le butin et les actions ont des marges cohérentes. Les anciens styles injectés et les espacements hérités des dialogues sont retirés de cette surface statique. Les classifications, descriptions, illustrations, liens, mentions de position inconnue et réserves sur les butins restent identiques.

Dans les deux catalogues, une barre de fermeture opaque reste visible pendant le défilement. Sur mobile, la fiche passe au-dessus du pied de page ; la priorité d'affichage revient à son état normal après fermeture. Le clavier, les états de focus et les transitions de panneau existants sont conservés.

Les aperçus absents ou dont le chargement échoue ont une explication FR/EN dans les cartes, les fiches et les objets liés. Le symbole neutre reste décoratif et ne prétend pas représenter l'objet. Un vrai visuel chargé ensuite retrouve son état normal. Les petits sprites liés sont remesurés à l'ouverture de leur onglet, qui ne disposait pas de dimensions lors du chargement masqué. Les icônes de butin ne répètent plus leur nom au lecteur d'écran.

### Validation de cette suite

- `npm test -- --skip-browser` réussi : dont 147 contrôles des objets, 96 du bestiaire, 160 des catalogues, 452 des quatorze fiches de boss et 5 553 du contrat des données officielles. Les 52 contrôles catalogue et les 160 contrôles de navigation ont aussi été rejoués après l'ajout de la barre de fermeture.
- Après le dernier ajustement CSS de superposition : compilation réussie, ressources reconstruites identiques aux sources et revue indépendante sans anomalie. La recette CUA remplace le test de disposition en navigateur CLI explicitement omis.
- CUA : fiches complètes à 320, 390, 768 et 1 280 px, sans débordement observé. À 1 280 px, les trois blocs commencent à 123 px et l'article a 32 px de marge interne. Les actions mesurées font au moins 44 px de haut ; le focus clavier reste visible.
- CUA mobile : objet à aperçu absent signalé, bouton de fermeture de 44 px entièrement visible en fin de défilement des deux catalogues, pied de page derrière la fiche, fermeture par Échap, retour au bouton « Voir Gorbel », restauration du défilement et de la priorité d'affichage. Les catalogues conservent 48 cartes par page.
- CUA : Léviathan → « Ouvrir dans le bestiaire » retrouve la créature 56 et sa fiche mobile. Gelée de Slime → objets liés → Noyau de Slime utilise les vraies relations et les images locales chargées.

Aucune nouvelle illustration, statistique ou identité d'objet n'est inventée. Les aperçus dont les ressources publiques restent insuffisantes gardent leur état neutre. Aucun changement de données à distance.

Captures : [Illfang sur ordinateur](boss-illfang-desktop.png), [Léviathan sur mobile](boss-leviathan-mobile.png), [butin et lecture au clavier](boss-loot-mobile.png), [aperçu indisponible](item-unavailable-mobile.png), [objet après défilement](item-scrolled-mobile.png), [créature après défilement](bestiary-scrolled-mobile.png). L'[état initial d'Illfang](boss-before-desktop.png) conserve la comparaison avant cette passe.

## Suite : recherche globale et filtres

La palette conserve désormais un état de chargement ou d'erreur explicite. Une panne de l'index ne devient plus une absence de correspondance à la saisie : le réessai reste disponible, conserve la requête et partage le chargement en cours. Les cinq accès rapides restent utilisables. Une vignette qui échoue est remplacée par le symbole décoratif existant, avec le même titre et la même destination.

Les favoris sans correspondance sont distingués d'une collection vide et proposent d'effacer la requête. Les résultats disposent de davantage d'espace en faible hauteur ; le titre et la fermeture restent accessibles. Les cadres, boutons, focus et états d'erreur utilisent les matières existantes et respectent les mouvements réduits et les couleurs forcées.

Dans les catalogues, retirer une pastille au clavier conserve le focus sur une pastille voisine, puis sur la recherche si elle était la dernière. Une activation qui ne détenait pas le focus ne le déplace pas. La suppression nettoie les paramètres correspondants de l'URL sans perdre les sélections, fragments, paramètres voisins ni l'état de navigation. Les recherches supprimées ne reviennent plus au rechargement.

Les options des filtres occupent toute la largeur, avec leurs compteurs alignés à droite. Sur mobile, titre, réinitialisation et fermeture restent visibles au défilement ; leur placement explicite tient compte de l'ordre différent des éléments dans les deux pages.

### Validation de la recherche et des filtres

- Suite complète `npm test -- --skip-browser` réussie, dont les nouveaux scénarios de recherche FR/EN et les 56 contrôles des pastilles, ainsi que les régressions de recherche/routeur, catalogue, sécurité et contenu. Le test de disposition en navigateur CLI est remplacé par les parcours CUA.
- Dernière compilation réussie après les ajustements CSS et les versions de cache, y compris la page 404. Les cinq ressources CSS/JS modifiées correspondent aux copies livrées. Revue indépendante terminée sans anomalie restante.
- CUA avec le vrai index : Ctrl+K, saisie, flèches, focus visible et fermeture ; aperçus et liens réels, aucun débordement constaté aux largeurs 320, 390 et 1 280 px. À 390 × 430, la liste mesure 169 px contre 68 px avant correction. À 320 × 350, elle conserve 114 px ; le champ reste nommé et la fermeture entièrement visible.
- Une instance locale isolée de recette a répondu 503 à la première requête d'index, puis servi les ressources compilées réelles. CUA confirme l'erreur après saisie, le bouton de réessai de 44 px, la récupération sans perdre « Illfang », le retour du focus au champ et la disparition de l'erreur. Cette panne n'affectait pas le serveur normal ; l'instance temporaire est arrêtée.
- Le test de favoris a utilisé uniquement cette origine isolée : ajout d'Albal, requête sans correspondance, effacement ramenant le favori, puis retrait du favori de test.
- CUA dans les deux catalogues : retrait de la recherche via Entrée, disparition de `q`, focus au champ, puis rechargement conservant la recherche vide et les 48 cartes. Dans le tiroir d'objets, après 1 334 px de défilement, la fermeture reste entièrement visible à 44 px et le titre à 1 px du bord supérieur. L'ordre et la taille des trois commandes du bestiaire sont conformes.

Captures : [recherche ordinateur](search-desktop.png), [recherche mobile en faible hauteur](search-compact-mobile.png), [panne locale contrôlée](search-error-mobile.png), [favoris sans correspondance](search-favorites-mobile.png), [filtres des objets](filters-items-mobile.png), [filtres après défilement](filters-items-scrolled-mobile.png), [filtres du bestiaire](filters-bestiary-mobile.png).
