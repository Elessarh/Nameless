Nameless — Items Cleaned First Pass

Méthode
- Les icônes de item_use sont remplacées par leur source Items_raw lorsqu'une correspondance existe.
- Le fond gris uniforme est retiré par détourage conservateur (flood-fill depuis les bords), sans régénération IA.
- Le pixel-art original est conservé : aucune interpolation, aucun repaint automatique.
- Les éléments sans source raw correspondante restent basés sur item_use, avec nettoyage de transparence uniquement.

Résultats
- 96 icônes de item_use reconstruites depuis Items_raw.
- 10 icônes item_use sans source raw conservées/nettoyées.
- Les dossiers Event, late et Items disposent aussi d'une version nettoyée.

Dossiers
- item_use_cleaned/ : dossier prêt à comparer/remplacer avec item_use.
- Event_cleaned/ : assets d'événements détourés.
- late_cleaned/ et Items_cleaned/ : autres sources nettoyées.
- cleanup_report.csv : détail de chaque fichier traité.

Important
Ceci est une première passe automatique volontairement conservatrice. Les objets très particuliers peuvent encore nécessiter une retouche manuelle, mais les formes originales ne sont plus déformées par un repaint IA.
