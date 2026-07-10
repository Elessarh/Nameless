# Nameless — Briefs de génération d'icônes pixel-art premium

Objectif : remplacer les icônes CSS actuelles (classes `.nm-pixel-icon` de
`css/components/pixel-icons.css`, utilisées sur /wiki et /quetes) par de
vraies icônes pixel-art premium générées par un outil d'image (ChatGPT/DALL·E,
Midjourney…).

## Mode d'emploi

1. Ouvrir un prompt de `prompts/` (un fichier = une icône).
2. Le coller tel quel dans l'outil de génération d'image.
3. Exporter en PNG fond transparent, 64x64 (et vérifier la lisibilité en 32x32).
4. Nommer le fichier selon `icon_manifest.json` (champ `filename`).
5. Déposer les PNG dans `assets/icons/pixel/` du site.
6. Demander ensuite l'intégration : remplacement des classes CSS par
   `<img src="/assets/icons/pixel/<nom>.png" alt="" aria-hidden="true">`
   (décoratif, texte réel conservé à côté).

## Contraintes communes (déjà incluses dans chaque prompt)

- pixel-art style Minecraft/custom UI fantasy MMORPG, rendu premium ;
- fond 100 % transparent, aucun texte, aucun watermark ;
- lisible en 32x32 et 64x64, contour sombre net ;
- palette Nameless : doré #c2a367 / #f4dda0, bleu nuit #0a0f1d / #6f92b3,
  vert discret #4e7a5a, rouge boss #a53a3a (seulement si le brief le demande) ;
- éclairage doux venant du haut-gauche, volume net, pas de flou.

## Sécurité

Icônes locales uniquement (`assets/icons/pixel/`), décoratives
(`aria-hidden="true"`), jamais d'images externes ni de SVG uploadé par des
utilisateurs.
