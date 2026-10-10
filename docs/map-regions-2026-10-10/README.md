Contrôles réalisés sur l’aperçu local, avec Chromium réel, le 10 octobre 2026.

35 contrôles réussis : les 32 vérifications initiales couvrent six largeurs (360, 390, 768, 1280, 1920 et 2560), images et logo unique, portes d’accès réelles, douze contours indicatifs du palier 1, sélection souris/clavier, recherche, affichage, URL, paliers et navigation SPA. Éditeur vérifié : tracé, glisser-déposer, clavier, sommets, historique, sauvegarde locale, restauration et import/export. Mobile tactile, anglais, mouvement réduit et dialogues superposés contrôlés. Trois régressions supplémentaires vérifient « vallee » sans accent, les sélections rapides A→B→C pendant le zoom et le retour Précédent à une vue partagée précise, sans déplacement du cadrage.

Zéro erreur navigateur ou ressource locale. Les empreintes de 15 atlas originaux et variantes sont identiques. Aucun contour P2/P3 ajouté, aucune nouvelle image générée, aucune mutation Supabase effectuée par ces contrôles. Les limites restent explicitement indicatives ; les dessins de test utilisent des contextes isolés.

[Avant](before-map-1920x1080.png) · [Après](after-map-1920x1080.png) · [Zone sélectionnée](after-region-selected-1920x1080.png) · [Éditeur mobile](after-editor-390x844.png) · [Vidéo réelle, 13,24 s](map-regions-motion.webm).

Détails : `after-verification.json`, `final-verification.json` et cadrage final. La RPC de repères distante absente est documentée séparément ; son repli public reste conservé.
