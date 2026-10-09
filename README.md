# Nameless

Site de guilde Minecraft / Aincrad : HTML, CSS et JavaScript, navigation SPA progressive, Supabase Auth/PostgreSQL/Storage/Realtime. L'identité et les données du site existant sont conservées.

## Installation et lancement

Node.js 24 est la version utilisée en CI et pour les vérifications. Les outils nécessitent Node.js 22.19 ou supérieur.

```sh
npm ci
npm test
npm run build
npm start
```

Ouvrir `http://127.0.0.1:4173`. Le serveur sert exclusivement `_site`, généré par le build. Après une modification, relancer `npm run build` puis recharger la page. `PORT` permet de changer le port local. Ce serveur de recette ne remplace pas l'hébergement de production.

## Structure

| Dossier | Rôle |
|---|---|
| `index.html`, `pages/`, `404.html` | Documents source, y compris les anciennes URLs conservées |
| `js/`, `css/` | Modules de page, composants communs, routeur et traductions FR/EN |
| `assets/` | Illustrations, cartes, données de recherche publiques et polices locales |
| `js/vendor/`, `css/vendor/` | Supabase JS 2.117.2 et Leaflet 1.9.4 épinglés, licences incluses |
| `supabase/functions/` | Actions administratives et parcours Minecraft officiel dormant |
| `docs/supabase/` | SQL et procédure de migration de la base existante |
| `tools/` | Build, serveur local, audits et tests |
| `_site/` | Artefact public généré, ignoré par Git |

Le build génère les 12 routes (dont deux documents d’information en brouillon), les 18 fiches boss statiques, `robots.txt`, `sitemap.xml` et un index de recherche de 326 entrées dans l’état actuel des données. Les catalogues sources restent la référence : modifier les données existantes puis reconstruire, sans éditer les fichiers générés. Les comptes et données privées ne font pas partie de l'index de recherche.

## Configuration

`js/supabase-public-config.js` contient l'URL du projet et sa clé **publishable** prévue pour le navigateur. La protection des données repose sur RLS et les fonctions serveur. Ne jamais y placer une clé `service_role`, un secret OAuth ou un mot de passe.

| Variable | Où | Utilisation |
|---|---|---|
| `SERVICE_ROLE_KEY` | Secrets Supabase Edge uniquement | Actions administratives existantes |
| `SUPABASE_URL` | Fournie par Supabase Edge | URL du backend |
| `ALLOWED_ORIGINS` | Secrets Edge, facultative | Origines CORS séparées par virgules ; défaut : domaine Nameless et `www` |
| `PORT` | Terminal local, facultative | Port du serveur de recette, défaut 4173 |
| `AUDIT_BASE_URL` | Terminal local, facultative | Base URL Lighthouse, défaut serveur de recette |
| `CHROME_PATH` | Terminal local, si nécessaire | Exécutable Chrome pour Lighthouse |

Le frontend utilise Microsoft/Azure via Supabase Auth. La détection Minecraft par pseudo/UUID est publique et **ne prouve pas la propriété du compte**. Les secrets de l'ancien parcours `link-minecraft` sont décrits dans son README ; aucune nouvelle configuration de ce parcours n'est requise, il reste désactivé dans l'interface.

## Tests et performance

`npm test` vérifie la syntaxe JavaScript, les parcours DOM, les traductions, les contenus, le build publié, le cache, les dates Paris et 26 contrôles de sécurité avec PostgreSQL isolé. Les tests n'écrivent aucune donnée de production. Ils ne remplacent pas une recette avec les véritables comptes et policies Supabase.

```sh
# Avec le serveur local déjà démarré et Chrome installé
npm run audit:performance
```

Les rapports Lighthouse JSON sont conservés dans `docs/performance/lighthouse/` et ignorés par Git. Les résultats consolidés et leurs limites figurent dans [le rapport du 7 octobre 2026](docs/NAMELESS_AUDIT_2026_10_07.md).

## Migration et déploiement

Suivre [HARDENING_004_DEPLOYMENT.md](docs/supabase/HARDENING_004_DEPLOYMENT.md) : sauvegarde et inventaire des policies, recette, migration additive 004, déploiement de `admin-user-actions`, puis frontend. **Appliquer 004 avant le nouveau frontend**, qui stocke des chemins de médias. Ne pas réexécuter le schéma initial sur la production existante.

La workflow `.github/workflows/deploy-pages.yml` exécute `npm ci`, les tests et le build avant de publier `_site` sur GitHub Pages. Aucun dossier SQL, serveur, documentation ou outils de développement n'est publié. Le workflow part sur un push de `main` ou un lancement manuel. Les changements de cette intervention sont locaux : aucun push, déploiement ni migration de production n'a été exécuté.

Les en-têtes HTTP avancés doivent être appliqués sur le domaine via sa configuration Cloudflare. Voir [CSP_AND_HEADERS.md](docs/security/CSP_AND_HEADERS.md). La CSP des documents, les scripts et polices locaux sont déjà inclus dans le build.

## Direction visuelle et informations de site

La [direction Nameless](docs/NAMELESS_DIRECTION_VISUELLE.md) précise les couleurs, la typographie, les composants et les limites des effets visuels. Les informations utiles et les illustrations du projet passent avant les conventions de template.

La passe définitive Hybrid SAO Minecraft du 9 octobre est documentée dans [l’audit de départ](docs/definitive-hybrid-2026-10-09/phase-0/AUDIT.md), [la bible artistique](docs/definitive-hybrid-2026-10-09/ART_BIBLE.md) et [le rapport d’accueil avec captures](docs/definitive-hybrid-2026-10-09/phase-1/REPORT.md). L’audit distingue le résultat local de la publication publique et décrit la correction Git des archives immuables.

Les pages de confidentialité et de conditions sont liées depuis tous les footers. Elles restent des **brouillons à valider**, non indexés, tant que le responsable, son contact, les durées et les configurations des prestataires ne sont pas confirmés. Voir [les points de validation](docs/INFORMATIONS_LEGALES_A_VALIDER.md). Aucun faux nom, base juridique, durée de conservation ou consentement forcé n'a été inventé.
