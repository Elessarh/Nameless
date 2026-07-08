# Plan d'action RLS Supabase — procédure pas à pas

Ce document est la **marche à suivre**. Le SQL concret est dans
`docs/SUPABASE_RLS_SQL_TO_RUN.md` (diagnostic séparé des modifications).
Contexte et raisons : `docs/SUPABASE_RLS_CHECKLIST.md`.

> Je (l'assistant) **n'ai pas accès** à ton dashboard Supabase. Je ne peux donc
> **pas vérifier** l'état réel de tes policies. Ce plan te permet de le faire
> toi-même, sans rien casser, étape par étape.

## Rappels non négociables
- La **clé anon est publique** : elle est dans tes fichiers JS, tout le monde
  peut la lire et appeler l'API directement. C'est normal — mais ça veut dire
  que **RLS est ta seule vraie sécurité**.
- `js/crypto-keys.js` **n'est pas une sécurité** : il obfusque la clé, un
  attaquant l'extrait en 2 minutes.
- Toutes les vérifications côté JavaScript (rôle admin, propriété d'un ordre,
  filtre de messages) sont **cosmétiques**. Elles améliorent l'UX, pas la
  sécurité. Ne t'y fie jamais pour protéger des données.

---

## Avant de commencer (précautions)

1. **BACKUP obligatoire.** Supabase → *Database* → *Backups*. Si tu es en plan
   gratuit sans backup automatique, fais un export manuel :
   *Database* → *Backups* → *Download*, ou `pg_dump` via la connection string.
   👉 **Ne touche à aucune policy avant d'avoir un backup daté.**

2. **Travaille dans le SQL Editor** (Supabase → *SQL Editor*). Exécute les
   requêtes **une par une**, lis le résultat, avant de passer à la suivante.

3. **Piège classique** : activer RLS sur une table **sans** policy SELECT la
   rend **vide pour tout le monde** (le site semble « cassé »). Donc :
   *toujours* poser la policy SELECT en même temps qu'on active RLS.

4. **Ordre d'or** : d'abord **diagnostiquer** (lecture seule, aucun risque),
   ensuite **corriger** table par table, en **testant après chaque table**.

5. **Ne colle jamais un gros script d'un bloc.** Si une requête modifie quelque
   chose, elle est précédée d'un avertissement ⚠️ dans le fichier SQL.

---

## Ordre recommandé (phases)

**Phase A — Diagnostic (0 risque, lecture seule).**
Exécute la partie *A* de `SUPABASE_RLS_SQL_TO_RUN.md`. Note pour chaque table :
- RLS activé ? (oui/non)
- policies existantes (lesquelles, sur quelles commandes)
- triggers/fonctions liés au rôle
- types des colonnes sensibles (`price`, `quantity`, `progression`, `role`)

**Phase B — Fondations.**
1. Créer/valider la fonction `is_admin()`.
2. Poser le **trigger anti-auto-promotion** sur `user_profiles`.
3. Tester tout de suite (voir plan de tests).

**Phase C — Tables une par une**, dans cet ordre (du plus critique au moins) :
1. `user_profiles` (rôles = compromission totale si raté)
2. `messages` (vie privée)
3. `guild_chat` (vie privée + chat)
4. `market_orders` (HDV)
5. `purchase_history`
6. `guild_activity_wall`
7. `guild_planning`, `guild_objectives`, `guild_presence`
8. RPC `delete_user_completely` + Storage

Après **chaque** table : lance les 3 tests (joueur / admin / non-connecté) sur
les fonctionnalités liées. Si quelque chose casse → tu sais quelle table.

---

## Risques + policies indispensables par table

### `user_profiles` — CRITIQUE
- **Risque** : un joueur modifie son propre `role` → devient admin → contrôle
  tout. Ou modifie le profil d'un autre.
- **Indispensable** :
  - SELECT autorisé (affichage pseudos/têtes) — ok.
  - UPDATE limité à `id = auth.uid()` **ET** trigger qui **interdit** de changer
    `role` sauf admin.
  - Admin peut tout mettre à jour.

### `messages` (boîte mail) — CRITIQUE (vie privée)
- **Risque** : lire les messages privés des autres ; usurper l'expéditeur.
- **Indispensable** : SELECT seulement si `sender_id` ou `recipient_id` =
  `auth.uid()` ; INSERT seulement avec `sender_id = auth.uid()`.

### `guild_chat` — CRITIQUE (vie privée sur les DM)
- **Risque** : lire les DM des autres (`is_private = true`) ; supprimer les
  messages d'autrui sans être admin.
- **Indispensable** : DM lisibles seulement par les 2 parties ; INSERT
  `user_id = auth.uid()` ; DELETE auteur ou admin.

### `market_orders` (HDV)
- **Risque** : modifier/supprimer les ordres des autres ; créer un ordre au nom
  d'un autre ; prix négatif / non numérique.
- **Indispensable** : INSERT `user_id = auth.uid()` ; UPDATE/DELETE propriétaire
  ou admin ; CHECK `price >= 0`, `quantity >= 0`.

### `purchase_history`
- **Risque** : lire l'historique d'autrui.
- **Indispensable** : SELECT seulement si `seller_id` ou `buyer_id` =
  `auth.uid()` (ou admin) ; historique non modifiable côté client.

### `guild_activity_wall`
- **Risque** : un non-admin publie/modifie le mur.
- **Indispensable** : écritures **admin only** ; lecture membres/admins.

### `guild_planning` / `guild_objectives` / `guild_presence`
- **Risque** : un non-admin modifie planning/objectifs ; quelqu'un marque la
  présence d'un autre.
- **Indispensable** : écritures planning/objectifs **admin only** ;
  `guild_presence` : chacun sa propre présence, admin gère tout ;
  `progression` numérique + CHECK 0–100.

### RPC `delete_user_completely` + Storage
- **Risque** : n'importe qui supprime un compte ; upload/lecture Storage non
  restreints.
- **Indispensable** : garde `if not is_admin() then raise exception` en tête de
  la RPC (`security definer`) ; policies Storage (upload membres/admins).

---

## Actions concrètes dans le dashboard

- **Voir/activer RLS** : *Table Editor* → clic sur la table → onglet *RLS*
  (ou via SQL, partie A/B du fichier SQL).
- **Voir les policies** : *Authentication* → *Policies*, ou *Table Editor* →
  table → *Policies*. Diagnostic SQL en partie A.
- **Créer une policy** : soit via l'UI *New Policy* (templates), soit en collant
  le SQL de la partie B (recommandé pour être exact).
- **Trigger/fonction** : *SQL Editor* uniquement (pas d'UI dédiée).
- **Backup** : *Database* → *Backups*.
- **RPC** : *Database* → *Functions*, ou *SQL Editor*.
- **Storage** : *Storage* → bucket → *Policies*.

---

## Plan de tests (à faire APRÈS chaque table corrigée)

Prépare **3 comptes** : un **joueur** (`role = 'joueur'` ou null), un **membre**,
un **admin**. Et teste aussi **déconnecté**. Deux façons de tester :
- **Simple** : via l'UI du site (comportement réel attendu).
- **Rigoureux** : via le SQL Editor en simulant un utilisateur (voir la section
  « simuler un rôle » dans le fichier SQL) — c'est ça qui prouve que RLS tient
  même si un attaquant contourne le JS.

### Compte JOUEUR normal (non membre)
- [ ] Ne peut PAS ouvrir l'espace guilde / dashboard admin (déjà géré JS, mais
      vérifier qu'il ne peut pas non plus **lire** `guild_chat`/`guild_planning`
      via l'API).
- [ ] Ne peut PAS lire les `messages`/DM des autres.
- [ ] Ne peut PAS `UPDATE user_profiles SET role='admin'` sur lui-même → doit
      échouer (trigger).
- [ ] Ne peut PAS modifier le profil d'un autre.
- [ ] Peut créer un `market_order` **à son nom**, mais pas au nom d'un autre.
- [ ] Ne peut PAS supprimer l'ordre d'un autre.

### Compte ADMIN
- [ ] Peut changer le `role` d'un autre user (page admin fonctionne).
- [ ] Peut supprimer une activité / un item de guilde / une présence.
- [ ] Peut supprimer un message de chat (bouton admin) — et RLS l'autorise.
- [ ] La RPC `delete_user_completely` marche pour lui, échoue pour un joueur.

### Utilisateur NON CONNECTÉ (clé anon seule)
- [ ] Peut voir les pages statiques (accueil, carte, bestiaire…) — ok.
- [ ] Ne peut PAS lire `messages`, DM `guild_chat`, `purchase_history`.
- [ ] Ne peut PAS insérer dans quoi que ce soit de sensible.
- [ ] La lecture publique éventuelle (`market_orders` actifs) est **volontaire**
      et ne contient pas de données privées.

> Test-clé (le plus important) : **connecté en joueur normal**, tenter
> `update public.user_profiles set role='admin' where id = auth.uid();`
> dans le SQL Editor en contexte utilisateur → **doit être refusé**. Si ça
> passe, tout le reste est compromis.

---

## Résumé — ce que tu dois faire, dans l'ordre
1. **Backup** de la base.
2. **Phase A** : lancer les requêtes de **diagnostic** (lecture seule), noter l'état.
3. **Phase B** : `is_admin()` + **trigger anti-auto-promotion**, puis test.
4. **Phase C** : corriger table par table (ordre ci-dessus), **tester après chacune**.
5. RPC admin + Storage.
6. Rejouer les **3 profils de tests** en entier.
7. Rejouer les **tests XSS via API** (`docs/XSS_TEST_PAYLOADS.md`).

## Obligatoire AVANT toute remise en ligne publique
- [ ] RLS activé sur les 9 tables.
- [ ] Auto-promotion de `role` **impossible** (trigger testé).
- [ ] `messages` + DM `guild_chat` + `purchase_history` : lecture **cloisonnée**.
- [ ] `market_orders` : pas de modif/suppression croisée.
- [ ] Écritures activité/planning/objectifs/rôles : **admin only** côté serveur.
- [ ] RPC `delete_user_completely` protégée par `is_admin()`.

## Peut attendre la refonte Nameless (non bloquant)
- Contraintes CHECK sur `price`/`quantity`/`progression` (utile, pas critique si
  les colonnes sont déjà de type numérique — à confirmer en Phase A).
- Restriction fine de la colonne mise à jour pour « marquer lu » (`read_at`).
- Durcissement des policies Storage (type/taille) au-delà du basique.
- `username`/`author_name` dérivés serveur plutôt que client (amélioration,
  l'affichage est déjà échappé côté client).
