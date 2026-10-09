# Vérifier les mouvements dans le vrai site

La prévisualisation est le site local lui-même : [ouvrir Nameless](http://127.0.0.1:4173/). Pour la relancer : `npm run build`, puis `npm start`. Les captures figent un état ; elles ne prouvent pas à elles seules la fluidité.

1. Sur desktop, laisser le décor actif quelques secondes : la brume basse évolue sur 38 s et la lumière sur 21 s. Le panorama reste un seul bitmap ; seules la brume, la lumière et le premier plan vectoriel sont des couches indépendantes.
2. Déplacer le pointeur dans le hero. Le panorama se décale de **±4 px / ±2 px** maximum ; le premier plan répond dans l’autre sens. Les textes et boutons restent stables. Sur mobile/coarse et en largeur ≤768 px, la scène reste fixe.
3. Cliquer « Pause du décor » : brume et lumière se figent, profondeur remise à zéro. Le choix reste dans la session, y compris après une navigation complète. La réduction des mouvements imposée par le navigateur ne remplace pas ce choix sauvegardé.
4. Dérouler la page jusqu’à ce que le hero soit entièrement hors écran : les animations sont suspendues. Remonter : elles reprennent si la pause n’est pas choisie. L’onglet caché suspend aussi le décor ; sans IntersectionObserver, le fallback reste fixe.
5. Ouvrir Carte, Bestiaire ou Objets, puis revenir. Les pages du routeur utilisent une transition native courte après les vrais chargements. Les documents autonomes utilisent l’opt-in CSS de transition entre documents de même origine. Le rechargement manuel garde sa navigation habituelle. Sans support ou avec mouvements réduits, le changement reste immédiat.
6. Ouvrir la recherche par le hero ou Ctrl+K. Taper Illfang, flèche bas vers le résultat, puis Échap : le focus revient au bouton d’origine. Vérifier aussi le menu mobile anglais, fermé par Échap. Les fenêtres utilisent une entrée de 220 ms / 8 px ; leur fermeture rend immédiatement le contrôle et le focus.

## Preuves enregistrées

Les [états mesurés dans le DOM](motion-states.json) montrent notamment : décor actif puis évolution de la brume, pointeur à `2.95px / -0.49px`, pause et profondeur `0px`, puis `data-motion-suspended=true` lorsque le hero est entièrement hors viewport en 1280 × 720. Le premier défilement à 1920 conservait encore une partie du hero visible ; il est explicitement identifié comme défilement partiel dans le fichier.

Captures : [départ actif](screenshots/motion-active-start.jpg), [pointeur droit](screenshots/motion-pointer-right.jpg), [pause](screenshots/motion-paused.jpg), [menu anglais](screenshots/menu-390-en.jpg), [recherche mobile](screenshots/search-390.jpg). Le nom d’animation du panneau de recherche et sa durée ont été relevés dans le navigateur : `world-panel-enter`, `0.22s`.

Les tests `test-hybrid-home.mjs` couvrent les bornes, RAF coalescé, aucun travail en coarse/narrow/reduced/hidden/hors écran, pause de session, refus de stockage et nettoyage après SPA. `test-world-transitions.mjs` couvre callback différé périmé, retour vers la route courante, rejet d’animation, fallback et commit unique. Les media queries sont simulées en tests ; les préférences système de l’utilisateur n’ont pas été modifiées.

## Capturer correctement

Le réglage de viewport s’applique à l’onglet actif du navigateur. Relever `innerWidth/innerHeight` dans le même onglet avant la capture, charger les images différées, retirer le focus d’un onglet/bouton puis Ctrl+Home et vérifier `scrollTop=0`.

Les vues d’accueil utilisent `clip` et donnent les six tailles exactes annoncées. Les vues menu/recherche utilisent le screenshot de viewport : le recadrage `clip` a produit des images erronées sur ces états, malgré des rectangles DOM corrects. Ces images ont été remplacées et observées. Le [manifeste](screenshot-manifest.json) donne leurs dimensions réelles. Le mobile complet est un JPEG du document de 380 px de contenu ; il n’est pas agrandi artificiellement.

Il n’y a pas de vidéo enregistrée ni de mesure GPU certifiant 60 FPS. La démonstration navigateur, les états et les tests vérifient le fonctionnement. Le moteur n’a pas de boucle JS permanente : un RAF est demandé seulement par un mouvement du pointeur, et aucune lecture de layout n’a lieu dans ce RAF.
