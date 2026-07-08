# Secure Supabase Architecture

## Decision courte

Recommandation: **Option B - Zero Secret Front avec backend/serverless**.

Raison: si l'objectif est qu'une inspection de page ne revele aucune cle Supabase, un site 100 % statique GitHub Pages ne peut pas satisfaire cette contrainte. En architecture statique, la cle anon/publishable est forcement visible dans le navigateur. Elle n'est pas un secret; la securite repose alors sur RLS stricte.

## Audit secrets front

Resultats du scan:

- Aucun `service_role`, database password, `postgres://` ou `postgresql://` actif detecte dans les sources front.
- `docs/supabase/SAO_NAMELESS_KEYS.md` contient uniquement des placeholders et rappelle que `service_role` est interdit cote client.
- `backup_20260129_144058/js/auth-supabase.js` contient des noms `SUPABASE_URL` / `SUPABASE_ANON_KEY`, mais les valeurs sont marquees `[REMOVED]`.
- `js/crypto-keys.js` obfusque une URL Supabase et une cle publishable/anon. Ce n'est pas une protection de secret; en Option A, cette cle doit etre consideree publique.
- `localStorage` actif est utilise pour preferences audio, etat de carte, onglets UI, cache mailbox connu, et legacy HDV. Aucun secret ne doit y etre stocke.
- HDV contient encore du legacy `localStorage` avec token/user fallback; HDV doit rester hors SPA et hors visible tant que ce code n'est pas remplace.

## Option A - Static GitHub Pages + Supabase direct

Principe:

- Front statique servi par GitHub Pages.
- Le navigateur charge `@supabase/supabase-js`.
- Le navigateur utilise une cle publishable/anon.
- La cle publishable/anon est publique et visible.

Avantages:

- Simple.
- Peu de deploiement.
- Compatible avec le site actuel.
- Auth Supabase directe possible.

Contraintes non negociables:

- Aucune `service_role` key dans HTML/JS/CSS.
- Aucun database password dans HTML/JS/CSS.
- Aucun secret dans `localStorage`, `sessionStorage` ou cookies JS.
- RLS activee partout.
- Policies explicites, sans `anon` sur les tables sensibles.
- RPC admin verifiees cote base.
- Roles jamais controles uniquement par l'UI.

Acceptable si:

- La cle visible est uniquement publishable/anon.
- Le schema `docs/supabase/SAO_NAMELESS_SCHEMA.sql` est applique.
- Les tests RLS sont joues avant toute mise en production.

Non acceptable si:

- Tu veux "aucune cle visible" au sens strict.
- Tu dois cacher l'existence du projet Supabase.
- Tu veux utiliser `service_role` pour des operations admin cote client.

## Option B - Zero Secret Front avec backend/serverless

Principe:

- Le front ne connait aucune URL/cle Supabase.
- Les secrets Supabase vivent dans des variables d'environnement serveur.
- Le front appelle uniquement des endpoints applicatifs.
- Le backend valide session, role, payloads, quotas et logs.

Avantages:

- Aucune cle Supabase visible dans les sources front.
- Possibilite de cookies `HttpOnly`, `Secure`, `SameSite`.
- Rate limiting et validation serveur.
- Centralisation des logs admin.
- Signed URLs Storage controlees par serveur.

Contraintes:

- Plus complexe.
- Besoin d'un hebergeur backend/serverless.
- Besoin de migration progressive des appels Supabase front.
- Le backend ne remplace pas RLS: RLS reste une defense obligatoire.

Hebergeurs possibles:

- Cloudflare Pages + Functions.
- Netlify + Functions.
- Vercel + Serverless Functions.
- Supabase Edge Functions.
- Petit backend Node/Express separe.

## Recommandation

Vu la demande "zero secret front", choisir **Option B**.

Transition prudente:

1. Garder le site fonctionnel en Option A pendant la migration.
2. Appliquer le schema RLS strict.
3. Sortir les pages sensibles derriere endpoints backend.
4. Retirer `crypto-keys.js` uniquement quand tous les appels front directs a Supabase sont remplaces.
5. Garder HDV hors SPA jusqu'a suppression du legacy localStorage/token fallback.

## Guardrails

- Ne jamais commiter `.env` reel.
- Fournir seulement `.env.example`.
- Refuser toute action admin si le role serveur/RLS ne confirme pas admin.
- Ne jamais faire confiance au role stocke ou affiche cote client.
- Ne pas rendre public un bucket d'uploads utilisateur.
- Ne jamais accepter `javascript:`, `data:`, `blob:`, SVG, HTML, JS ou XML uploades comme media utilisateur.
