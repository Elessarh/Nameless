# Nameless — composants MMORPG

Le kit suit [la bible artistique](ART_BIBLE.md). Il reprend les valeurs existantes de `css/tokens.css` sans ajouter de couleur. Les lignes fines, les angles courts et une petite courbe de métal ancien donnent une signature commune ; les sections de page restent ouvertes. Le kit est optionnel : seuls les éléments portant une classe `nm-game-*` reçoivent ces styles.

## Fichiers et chargement

Charger `css/components/mmorpg-kit.css` après les styles généraux et avant les styles de composition de l’accueil. Les deux SVG décoratifs sont référencés par un chemin relatif au CSS. Le sprite d’icônes est appelé directement depuis le HTML.

| Fichier | Poids non compressé | Fonction |
| --- | ---: | --- |
| `css/components/mmorpg-kit.css` | 3 560 octets | Cadres, panneaux, boutons, séparateurs, icônes |
| `assets/ui/nameless-frame.svg` | 301 octets | Quatre angles de 13 px, trait de 1 px à 65 % |
| `assets/ui/nameless-divider.svg` | 166 octets | Losange de 8 px et deux courts traits |
| `assets/ui/nameless-icons.svg` | 1 389 octets | Six symboles dans une grille de 24 × 24 |
| **Total** | **5 416 octets** | Aucun script, bitmap ou téléchargement de police |

Ces poids sont mesurés sur les fichiers livrés. Ils excluent la compression HTTP. Les SVG ne contiennent ni image embarquée, script, gestionnaire d’événement, `foreignObject`, métadonnée ou référence externe.

## API

| Classe | Usage |
| --- | --- |
| `.nm-game-frame` | Bordure simple et petits angles décoratifs. Pour une carte illustrée ou un panneau utile. Son `::before` est réservé au décor, sans interception des clics. |
| `.nm-game-panel` | Fond ardoise et padding adaptatif de 16–24 px. Ajouter `.nm-game-frame` seulement si une limite visible aide à comprendre le contenu. |
| `.nm-game-button` | Bouton ou lien d’action en HTML, cible minimale de 44 px, texte ivoire, fond bleu nuit, limite visible. |
| `.nm-game-button--primary` | Action principale : métal or ancien avec texte bleu nuit. |
| `.nm-game-button--quiet` | Action secondaire : fond transparent. La cible et la limite restent visibles. |
| `.nm-game-divider` | En-tête de section ouvert : premier enfant, trait discret, éventuel lien en dernier. Fonctionne avec `h2` ou `h3`. |
| `.nm-game-icon` | Icône de 24 px au trait de 1,5 px, héritant de la couleur du texte. |
| `.nm-game-icon--small` | Icône de 18 px pour un lien ou un contrôle compact. |

Les classes de composition définissent les largeurs, colonnes et marges. Elles peuvent compléter le kit, mais elles ne doivent pas recréer un second cadre ni remplacer le contraste des boutons. Un panneau déjà encadré ne doit pas contenir une autre enceinte décorative.

Les icônes disponibles sont `icon-map`, `icon-bestiary`, `icon-items`, `icon-guild`, `icon-search` et `icon-chevron`. Elles décrivent respectivement une carte pliée, une empreinte, une épée, un bouclier de guilde, une loupe et un chevron. Elles servent à la navigation ; elles ne prétendent représenter un item ou une créature spécifique du jeu.

## Exemples HTML

```html
<a class="nm-game-button nm-game-button--primary" href="/carte">
  <svg class="nm-game-icon" aria-hidden="true" focusable="false">
    <use href="/assets/ui/nameless-icons.svg#icon-map"></use>
  </svg>
  <span>Ouvrir la carte</span>
  <svg class="nm-game-icon nm-game-icon--small" aria-hidden="true" focusable="false">
    <use href="/assets/ui/nameless-icons.svg#icon-chevron"></use>
  </svg>
</a>

<button class="nm-game-button" type="button" data-home-search aria-haspopup="dialog">
  <svg class="nm-game-icon" aria-hidden="true" focusable="false">
    <use href="/assets/ui/nameless-icons.svg#icon-search"></use>
  </svg>
  <span>Rechercher une fiche</span>
</button>

<header class="nm-game-divider">
  <h2 id="explore-title">À explorer</h2>
  <a href="/bestiaire">Voir le bestiaire</a>
</header>

<a class="home-entry nm-game-frame" href="/bestiaire">
  <!-- Image réelle de catégorie et vrai texte HTML. -->
</a>

<aside class="nm-game-panel nm-game-frame" aria-labelledby="panel-title">
  <h2 id="panel-title">Un panneau utile</h2>
  <p>Un seul niveau de cadre entoure le contenu.</p>
</aside>
```

Le texte fournit le nom accessible des contrôles. Les icônes accompagnant ce texte restent masquées aux lecteurs d’écran. Un contrôle à icône seule doit avoir un nom accessible explicite. Les liens gardent leur vraie URL et les boutons gardent leur comportement natif.

## Interaction et accessibilité

Les contrôles réservent au moins 44 × 44 px. La sélection emploie un contour or de 2 px placé à 3 px de la cible, sans déplacement de mise en page. Les boutons reprennent les couleurs déjà contrôlées du projet : texte ivoire sur bleu nuit ou texte bleu nuit sur or ancien, limite de contrôle `--nm-border-control`.

Les survols changent la couleur de fond et de limite avec les durées des tokens existants. Le kit n’ajoute ni pulsation, particule ni boucle d’animation. `prefers-reduced-motion: reduce` annule ses transitions. En mode couleurs forcées, les ornements disparaissent et les limites utilisent les couleurs système.

Le décor n’exprime aucun état fonctionnel. `disabled` conserve le comportement natif d’un bouton. `aria-disabled="true"` ne bloque pas automatiquement un lien : si ce cas est nécessaire, le module fonctionnel doit gérer son activation et son annonce. Les styles seuls n’ajoutent aucune logique.

## Vérifications de production

Les trois SVG ont été analysés comme XML : racine `svg`, absence d’élément exécutable ou d’image incorporée et absence de référence externe. La feuille de style n’utilise aucun sélecteur de route ou de balise globale. Le kit n’a pas déclenché de build concurrent. La comparaison visuelle, les contrôles au clavier et l’affichage du sprite sont réalisés après son intégration à l’accueil par la passe principale.
