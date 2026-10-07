# CSP et en-têtes HTTP — 7 octobre 2026

Le frontend utilise une CSP en début de `<head>`, des scripts épinglés locaux et des polices locales. Aucun CDN de scripts ni Google Fonts n'est nécessaire à l'exécution. Les seules destinations réseau actives sont le projet Supabase précis, PlayerDB et les avatars mc-heads. Le lecteur audio est local ; les vidéos wiki autorisent YouTube.

## CSP appliquée aux documents

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' https://mc-heads.net https://iwrvdntlrjnoqzbwbsfm.supabase.co data:;
connect-src 'self' https://iwrvdntlrjnoqzbwbsfm.supabase.co wss://iwrvdntlrjnoqzbwbsfm.supabase.co https://playerdb.co;
media-src 'self';
frame-src https://www.youtube.com;
object-src 'none';
base-uri 'self';
form-action 'self';
```

Les styles inline restent nécessaires aux styles existants et au positionnement Leaflet. `data:` est limité aux images de confiance produites par les composants ; les URL de média utilisateur passent un validateur distinct et ne l'acceptent pas. Les scripts inline et handlers HTML ont été retirés des pages actives. Modifier la configuration Supabase nécessite de modifier aussi les domaines CSP explicites.

## Configuration HTTP à appliquer au domaine

GitHub Pages ne fournit pas de configuration de ces en-têtes par fichier de projet. Utiliser les règles de réponse HTTP du Cloudflare déjà devant le domaine, selon les capacités du compte. Aucun changement d'hébergeur n'est nécessaire. Cette intervention locale ne les a pas appliquées sur le compte Cloudflare.

| En-tête | Valeur proposée |
|---|---|
| `Content-Security-Policy` | CSP ci-dessus, avec `frame-ancestors 'none'` et `upgrade-insecure-requests` en HTTPS |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=31536000` après vérification HTTPS sur toutes les destinations utiles |

Ne pas ajouter `includeSubDomains` ou `preload` sans vérifier les sous-domaines. Retirer `X-Powered-By` s'il est présent et modifiable. La CSP meta n'applique pas `frame-ancestors` ; HSTS, Permissions-Policy et X-Frame-Options exigent une vraie réponse HTTP. Les en-têtes du serveur local de recette ne prouvent pas la configuration de production.

Après application, vérifier les en-têtes de l'accueil et d'une route profonde, puis tester connexion Microsoft, profils, chat/images, carte, wiki et vidéos. Conserver la CSP meta pour les anciennes copies HTML. Une règle Cloudflare ne doit pas bloquer les réponses CORS de l'Edge Supabase, servies par son domaine distinct.

## Cache

Le HTML doit permettre une revalidation rapide après déploiement. Les ressources statiques portent une version de cache commune. Ne pas mettre en cache les réponses Auth/Edge ni celles qui dépendent d'un JWT. Les fonctions Edge répondent `Cache-Control: no-store`. Les caches des profils et signatures sont isolés par session et vidés à la déconnexion.
