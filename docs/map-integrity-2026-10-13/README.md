# Correction du décalage des calques de carte — 13 octobre 2026

Le fond de carte, les repères et les contours se retrouvaient dans des blocs séparés quand la feuille de style Leaflet était refusée au chargement direct.

## Cause reproduite

L'ancien attribut SRI attendait les octets CRLF de la copie Windows : `sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=`. Le blob Git, normalisé en LF, produit `sha256-M3v8pcq9A7OYFbJwD+vis7ft9VkhxZzUn4jssyghIwM=`. Un checkout Linux servait donc un fichier différent de l'empreinte attendue.

Un serveur local temporaire a servi les octets exacts de `git show HEAD:css/vendor/leaflet-1.9.4.css` avec l'ancien HTML. Dans le navigateur, les neuf calques, l'image et les repères étaient tous en `position: static`. Les repères apparaissaient sous l'image, comme dans la capture signalée. La navigation SPA pouvait masquer le problème parce que ses liens de stylesheet n'avaient pas d'attribut SRI.

## Correction

- Git impose désormais LF aux deux fichiers Leaflet protégés par SRI, sur Windows comme sur Linux.
- Les pages publique et administrateur utilisent l'empreinte CSS LF correcte ; la protection SRI est conservée.
- Les URL Leaflet et le registre des routes ont une nouvelle version pour renouveler les ressources en cache.
- `tools/test-vendor-integrity.mjs` vérifie les octets réels, leur normalisation Linux et les attributs Git effectifs. Il est découvert automatiquement par le lanceur de tests existant.

## Validation

Avec le même serveur et les mêmes octets CSS Git, le nouvel HTML rétablit `position: absolute` pour les neuf calques et les quinze repères ; l'image retrouve `max-width: none`. Le rechargement direct et le passage du palier 1 au palier 2 puis au palier 1 ont été contrôlés dans le navigateur. Le chargement direct de l'atelier administrateur a également été vérifié avec la session existante, sans éditer ni publier de données : ses neuf calques et quarante repères sont correctement positionnés en absolu.

Commandes réussies : `npm run build`, `node tools/test-vendor-integrity.mjs`, `node tools/test-map-leaflet.mjs`, `node tools/test-map-viewport.mjs` et `node tools/test-build-artifact.mjs` (48 documents HTML et 2 376 références locales).

- [Avant, avec l'ancien SRI et les octets Git LF](before-git-checkout.png)
- [Après, avec le nouveau SRI et les mêmes octets Git LF](after-git-checkout.png)
- [Aperçu local corrigé](after-local-preview-full.png)
- [Styles calculés après correction](rendering-after.json)
- [Styles calculés dans l'atelier après rechargement direct](rendering-admin-after.json)

La correction est locale. Aucun déploiement ni modification des données de carte n'a été effectué.
