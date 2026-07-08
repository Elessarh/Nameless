# Checklist RLS Supabase — Nameless (ex Iron Oath)

> 📌 **Trois documents liés :**
> - **Ce fichier** = le *quoi* et le *pourquoi* (référence par table).
> - `SUPABASE_RLS_ACTION_PLAN.md` = le *comment* (procédure pas à pas, tests par rôle).
> - `SUPABASE_RLS_SQL_TO_RUN.md` = le SQL prêt (diagnostic lecture seule / modifications avertis).
> Commence par le **plan d'action**, puis exécute la **partie A (diagnostic)** du SQL.

> ⚠️ **La sécurité réelle du site est ICI, pas dans le JavaScript.**
>
> Le site est 100 % statique (GitHub Pages) et parle directement à Supabase
> avec la **clé anon, qui est publique** (n'importe quel visiteur peut la lire
> dans les fichiers JS et appeler l'API directement). `js/crypto-keys.js`
> obfusque cette clé mais **ne la protège pas** : ce n'est PAS une sécurité.
>
> Conséquence : toutes les vérifications côté JS (rôle admin, propriété d'un
> ordre, filtre de messages…) sont **cosmétiques**. Un attaquant ignore le JS
> et tape l'API. La seule barrière est **Row Level Security (RLS)** + des
> contraintes/RPC côté serveur.

## Comment lire ce document
- **[À VÉRIFIER]** : point de contrôle à confirmer dans le dashboard Supabase
  (Table Editor → RLS, ou `SQL Editor`).
- **[EXEMPLE À ADAPTER]** : SQL de départ, à ajuster à votre schéma réel
  (noms de colonnes, rôles) avant application.
- **[NE PAS APPLIQUER AVEUGLÉMENT]** : à tester sur une copie / avec un backup ;
  peut bloquer des fonctionnalités si le schéma diffère.

**Avant toute modification RLS : faites un backup de la base** (Supabase →
Database → Backups, ou `pg_dump`). Activer RLS sans policy = table verrouillée.

---

## 0. Prérequis globaux [À VÉRIFIER]
- [ ] RLS **activé** sur *toutes* les tables listées ci-dessous
      (`ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;`). Une table sans RLS mais
      exposée via l'API est **entièrement lisible/modifiable** avec la clé anon.
- [ ] Le rôle est stocké côté serveur (colonne `user_profiles.role`) et **jamais**
      déduit d'une valeur envoyée par le client.
- [ ] Un helper de rôle admin existe et est utilisé par les policies, ex :
      ```sql
      -- [EXEMPLE À ADAPTER]
      create or replace function public.is_admin()
      returns boolean language sql stable security definer as $$
        select exists(
          select 1 from public.user_profiles
          where id = auth.uid() and role = 'admin'
        );
      $$;
      ```

---

## 1. `user_profiles`
Contient `role`, `username`, `minecraft_uuid`, `email`, `classe`, `niveau`…

- [ ] **[À VÉRIFIER]** Un utilisateur peut lire les profils (nécessaire pour
      afficher pseudos/têtes), mais **ne peut PAS écrire le profil d'autrui**.
- [ ] **[À VÉRIFIER]** Un utilisateur **ne peut PAS modifier son propre `role`**
      (sinon auto-promotion admin = compromission totale).
- [ ] **[À VÉRIFIER]** Seul un admin peut changer un `role` (page admin).
- [ ] **[À VÉRIFIER]** `email` n'est lisible que par le propriétaire et les admins.

```sql
-- [EXEMPLE À ADAPTER] — un user met à jour son profil SAUF role
create policy "self update profile (not role)"
on public.user_profiles for update
using ( id = auth.uid() )
with check ( id = auth.uid() );

-- Empêcher le changement de role par le propriétaire : le plus fiable est un
-- TRIGGER qui rejette toute modification de role hors admin.
-- [NE PAS APPLIQUER AVEUGLÉMENT] — tester d'abord
create or replace function public.prevent_role_change()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role change not allowed';
  end if;
  return new;
end $$;

create trigger trg_prevent_role_change
before update on public.user_profiles
for each row execute function public.prevent_role_change();

-- Admin peut tout mettre à jour
create policy "admin update any profile"
on public.user_profiles for update
using ( public.is_admin() ) with check ( public.is_admin() );
```
> Note : une policy `with check` seule ne suffit pas à figer `role`, car le
> propriétaire a le droit d'UPDATE sa ligne. Le **trigger** ci-dessus est la
> protection robuste contre l'auto-promotion.

---

## 2. `market_orders` (HDV)
Colonnes : `user_id`, `username`, `type`, `item_name`, `item_image`,
`quantity`, `price`, `total_price`, `status`.

- [ ] **[À VÉRIFIER]** INSERT : `user_id` **forcé** à `auth.uid()` (le client ne
      doit pas pouvoir créer un ordre au nom d'un autre).
- [ ] **[À VÉRIFIER]** UPDATE/DELETE : uniquement par le propriétaire
      (`user_id = auth.uid()`) ou un admin. **Un user ne modifie/supprime pas les
      ordres des autres.**
- [ ] **[À VÉRIFIER]** `username`/`creator` ne devraient PAS venir du client
      (spoofables) : idéalement dérivés de `user_id` via trigger/vue, ou au moins
      ignorés à l'affichage au profit du profil réel.
- [ ] **[À VÉRIFIER]** `price`, `quantity`, `total_price` sont de type numérique
      (`int`/`numeric`) et `>= 0` (contrainte `CHECK`). Empêche l'injection de
      chaînes et les prix négatifs.

```sql
-- [EXEMPLE À ADAPTER]
create policy "read active orders" on public.market_orders
for select using ( true );

create policy "insert own order" on public.market_orders
for insert with check ( user_id = auth.uid() );

create policy "update own order" on public.market_orders
for update using ( user_id = auth.uid() or public.is_admin() );

create policy "delete own order" on public.market_orders
for delete using ( user_id = auth.uid() or public.is_admin() );

-- [NE PAS APPLIQUER AVEUGLÉMENT] — contraintes de type/valeur
alter table public.market_orders
  add constraint price_positive check (price >= 0),
  add constraint qty_positive   check (quantity >= 0);
```

---

## 3. `purchase_history`
Colonnes : `order_id`, `seller_id`, `seller_name`, `buyer_id`, `buyer_name`,
`item_*`, `quantity`, `price`, `total_price`, `transaction_type`.

- [ ] **[À VÉRIFIER]** SELECT : un user ne voit que les lignes où il est
      `seller_id` **ou** `buyer_id`.
- [ ] **[À VÉRIFIER]** INSERT : au moins une des parties = `auth.uid()`.
- [ ] **[À VÉRIFIER]** Pas d'UPDATE/DELETE client (historique = immuable) sauf admin.

```sql
-- [EXEMPLE À ADAPTER]
create policy "read own history" on public.purchase_history
for select using ( seller_id = auth.uid() or buyer_id = auth.uid() or public.is_admin() );

create policy "insert history as party" on public.purchase_history
for insert with check ( seller_id = auth.uid() or buyer_id = auth.uid() );
```

---

## 4. `messages` (boîte mail HDV)
Colonnes : `sender_id`, `recipient_id`, `subject`, `content`, `read_at`…

- [ ] **[À VÉRIFIER]** SELECT : uniquement si `auth.uid()` est `sender_id`
      **ou** `recipient_id`. **Un user ne lit pas les messages des autres.**
- [ ] **[À VÉRIFIER]** INSERT : `sender_id = auth.uid()` (pas d'usurpation d'expéditeur).
- [ ] **[À VÉRIFIER]** UPDATE (marquer lu) : uniquement le destinataire, et
      limité à la colonne `read_at` si possible.
- [ ] **[À VÉRIFIER]** DELETE : uniquement une des parties.

```sql
-- [EXEMPLE À ADAPTER]
create policy "read own messages" on public.messages
for select using ( sender_id = auth.uid() or recipient_id = auth.uid() );

create policy "send as self" on public.messages
for insert with check ( sender_id = auth.uid() );

create policy "recipient marks read" on public.messages
for update using ( recipient_id = auth.uid() );
```

---

## 5. `guild_chat` (chat général + messages privés)
Colonnes : `user_id`, `content`, `image_url`, `is_private`, `recipient_id`,
`reply_to_message_id`.

- [ ] **[À VÉRIFIER]** SELECT public (`is_private = false`) : réservé aux membres
      /admins (rôle `membre`/`admin`).
- [ ] **[À VÉRIFIER]** SELECT privé (`is_private = true`) : uniquement
      `user_id = auth.uid()` **ou** `recipient_id = auth.uid()`.
- [ ] **[À VÉRIFIER]** INSERT : `user_id = auth.uid()`.
- [ ] **[À VÉRIFIER]** DELETE : auteur **ou** admin (les boutons "supprimer"
      admin doivent être doublés par RLS, pas seulement par le JS).
- [ ] **[À VÉRIFIER]** `image_url` : idéalement restreint aux URLs du bucket
      Storage du projet (le client valide déjà https + whitelist, mais le
      serveur doit rester la référence).

```sql
-- [EXEMPLE À ADAPTER]
create policy "members read public chat" on public.guild_chat
for select using (
  is_private = false and exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role in ('membre','admin')
  )
);

create policy "read own private chat" on public.guild_chat
for select using ( is_private = true and (user_id = auth.uid() or recipient_id = auth.uid()) );

create policy "post as self" on public.guild_chat
for insert with check ( user_id = auth.uid() );

create policy "delete own or admin" on public.guild_chat
for delete using ( user_id = auth.uid() or public.is_admin() );
```

---

## 6. `guild_planning` / 7. `guild_objectives` / 8. `guild_presence`
- [ ] **[À VÉRIFIER]** SELECT : membres/admins.
- [ ] **[À VÉRIFIER]** INSERT/UPDATE/DELETE planning & objectifs : **admin uniquement**
      (le formulaire admin est côté client, mais la table doit imposer `is_admin()`).
- [ ] **[À VÉRIFIER]** `guild_presence` : un user peut marquer **sa propre**
      présence (`user_id = auth.uid()`) ; l'admin peut gérer toutes les lignes.
- [ ] **[À VÉRIFIER]** `progression` (objectifs), `niveau`, `semaine`, `annee` :
      types numériques + `CHECK` de bornes (0-100 pour progression).

```sql
-- [EXEMPLE À ADAPTER]
create policy "members read planning" on public.guild_planning
for select using ( exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role in ('membre','admin')) );

create policy "admin writes planning" on public.guild_planning
for all using ( public.is_admin() ) with check ( public.is_admin() );

create policy "self presence" on public.guild_presence
for insert with check ( user_id = auth.uid() );
create policy "self or admin update presence" on public.guild_presence
for update using ( user_id = auth.uid() or public.is_admin() );
```

---

## 9. `guild_activity_wall`
Colonnes : `titre`, `contenu`, `image_url`, `type`, `author_name`.

- [ ] **[À VÉRIFIER]** SELECT : membres/admins.
- [ ] **[À VÉRIFIER]** INSERT/UPDATE/DELETE : **admin uniquement**.
- [ ] **[À VÉRIFIER]** `author_name` dérivé de l'utilisateur authentifié, pas du
      client.
- [ ] **[Rappel]** Le contenu HTML dangereux est **neutralisé à l'affichage**
      (échappement + `sanitizeUrl` côté client, déjà fait). RLS empêche en plus
      un non-admin d'**écrire** dans cette table. Les deux sont nécessaires :
      RLS ne nettoie pas le HTML, l'échappement ne contrôle pas qui écrit.

```sql
-- [EXEMPLE À ADAPTER]
create policy "members read wall" on public.guild_activity_wall
for select using ( exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role in ('membre','admin')) );

create policy "admin writes wall" on public.guild_activity_wall
for all using ( public.is_admin() ) with check ( public.is_admin() );
```

---

## 10. Actions admin & RPC
- [ ] **[À VÉRIFIER]** La RPC `delete_user_completely(user_id)` (utilisée par le
      dashboard) vérifie `public.is_admin()` **à l'intérieur** de la fonction
      (`security definer`), sinon n'importe qui peut supprimer un compte.
- [ ] **[À VÉRIFIER]** Toute autre RPC sensible fait de même.

```sql
-- [EXEMPLE À ADAPTER] — garde-fou en tête de RPC
create or replace function public.delete_user_completely(user_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  -- ... suppression ...
end $$;
```

---

## 11. Storage (bucket `iron-oath-storage`)
- [ ] **[À VÉRIFIER]** Policies du bucket : upload réservé aux membres/admins ;
      lecture publique acceptable pour les images de chat/activité.
- [ ] **[À VÉRIFIER]** Type/taille de fichier limités (le client limite à 5 Mo
      images, mais à confirmer côté Storage).

---

## Résumé des points critiques (à cocher avant remise en ligne publique)
- [ ] RLS activé partout.
- [ ] Auto-promotion `role` impossible (trigger).
- [ ] `market_orders` / `messages` / `guild_chat` privés : propriété imposée par RLS.
- [ ] Écritures planning/objectifs/activité/rôles : admin imposé par RLS/RPC.
- [ ] `price`/`quantity`/`progression` numériques + CHECK.
- [ ] RPC admin protégées par `is_admin()`.
- [ ] Clé anon considérée comme publique (rotation si elle a fuité avec des
      droits trop larges).
