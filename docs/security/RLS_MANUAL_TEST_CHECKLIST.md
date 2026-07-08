# RLS Manual Test Checklist

Objectif: verifier les acces reels autorises/interdits apres execution du schema Supabase Nameless.

## Preparation

- [ ] Faire une sauvegarde Supabase avant les tests.
- [ ] Creer deux comptes normaux: USER_A et USER_B.
- [ ] Creer si possible un troisieme compte normal USER_C pour les tests "non participant".
- [ ] Creer un compte ADMIN et le promouvoir uniquement depuis Supabase SQL Editor/Dashboard.
- [ ] Noter les UUID: USER_A_ID, USER_B_ID, USER_C_ID si disponible, ADMIN_ID.
- [ ] Remplacer les placeholders dans `docs/supabase/SAO_NAMELESS_RLS_TESTS.sql`.
- [ ] Verifier que le bucket Storage `iron-oath-storage` est prive.
- [ ] Garder DevTools Console et Network ouverts pendant les tests front.

## Tests SQL RLS

- [ ] Executer `docs/supabase/SAO_NAMELESS_RLS_TESTS.sql` bloc par bloc.
- [ ] Confirmer que toutes les colonnes `pass` valent `true`.
- [ ] Confirmer les notices `PASS` pour les operations interdites.
- [ ] Si `T10` est false avant patch, appliquer seulement apres validation `docs/supabase/SAO_NAMELESS_RLS_PATCH_001.sql`, puis relancer le bloc 4.
- [ ] Verifier qu'aucun test interdit ne modifie durablement les donnees.

## Profils et roles

- [ ] USER_A peut lire son profil.
- [ ] USER_A ne peut pas se promouvoir en `membre` ou `admin`.
- [ ] USER_A ne peut pas modifier `user_roles`.
- [ ] USER_A ne peut pas modifier un role/admin via DevTools ou appel Supabase manuel.
- [ ] ADMIN peut modifier les roles prevus.
- [ ] Les changements de role admin sont refletes dans `user_profiles` et `user_roles`.

## Messages et MP

- [ ] USER_A envoie un message mailbox a USER_B.
- [ ] USER_B voit le message.
- [ ] USER_C, si disponible, ne voit pas le message A/B.
- [ ] USER_A ne voit pas les messages USER_B vers ADMIN.
- [ ] Pour les MP de guilde, promouvoir USER_A et USER_B en `membre`.
- [ ] USER_A envoie un MP de guilde a USER_B.
- [ ] USER_B voit le MP de guilde.
- [ ] USER_C ou un compte non membre ne voit pas le MP de guilde.
- [ ] Apres application du patch 001, un participant demote hors guilde ne lit plus les anciens MP de guilde.

## Presence, planning, objectifs

- [ ] USER_A membre peut creer/modifier sa propre presence.
- [ ] USER_A ne peut pas modifier la presence de USER_B.
- [ ] USER_A normal/membre ne peut pas creer, modifier ou supprimer le planning.
- [ ] USER_A normal/membre ne peut pas creer, modifier ou supprimer les objectifs.
- [ ] ADMIN peut creer, modifier et supprimer planning/objectifs selon le besoin metier.

## Admin logs

- [ ] USER_A ne voit aucun `admin_logs`.
- [ ] USER_A ne peut pas inserer dans `admin_logs`.
- [ ] ADMIN peut lire `admin_logs`.
- [ ] ADMIN peut inserer une entree `admin_logs` avec `actor_id = ADMIN_ID`.

## Storage

- [ ] USER_A upload une image valide dans `iron-oath-storage/chat/USER_A_ID/...`.
- [ ] USER_B upload une image valide dans `iron-oath-storage/chat/USER_B_ID/...`.
- [ ] USER_A ne peut pas lire, remplacer ou supprimer le fichier de USER_B.
- [ ] USER_B ne peut pas lire, remplacer ou supprimer le fichier de USER_A.
- [ ] Un upload avec extension non autorisee est refuse.
- [ ] Un upload hors prefixe `chat/<auth.uid()>` ou `guild-activities/<auth.uid()>` est refuse.
- [ ] Une URL image malveillante (`javascript:`, `data:` non autorise, SVG scriptable, domaine inattendu) est refusee ou affichee comme texte neutre.

## XSS front

- [ ] Pseudo avec payload XSS affiche comme texte, jamais execute.
- [ ] Chat public avec payload XSS affiche comme texte, jamais execute.
- [ ] MP avec payload XSS affiche comme texte, jamais execute.
- [ ] Activity wall avec payload XSS affiche comme texte, jamais execute.
- [ ] Aucun retour de payload via `innerHTML` dangereux.
- [ ] Console sans erreur bloquante pendant les tests.

## Secrets et exposition navigateur

- [ ] Aucun `service_role` dans HTML/JS/CSS.
- [ ] Aucun database password dans HTML/JS/CSS.
- [ ] Aucune connection string `postgres://` ou `postgresql://` dans HTML/JS/CSS.
- [ ] Aucune valeur `Authorization Bearer` privee hardcodee.
- [ ] La cle anon/publishable visible, si architecture statique, est traitee comme publique et protegee par RLS.

## Validation finale

- [ ] Les tests SQL bloquent bien les acces interdits.
- [ ] Les tests front confirment les memes refus cote client.
- [ ] Le patch 001 est applique uniquement si le comportement strict sur les anciens MP de guilde est voulu.
- [ ] Aucun secret prive n'a ete ajoute au front.
- [ ] Aucune regression XSS visible.
