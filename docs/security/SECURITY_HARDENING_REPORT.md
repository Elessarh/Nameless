# Security Hardening Report

## Resume

Travail effectue:

- Audit secrets/front storage/injection.
- Schema Supabase durci.
- Architecture Zero Secret Front documentee.
- Storage prive documente.
- CSP/headers documentes.
- Correctifs front contre handlers inline et `innerHTML` evitable.
- Plan de tests securite cree.

Recommandation finale: **Option B - Zero Secret Front avec backend/serverless** si l'objectif est qu'aucune cle Supabase ne soit visible dans le navigateur.

## Ce qui est protege

- Pas de `service_role` key ajoutee.
- Pas de database password ajoute.
- Pas de connection string ajoutee.
- Pas de vraie cle ajoutee dans docs ou code.
- RLS activee sur toutes les tables du schema strict.
- Tables sensibles sans policy `anon`.
- Roles separes via `user_roles`, avec `user_profiles.role` conserve pour compatibilite code.
- Auto-promotion bloquee par trigger.
- DM limites sender/recipient/admin.
- Admin RPC verifie `is_admin()`.
- Bucket Storage passe en prive dans le SQL.
- Uploads Storage limites a `png`, `jpg/jpeg`, `webp`, chemin prefixe par `auth.uid()`.

## Corrections front effectuees

- `js/auth-supabase.js`
  - bouton Microsoft reconstruit via DOM, plus via `innerHTML`;
  - affichage nav username/avatar via `replaceChildren` / `textContent`;
  - preview Minecraft via DOM, plus concatenation HTML;
  - vidage preview via `replaceChildren()`.

- `js/item-selector.js`
  - suppression du `onerror` inline;
  - fallback image via listener `error`.

- `js/map.js`
  - suppression des `onclick` inline dans popups Leaflet;
  - delegation `data-map-action="open-quests"`;
  - navigation SPA quand routeur disponible.

## Ce qui reste impossible en GitHub Pages statique

GitHub Pages + Supabase direct ne peut pas cacher:

- URL Supabase;
- cle publishable/anon;
- endpoints Supabase;
- appels reseau vers Supabase.

Dans ce modele, la cle publishable/anon est publique. Elle ne doit pas etre traitee comme un secret. La securite vient de RLS et des RPC.

## Option recommandee

Option B:

- backend/serverless;
- secrets Supabase en variables d'environnement serveur;
- cookies HttpOnly/Secure/SameSite;
- CSRF;
- CORS strict;
- signed URLs Storage cote serveur;
- validation serveur;
- rate limiting;
- logs admin.

## Fichiers crees/modifies

Docs:

- `docs/supabase/SAO_NAMELESS_SCHEMA.sql`
- `docs/security/SECURE_SUPABASE_ARCHITECTURE.md`
- `docs/security/STORAGE_SECURITY.md`
- `docs/security/CSP_AND_HEADERS.md`
- `docs/security/ZERO_SECRET_FRONT_PLAN.md`
- `docs/security/SECURITY_TEST_PLAN.md`
- `docs/security/SECURITY_HARDENING_REPORT.md`

Front:

- `js/auth-supabase.js`
- `js/item-selector.js`
- `js/map.js`

## SQL a executer

Executer manuellement:

```txt
docs/supabase/SAO_NAMELESS_SCHEMA.sql
```

Puis verifier:

- policies RLS listees a la fin du script;
- aucune table sensible lisible par `anon`;
- bucket `iron-oath-storage` prive;
- role admin cree manuellement pour le premier admin.

## Tests a faire

Executer:

```txt
docs/security/SECURITY_TEST_PLAN.md
```

Priorite haute:

- tentative update role;
- tentative lecture DM d'un autre user;
- tentative action admin par non-admin;
- upload SVG/HTML/JS/XML;
- XSS chat/MP/activity;
- inspection navigateur pour confirmer qu'aucun secret prive n'est present.

## Risques restants

- `js/crypto-keys.js` obfusque encore la cle publishable/anon. Ce n'est pas une vraie securite; a remplacer par backend Option B si zero secret strict.
- HDV contient du legacy `localStorage` et des handlers inline dans `pages/hdv.html`; il doit rester archive/hors visible tant qu'il n'est pas nettoye.
- Le code Storage front utilise encore `getPublicUrl`/chemins non prefixes; avec le schema strict, les uploads peuvent etre bloques jusqu'a migration signed URL.
- Certaines zones utilisent encore `innerHTML` avec donnees echappees ou donnees statiques; elles doivent rester sous surveillance.
- Les headers HTTP forts demandent un hebergeur autre que GitHub Pages ou un proxy.

## Prochaine etape

Choisir l'hebergeur backend/serverless de l'Option B, puis creer un squelette `server/` ou `api/` avec `.env.example`, endpoints auth/profile/guilde/admin et signed URLs.
