# Phase A — rendu prêt pour validation

L’accueil utilise désormais quatre portails sculptés, un inventaire avec les sprites Minecraft natifs à l’échelle entière, et une bannière de guilde. Les fonds forêt, atelier, hall et donjon apparaissent autour des contenus. La navigation, les boutons et les panneaux ont des réactions animées ; la fermeture respecte le focus et la réduction des animations.

Build et suite de tests réussis. **35/35 vérifications navigateur** : navigation, recherche, filtres, fiches, clavier, Échap, focus, pause du décor, réduction du mouvement et carte existante. Aucun débordement horizontal, image cassée, erreur JavaScript ou HTTP locale dans ces parcours.

| Format | Capture de l’accueil |
| --- | --- |
| 1920 × 1080 | [Desktop](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/home-desktop.png) |
| 2560 × 1440 | [Grand écran](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/home-ultrawide.png) |
| 390 px | [Mobile complet](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/home-mobile-full.png) |

[Bestiaire](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/bestiaire-desktop.png) · [Objets](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/items-desktop.png) · [Guilde publique](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/guild-public-desktop.png) · [Donjon](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/dungeon-desktop.png) · [Vidéo de 16,52 s](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/phase-a-motion-demo.webm)

Les captures `guild-qa-*` portent un bandeau explicite : données isolées en mémoire, aucune API réelle. Les PNG `before-*` conservent le rendu précédent. Le [rapport navigateur](C:/Users/julie/OneDrive/Desktop/Nameless/docs/phase-a-premium-2026-10-09/browser-verification.json) détaille les contrôles. Il relève aussi la RPC Supabase de repères personnalisés déjà absente (404 externe) ; le comportement existant de la carte est conservé.

**Arrêt après la phase A : les régions polygonales attendent la validation.**
