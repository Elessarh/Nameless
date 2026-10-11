# Candidat de publication — 11 octobre 2026

Recette menée sur le build local et deux bases SQL éphémères. Aucun déploiement, commit ou push effectué.

## Parcours vérifiés

- Microsoft : ouverture du fournisseur, connexion effectuée par l’utilisateur, retour au vrai profil. Sauvegarde avec les valeurs existantes, puis rechargement confirmant leur conservation. Accès réel à la guilde et à l’atelier administrateur vérifié en lecture.
- Catalogues : Petit Slime → Gelée de Slime → source Petit Slime → carte, navigation souris/clavier et retour arrière. Inventaire de 48 objets, proportions natives, absence de débordement à 1920, 1280 et 390 px. Tiroir mobile : cible de fermeture de 44 px, isolation du fond et retour du focus.
- Carte, **base de test uniquement** : déplacement d’un sommet, annuler/rétablir, sauvegarde et rechargement du brouillon, publication d’une zone puis lecture de son statut par un visiteur. Création, position, sauvegarde, publication et masquage d’un repère libre. Refus de l’atelier pour un membre. Vue mobile de 390 px et aide FR/EN.
- Guilde, **base de test uniquement** : inscription, changement de rôle, checklist, rechargement, désinscription et retour au bouton actuel après fermeture. Création administrateur avec capacité et préparations, puis conservation après rechargement. Refus pour un joueur non membre.

La seule sauvegarde vers le service réel concerne le profil, avec les mêmes valeurs. Aucun événement, repère, contour ou message fictif n’a été envoyé au service réel.

## Correctifs issus de la recette

- Trois chemins de ressources de la page 404 deviennent absolus, afin de fonctionner sur une URL inconnue profonde.
- Le registre de navigation et les modules modifiés ont des versions de cache mises à jour.
- La fiche d’expédition restitue le focus au bouton actuel lorsqu’une inscription a reconstruit la liste, avec des replis adaptés si le bouton n’est plus affiché. Une autre fenêtre native conserve son focus.
- L’atelier explique la relation entre une zone et sa fiche. Le champ de nom lié conserve son état de lecture seule après un changement de langue.
- Playwright est déclaré et verrouillé dans les dépendances de développement. La CI installe Chromium et ses dépendances Linux avant la suite complète ; le test visuel utilise les dépendances du projet. Cette préparation suit la [documentation officielle Playwright](https://playwright.dev/docs/ci).

## Preuves et candidat

[Contrôle de l’artifact](artifact-check.json), [recette navigateur](browser/verification.json), [éditeur desktop](browser/map-admin-desktop-qa.png), [éditeur mobile](browser/map-admin-mobile-qa.png), [repère public de test](browser/map-custom-marker-public-qa.png), [inscription persistée](browser/guild-signup-persisted-qa.png), [404 profonde](browser/404-deep.png).

Le build à publier se trouve dans `_site`. Il contient les 13 routes, 18 fiches boss et 252 entrées de recherche. Les outils de recette, leurs comptes et leurs bases éphémères sont exclus de cet artifact.

## Limites avant publication

La connexion réelle a été validée depuis localhost. L’autorisation de retour OAuth vers le domaine de production, le DNS et la configuration distante GitHub Pages n’ont pas été modifiés ou vérifiés ici.

Les contrôles exécutables sans navigateur passent séparément de la recette CUA. Le test visuel Playwright n’est pas lancé par shell dans cette session ; il reste actif dans la CI complète. La suite complète sur le runner GitHub devra donc confirmer ce dernier contrôle.

L’Atlas de l’éditeur présente l’image et sa calibration. Les zones publiables sont rattachées aux fiches connues ; un contour libre doit être associé à une fiche avant publication. Les repères libres peuvent être publiés.

La mise en ligne attend la validation visuelle et l’autorisation explicite de l’utilisateur. La workflow publie lors d’un push sur `main` ou d’un lancement manuel : une telle action n’a pas été déclenchée.
