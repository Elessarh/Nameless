# Zero Secret Front Plan

## Objectif

Aucune cle Supabase visible dans le navigateur.

Cela implique:

- pas de `SUPABASE_URL` dans le front;
- pas de `SUPABASE_ANON_KEY` dans le front;
- pas de `service_role` dans le front;
- pas de database password dans le front;
- pas de token sensible en `localStorage` ou `sessionStorage`;
- front -> backend uniquement.

## Architecture cible

```txt
Browser
  -> HTTPS backend/serverless endpoints
      -> Supabase Auth / Database / Storage
```

Les secrets vivent uniquement dans les variables d'environnement du backend.

## Variables d'environnement backend

`.env.example` uniquement:

```txt
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
APP_ORIGIN=https://example.com
SESSION_COOKIE_NAME=nameless_session
```

Ne jamais commiter `.env`.

## Endpoints a creer

Auth:

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/callback
```

Profil:

```txt
GET   /api/profile
PATCH /api/profile
```

Guilde:

```txt
GET  /api/guild/planning
POST /api/guild/planning
GET  /api/guild/objectives
POST /api/guild/objectives
GET  /api/guild/activity
POST /api/guild/activity
GET  /api/guild/presence
POST /api/guild/presence
GET  /api/guild/chat
POST /api/guild/chat
GET  /api/guild/dm
POST /api/guild/dm
```

Storage:

```txt
POST /api/storage/sign-upload
POST /api/storage/sign-read
DELETE /api/storage/object
```

Admin:

```txt
GET    /api/admin/users
PATCH  /api/admin/users/:id/role
DELETE /api/admin/users/:id
GET    /api/admin/logs
```

## Sessions

Preferer cookies:

- `HttpOnly`
- `Secure`
- `SameSite=Lax` ou `Strict`
- expiration courte + refresh controle

Eviter:

- token access en `localStorage`;
- role admin en `localStorage`;
- session custom non signee.

## CSRF

Si cookies utilises:

- token CSRF par formulaire/action mutante;
- verification `Origin` et `Referer`;
- CORS strict;
- `SameSite=Lax` minimum.

## CORS

Autoriser uniquement:

```txt
https://ton-domaine.example
http://localhost:<port> en dev seulement
```

Refuser `*` avec credentials.

## Rate limiting

Limiter:

- login;
- inscription;
- verification Minecraft;
- chat;
- DM;
- uploads;
- endpoints admin.

## Validation serveur

Tout endpoint doit valider:

- session;
- role depuis Supabase/RLS, jamais depuis le client;
- payload types et longueurs;
- URL media;
- MIME/extension upload;
- ownership des objets.

## Deploiement possible

Cloudflare Pages Functions:

- bon choix si le site passe deja sur Cloudflare Pages;
- secrets dans dashboard Cloudflare;
- headers faciles.

Netlify Functions:

- simple pour GitHub;
- `_headers` possible;
- env vars dashboard.

Vercel:

- API routes simples;
- env vars dashboard;
- attention aux cold starts.

Supabase Edge Functions:

- proche de Supabase;
- secrets via Supabase;
- bon pour signed URLs/RPC, mais le domaine Supabase reste visible comme backend.

## Migration progressive

1. Geler HDV hors SPA.
2. Migrer `connexion` vers backend auth.
3. Migrer `profil`.
4. Migrer guilde/chat/DM avec signed URLs.
5. Migrer admin.
6. Retirer `js/crypto-keys.js`.
7. Retirer `@supabase/supabase-js` du front.
8. Retirer Supabase de `connect-src`.
