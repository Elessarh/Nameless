# Plan technique - Liaison Minecraft reelle

Date : 2026-07-09

## Decision

La connexion Supabase Azure actuelle prouve seulement que l'utilisateur a ouvert une session Microsoft via Supabase Auth. Elle ne prouve pas que ce compte possede un profil Minecraft, et elle ne donne pas de maniere fiable le pseudo Minecraft, l'UUID Minecraft ou la tete d'avatar.

Nameless doit donc afficher l'etat actuel comme :

- `Compte Microsoft connecte`
- `Minecraft non lie`

Le site ne doit jamais considerer `user_metadata`, un email, un pseudo saisi manuellement ou un gamertag Xbox comme preuve de possession Minecraft.

## Architecture cible

Le site GitHub Pages reste un client public. La liaison Minecraft doit passer par un backend, idealement une Supabase Edge Function :

1. Le joueur clique sur `Lier mon compte Minecraft`.
2. Le front appelle une Edge Function `link-minecraft/start`.
3. La fonction genere un `state` anti-CSRF, stocke une preuve temporaire cote serveur, puis redirige vers Microsoft OAuth avec les scopes requis.
4. Microsoft renvoie le code OAuth vers une redirect URI de la fonction.
5. La fonction echange le code contre des tokens cote serveur.
6. La fonction effectue le flux Xbox Live / XSTS / Minecraft Services.
7. La fonction recupere le profil Minecraft verifie.
8. La fonction met a jour `public.user_profiles` avec les champs Minecraft verifies.
9. Le front recharge le profil et affiche le pseudo + avatar Minecraft.

## Flux d'authentification reel

Le flux a implementer cote backend est :

1. Microsoft OAuth avec le scope Xbox approprie, notamment `XboxLive.signin` et, si necessaire, un scope offline/refresh cote serveur.
2. Echange du token Microsoft contre une authentification Xbox Live.
3. Demande d'un token XSTS.
4. Utilisation du token XSTS pour authentifier l'utilisateur aupres de Minecraft Services.
5. Appel Minecraft Services pour recuperer le profil Minecraft du compte.
6. Stockage securise dans `user_profiles` :
   - `minecraft_username`
   - `minecraft_uuid`
   - `minecraft_verified = true`
   - `minecraft_avatar_url` si utile
   - `minecraft_skin_url` si utile
   - `minecraft_linked_at`
   - `microsoft_provider_id` si utile pour audit et rapprochement

Les endpoints exacts devront etre valides au moment de l'implementation, car les APIs Xbox/Minecraft ne doivent pas etre codees dans le front et peuvent evoluer.

## Regles de securite

- Aucun `MICROSOFT_CLIENT_SECRET` dans HTML, JS, CSS ou commits publics.
- Aucune `SUPABASE_SERVICE_ROLE_KEY` dans HTML, JS, CSS ou commits publics.
- Aucun token Xbox, XSTS ou Minecraft dans `localStorage`.
- Aucun refresh token Xbox/Minecraft expose au navigateur.
- Aucun pseudo Minecraft manuel ne peut declencher `minecraft_verified=true`.
- Le front ne peut pas ecrire `minecraft_username`, `minecraft_uuid`, `minecraft_verified`, `minecraft_avatar_url`, `minecraft_skin_url`, `minecraft_linked_at` ou `microsoft_provider_id`.
- La fonction backend doit verifier le `state` OAuth et le lier a l'utilisateur Supabase connecte.
- La fonction backend doit refuser toute liaison si la session Supabase n'est pas valide.
- La fonction backend doit journaliser uniquement des evenements non sensibles.
- Les erreurs renvoyees au front doivent etre generiques et ne jamais exposer de tokens.

## Impact Supabase

Le patch SQL `docs/supabase/SAO_NAMELESS_MINECRAFT_LINK_PATCH.sql` prepare les colonnes et renforce le trigger `prevent_profile_privilege_escalation`.

Le principe RLS attendu :

- un utilisateur connecte peut lire et modifier sa fiche joueur pour les champs autorises ;
- un utilisateur normal ne peut pas s'auto-promouvoir `admin` ;
- un utilisateur normal ne peut pas definir des champs Minecraft verifies ;
- un admin ou une fonction backend peut ecrire les champs Minecraft apres verification reelle.

## UI temporaire

Tant que la fonction n'existe pas :

- afficher `Compte Microsoft connecte` ;
- afficher `Minecraft non lie` ;
- afficher le bouton `Lier mon compte Minecraft` ;
- au clic, afficher un message propre indiquant que la liaison necessitera une verification securisee via Xbox/Minecraft Services ;
- ne pas appeler PlayerDB ou une API tierce cote front pour simuler une verification.

## References a verifier avant implementation

- Microsoft identity platform / application registration : https://learn.microsoft.com/en-us/graph/auth-register-app-v2
- Xbox services authentication et XSTS : https://learn.microsoft.com/en-us/xbox/gdk/docs/services/fundamentals/s2s-auth-calls/service-authentication/live-xbox-live-authentication
- XSTS authorization endpoint : https://learn.microsoft.com/en-us/gaming/gdk/docs/services/fundamentals/s2s-auth-calls/s2s-calls/live-title-service-calls-xbox-live
- Minecraft EULA et conditions des services : https://www.minecraft.net/en-us/eula

## Premiere implementation conseillee

1. Appliquer le patch SQL en environnement Supabase de test.
2. Creer l'Edge Function documentaire `link-minecraft`.
3. Ajouter un endpoint `start` qui genere le `state` et redirige vers Microsoft.
4. Ajouter un endpoint `callback` qui valide le `state`, echange les tokens et recupere le profil Minecraft.
5. Ecrire les champs Minecraft avec le service role uniquement dans la fonction.
6. Ajouter des tests manuels RLS : utilisateur normal, admin, session invalide, tentative de modification directe des champs Minecraft.
