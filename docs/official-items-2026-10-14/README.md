# Catalogue des objets officiels — 14 octobre 2026

Le catalogue actif reprend les **1 382 objets** du [wiki public SAO Minecraft](https://saominecraft.com/fr/wiki), importés entre 08 h 54 et 09 h 06, heure de Paris. L’import a parcouru 139 pages publiques réparties sur 41 catégories annoncées, dont 34 contiennent des objets. Il conserve les huit raretés publiées, les noms, descriptions, niveaux et valeurs des caractéristiques.

Il s’agit d’un instantané du wiki public, pas d’une synchronisation directe du serveur de jeu. Aucun fichier des anciennes versions du serveur local n’alimente ce catalogue. Aucun objet, taux de butin, niveau ou emplacement manquant n’est inventé.

## Images

La passe finale fournit **1 315 aperçus** : 918 textures plates vérifiées et 397 vues natives en volume. Les 67 autres fiches ont une présentation neutre : 40 références ambiguës, 20 absences de modèle public et 7 cas non pris en charge. Les SVG actifs représentent 1 160 fichiers uniques, pour 32 404 703 octets au total avant compression HTTP.

Les images affichées proviennent des modèles et textures natifs publiés par SAO Minecraft. Les vues plates utilisent une texture entière vérifiée ; les vues en volume projettent les cuboïdes, rotations et UV d’origine. Les textures PNG restent identiques octet par octet. Aucun visuel IA et aucune géométrie ajoutée ne servent d’aperçu d’objet.

Une correspondance de nom générique ou une plage de CustomModelData ne suffisent pas à prouver l’identité d’un objet. Les références contradictoires et les géométries non prises en charge restent neutres. Leur fiche conserve ses données, avec une indication d’aperçu indisponible.

La revue a notamment corrigé l’alias de « Bar », qui désignait un meuble, et le CMD de la clé de Xal’Zirith, qui désignait un tonneau. Les textures natives retenues correspondent exactement aux PNG du poisson et de la clé. Le cas inverse existe aussi : le PNG brut de l’Amulette d’Améthyste représente un masque, tandis que son modèle natif représente le bijou. Ce dernier est autorisé par une preuve de revue avec empreintes figées ; une modification de ces sources exige une nouvelle revue. Les conflits restant sans corroboration ne publient aucun aperçu.

Les 496 PNG bruts récupérés pendant l’import sont des pièces d’audit : plusieurs sont des planches UV, parfois associées à un autre objet. Ils ne sont pas publiés comme vignettes sans preuve de texture plate. Les modèles et textures sources des projections restent également dans le workspace pour permettre un audit ; le site sert les SVG autonomes sélectionnés par le manifeste.

Le manifeste `data/official-item-previews.json` décrit la disponibilité de chaque aperçu, ses sources, empreintes SHA-256 et budgets. La validation compare le modèle, les textures et le SVG. Elle vérifie aussi que le SVG ne charge aucun contenu externe ou exécutable. Les budgets sont de 384 éléments, 6 000 fragments projetés et 750 000 octets par aperçu.

La vérification visuelle est réalisée dans le navigateur sur des objets représentatifs, puis sur le catalogue PC/mobile. Ces contrôles ne constituent pas un test dans le client Minecraft ni dans Blockbench.

## Navigation et compatibilité

- 48 objets par page, recherche, catégories, raretés, niveaux, grille/liste et fiches détaillées.
- 85 anciens identifiants de fiches reconnus par une correspondance de nom exacte. Les 19 identifiants absents ou ambigus affichent une information et une recherche, sans recréer une ancienne fiche.
- Les objets sont des entrées globales du catalogue : aucun palier ou repère n’est déduit de leur nom.
- 53 associations déjà renseignées par Nameless avec le bestiaire sont conservées et signalées comme restant à confirmer sur le serveur actuel. Elles ne font pas partie de l’export officiel des objets.
- La recherche globale et les liens du bestiaire utilisent les mêmes identités actuelles.

## Actualiser

Depuis la racine du projet, avec Node.js 22.19 ou plus récent :

```powershell
npm run import:items
npm run preview:items
npm run build
npm test -- --skip-browser
npm start
```

L’import ne lit que les pages et ressources publiques officielles. Il ne nécessite ni session administrateur, ni clé de service, ni modification de Supabase. Il valide la couverture et les identités avant de remplacer l’instantané.

Le rendu réutilise son cache uniquement pour le même instantané et contrôle l’empreinte de l’index des modèles. Pour redemander les ressources du même instantané : `npm run preview:items -- --refresh`. Si l’index a changé entre l’import et le rendu, refaire l’import afin de travailler sur une source cohérente.

Le build refuse un manifeste incomplet ou lié à un autre instantané avant de remplacer `_site`. Les versions de cache du catalogue et de la recherche changent avec les données et les aperçus.

Le test de navigateur natif exclu par `--skip-browser` est remplacé localement par la recette CUA : vérifier 48 cartes, recherche/filtres/tri, fiche et fermeture au clavier, langue, sources, absence d’image cassée et de débordement horizontal à 390 px et 1 920 px. En CI, `npm test` lance la suite complète.

Ces commandes préparent et vérifient le site local. Elles ne publient pas le site et ne poussent aucun commit.

## Validation du 15 octobre 2026

`npm test -- --skip-browser` se termine avec succès : syntaxe JavaScript, contrat des 1 382 objets, 45 contrôles des preuves d’aperçus, 38 contrôles du moteur natif, inventaire, accueil, recherche, bestiaire, carte, pages générées et contrôles de sécurité isolés. Le test de mise en page avec un navigateur lancé en CLI est explicitement remplacé par les contrôles CUA ci-dessous.

Dans le navigateur, les vues de 1 920 px et 390 px conservent 48 objets par page sans débordement horizontal. Le filtre Arcs produit 22 objets triés par niveau ; le filtre Boucliers mobile en produit 37. La fiche du Casque du Titan affiche son modèle natif, les valeurs originales +1.4 et +32, les libellés français, les onglets et la source officielle. Fermeture au clavier et passage FR/EN/FR vérifiés. La recherche rapide affiche le même SVG et ouvre la fiche actuelle. Les 48 cartes chargées de la vue initiale ne contiennent aucune image cassée.

L’accueil utilise également des objets et aperçus actuels. Les 14 pages de boss portent la même version de recherche que les autres routes ; cette version dépend des données, du manifeste et du code du composant.

Preuves locales : [aperçus natifs variés](native-variety.png), [fiche PC](items-desktop-detail.png), [fiche mobile](items-mobile-detail.png), [grille mobile filtrée](items-mobile-grid.png), [catalogue PC](items-desktop-grid.png).
