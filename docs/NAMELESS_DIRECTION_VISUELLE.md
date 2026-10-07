# Direction visuelle Nameless

Nameless est un site de guilde sur SAO France. L'interface doit aider à retrouver un boss, suivre une quête, situer un PNJ et organiser une sortie. Le monogramme existant, les illustrations du jeu et la signature « Sans nom. Jamais seuls. » donnent son identité. Les textes de navigation expliquent les actions et les informations disponibles.

## Références communes

Les variables de `css/style.css` restent la référence. Ne pas créer un second thème ou une bibliothèque de composants parallèle.

| Usage | Référence |
|---|---|
| Fond général | `--sao-bg-deep`, `#05070d` |
| Panneaux et inventaires | `--sao-bg`, `#0a0f1d` ; fond opaque pour lire |
| Accent Nameless | `--sao-gold`, `#c2a367` ; titres, sélection et séparateurs utiles |
| Accent secondaire | `--sao-cyan`, `#6f92b3` ; liens contextuels et focus |
| Texte principal / secondaire | `--sao-text`, `#c3c8d2` / `--sao-text-dim`, `#a0a8b8` |
| Succès / erreur / attention | `--sao-green` / `--sao-red` / `--sao-orange`, avec un libellé compréhensible |
| Rareté | Couleurs du catalogue ; le violet indique une rareté ou un type, pas un décor général |
| Titres / lecture | Cinzel / Inter, fichiers locaux ; pas de police supplémentaire |
| Rayons | 4 px pour les actions de l'accueil, 6 px pour les autres actions et panneaux ; pilules réservées aux badges et filtres |
| Espacement | Pas de 4 ou 8 px ; 16–24 px entre groupes, 24–32 px entre sections de lecture |
| Ombres | Réservées à la profondeur d'une modale ou d'un panneau superposé ; pas de halo permanent |
| Icônes utilitaires | SVG 24 unités, trait 1,8, couleur courante ; label accessible sur chaque bouton sans texte |
| Icônes du jeu | Ressources pixel art existantes pour métiers, quêtes, lieux et inventaires |

## Choix de composants

- Une créature ou un item forme une unité : une carte est adaptée. Un paragraphe, une règle ou une section de guide reste dans une mise en page ouverte.
- Les quêtes gardent leur ordre et leurs coordonnées. Les fiches boss publiques utilisent des sections séparées, pas une grande modale décorative.
- Un bouton décrit son action. Les changements d'état sont signalés par le texte, le contour ou la couleur ; la forme ne doit pas masquer sa fonction.
- Les champs ont un label visible, une bordure calme et un focus clair. Les erreurs restent proches de l'action concernée.
- Les modales ont un fond opaque, un titre, une fermeture accessible et un focus maîtrisé. Une palette utilise les mêmes couleurs et géométries.
- Une infobulle ajoute un détail court ; elle ne contient pas l'unique moyen de comprendre un bouton. Les tableaux restent des tableaux lorsque l'information est comparative.
- Le contenu est visible dès le chargement. Les mouvements de lecture, scintillements de titres et animations au scroll sont retirés. Le changement de diapositive et les réactions aux actions restent courts et suspendables.
- Pas d'avis inventé, de compteur sans source, de mention technologique promotionnelle ou de slogan substitué à une information.

## Passe du 7 octobre 2026

Accueil raccourci : présentation concrète, accès aux outils et trois étapes pour rejoindre la guilde. Douze cartes répétitives supprimées. Boutons moins arrondis, fonds de lecture sans flou, halos de survol retirés, animation d'ambiance figée, icônes emoji de contrôle remplacées. Les illustrations et le monogramme restent ceux du projet.

La confidentialité et les conditions utilisent des documents simples avec sommaire et sections. Ce sont des brouillons à valider, pas des déclarations de conformité juridique.
