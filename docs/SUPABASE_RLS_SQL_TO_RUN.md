# SQL RLS à exécuter — diagnostic vs modification

À utiliser dans **Supabase → SQL Editor**, **une requête à la fois**.

Ce fichier est en **deux parties nettement séparées** :
- **PARTIE A — DIAGNOSTIC** : 100 % **lecture seule**. Aucun risque. Commence ici.
- **PARTIE B — MODIFICATION** : change la base. **Chaque bloc est précédé d'un
  avertissement ⚠️.** Fais un **backup** d'abord (voir ACTION_PLAN).

> Rappel : le SQL Editor tourne en `postgres` et **contourne RLS**. Pour
> *tester* RLS, il faut simuler un utilisateur (voir §A6). Les policies
> ci-dessous supposent des colonnes standard ; **adapte les noms** à ton schéma
> réel (vérifié en §A5).

---

# PARTIE A — DIAGNOSTIC (lecture seule, sans risque)

## A1. RLS est-il activé sur chaque table ?
```sql
select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_active
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'user_profiles','market_orders','purchase_history','messages',
    'guild_chat','guild_planning','guild_objectives','guild_presence',
    'guild_activity_wall'
  )
order by c.relname;
```
👉 Toute table avec `rls_active = false` est **entièrement exposée** à la clé
anon. Objectif : `true` partout.

## A2. Lister toutes les policies existantes
```sql
select schemaname, tablename, policyname, cmd, roles, permissive,
       qual        as using_expr,
       with_check  as check_expr
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
```
👉 Note, par table : quelles commandes (`SELECT/INSERT/UPDATE/DELETE/ALL`) sont
couvertes, et ce que disent `using_expr` / `check_expr`. Une table avec RLS
activé mais **aucune** policy = inaccessible (site cassé).

## A3. Triggers sur `user_profiles` (anti-auto-promotion ?)
```sql
select tgname as trigger, proname as function, tgenabled as enabled
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'user_profiles'
  and not t.tgisinternal;
```
👉 Cherche un trigger type `prevent_role_change`. Absent = auto-promotion
possible tant que la policy UPDATE laisse le propriétaire écrire sa ligne.

## A4. Fonctions liées aux rôles / admin
```sql
select p.proname as function, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname ilike '%admin%' or p.proname ilike '%role%'
       or p.proname ilike '%delete_user%');
```
👉 Vérifie l'existence de `is_admin()` et `delete_user_completely(...)`, et que
`security_definer = true` pour les RPC sensibles.

## A5. Types des colonnes sensibles
```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'user_profiles'   and column_name in ('role','id')) or
    (table_name = 'market_orders'   and column_name in ('user_id','price','quantity','total_price','status')) or
    (table_name = 'messages'        and column_name in ('sender_id','recipient_id','read_at')) or
    (table_name = 'guild_chat'      and column_name in ('user_id','recipient_id','is_private')) or
    (table_name = 'guild_objectives'and column_name in ('progression','semaine_numero','annee')) or
    (table_name = 'purchase_history'and column_name in ('seller_id','buyer_id'))
  )
order by table_name, column_name;
```
👉 `price`/`quantity`/`total_price`/`progression` doivent être numériques
(`integer`/`numeric`), pas `text`. Sinon → risque d'injection + valeurs absurdes.

## A6. Simuler un utilisateur pour TESTER RLS (lecture seule)
Le SQL Editor ignore RLS par défaut. Pour tester comme un vrai utilisateur :
```sql
-- Récupère d'abord un id de joueur normal (non admin) :
select id, username, role from public.user_profiles
where role is distinct from 'admin' limit 5;
```
Puis, dans une **transaction annulée** (aucune écriture persistée) :
```sql
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"COLLE-ICI-UUID-JOUEUR","role":"authenticated"}';
  select auth.uid();                                   -- doit renvoyer l'uuid
  -- Exemple: ce joueur voit-il les DM des autres ? (doit être vide/limité)
  select count(*) from public.guild_chat where is_private = true;
rollback;
```
👉 `rollback` garantit que **rien** n'est modifié même si tu testes des écritures.
Refais-le avec `set local role anon;` (sans jwt.claims) pour tester le **non
connecté**.

---

# PARTIE B — MODIFICATION (change la base)

> ⚠️ **STOP.** Avant CETTE partie :
> 1. **Backup** fait (Database → Backups).
> 2. Tu as lu le résultat de la PARTIE A et **adapté les noms de colonnes**.
> 3. Tu exécutes **un bloc à la fois**, puis tu **testes** (§A6 + UI).
>
> Rappel piège : activer RLS **sans** policy SELECT rend la table vide pour tous.
> Chaque bloc « activer RLS » ci-dessous est **accompagné** de sa policy SELECT.

## B1 — Fonction `is_admin()` (base commune)
> ⚠️ Crée/remplace une fonction. Sans danger seule, mais requise par la suite.
```sql
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
```

## B2 — `user_profiles` : figer le rôle (LE point critique)
> ⚠️ Ce bloc active RLS + pose policies + **trigger anti-auto-promotion**.
> Teste immédiatement après (§A6 : le joueur ne doit PAS pouvoir se promouvoir).
```sql
-- 1) Activer RLS + lecture (les pseudos/têtes doivent rester visibles)
alter table public.user_profiles enable row level security;

create policy "profiles readable"
on public.user_profiles for select using ( true );

-- 2) Le propriétaire met à jour SON profil…
create policy "update own profile"
on public.user_profiles for update
using ( id = auth.uid() ) with check ( id = auth.uid() );

-- 3) …mais un trigger INTERDIT de changer `role` sauf admin
create or replace function public.prevent_role_change()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role change not allowed';
  end if;
  return new;
end $$;

drop trigger if exists trg_prevent_role_change on public.user_profiles;
create trigger trg_prevent_role_change
before update on public.user_profiles
for each row execute function public.prevent_role_change();

-- 4) Admin peut tout mettre à jour
create policy "admin update any profile"
on public.user_profiles for update
using ( public.is_admin() ) with check ( public.is_admin() );
```
> **Test obligatoire** (doit ÉCHOUER) :
> ```sql
> begin;
>   set local role authenticated;
>   set local request.jwt.claims to '{"sub":"UUID-JOUEUR","role":"authenticated"}';
>   update public.user_profiles set role='admin' where id = auth.uid();
> rollback;
> ```
> → attendu : `ERROR: role change not allowed`.

## B3 — `messages` (boîte mail privée)
> ⚠️ Active RLS + cloisonne lecture/écriture.
```sql
alter table public.messages enable row level security;

create policy "read own messages" on public.messages
for select using ( sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin() );

create policy "send as self" on public.messages
for insert with check ( sender_id = auth.uid() );

create policy "recipient updates own" on public.messages
for update using ( recipient_id = auth.uid() );

create policy "party deletes own" on public.messages
for delete using ( sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin() );
```

## B4 — `guild_chat` (chat public + DM)
> ⚠️ Active RLS. Adapte le rôle requis (`membre`/`admin`) à ta logique.
```sql
alter table public.guild_chat enable row level security;

-- Chat public : réservé aux membres/admins
create policy "members read public chat" on public.guild_chat
for select using (
  is_private = false and exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role in ('membre','admin')
  )
);

-- DM : uniquement les 2 parties
create policy "read own private chat" on public.guild_chat
for select using (
  is_private = true and ( user_id = auth.uid() or recipient_id = auth.uid() )
);

create policy "post chat as self" on public.guild_chat
for insert with check ( user_id = auth.uid() );

create policy "delete own chat or admin" on public.guild_chat
for delete using ( user_id = auth.uid() or public.is_admin() );
```

## B5 — `market_orders` (HDV) + contraintes
> ⚠️ Active RLS + policies. Le bloc CHECK est séparé (voir note).
```sql
alter table public.market_orders enable row level security;

create policy "read active orders" on public.market_orders
for select using ( true );          -- marché public assumé

create policy "insert own order" on public.market_orders
for insert with check ( user_id = auth.uid() );

create policy "update own order or admin" on public.market_orders
for update using ( user_id = auth.uid() or public.is_admin() );

create policy "delete own order or admin" on public.market_orders
for delete using ( user_id = auth.uid() or public.is_admin() );
```
> ⚠️ **Contraintes de valeur** — n'exécute que si les colonnes sont déjà
> numériques (vérifié en §A5) ET si aucune ligne existante ne viole la règle
> (sinon l'ALTER échoue). Vérifie d'abord :
> ```sql
> select count(*) from public.market_orders where price < 0 or quantity < 0;
> ```
> Si `0`, alors :
```sql
alter table public.market_orders
  add constraint price_positive check (price >= 0),
  add constraint qty_positive   check (quantity >= 0);
```

## B6 — `purchase_history` (historique immuable)
> ⚠️ Active RLS. Pas d'UPDATE/DELETE client (seulement admin si besoin).
```sql
alter table public.purchase_history enable row level security;

create policy "read own history" on public.purchase_history
for select using ( seller_id = auth.uid() or buyer_id = auth.uid() or public.is_admin() );

create policy "insert history as party" on public.purchase_history
for insert with check ( seller_id = auth.uid() or buyer_id = auth.uid() );
```

## B7 — `guild_activity_wall` (écriture admin only)
> ⚠️ Active RLS. Lecture membres/admins, écriture admin.
```sql
alter table public.guild_activity_wall enable row level security;

create policy "members read wall" on public.guild_activity_wall
for select using (
  exists (select 1 from public.user_profiles p
          where p.id = auth.uid() and p.role in ('membre','admin'))
);

create policy "admin writes wall" on public.guild_activity_wall
for all using ( public.is_admin() ) with check ( public.is_admin() );
```

## B8 — `guild_planning` / `guild_objectives` / `guild_presence`
> ⚠️ Active RLS sur les 3. Planning/objectifs = admin ; présence = self+admin.
```sql
-- PLANNING
alter table public.guild_planning enable row level security;
create policy "members read planning" on public.guild_planning
for select using (
  exists (select 1 from public.user_profiles p
          where p.id = auth.uid() and p.role in ('membre','admin')) );
create policy "admin writes planning" on public.guild_planning
for all using ( public.is_admin() ) with check ( public.is_admin() );

-- OBJECTIFS
alter table public.guild_objectives enable row level security;
create policy "members read objectives" on public.guild_objectives
for select using (
  exists (select 1 from public.user_profiles p
          where p.id = auth.uid() and p.role in ('membre','admin')) );
create policy "admin writes objectives" on public.guild_objectives
for all using ( public.is_admin() ) with check ( public.is_admin() );

-- PRÉSENCE (chacun la sienne ; admin gère tout)
alter table public.guild_presence enable row level security;
create policy "members read presence" on public.guild_presence
for select using (
  exists (select 1 from public.user_profiles p
          where p.id = auth.uid() and p.role in ('membre','admin')) );
create policy "insert own presence" on public.guild_presence
for insert with check ( user_id = auth.uid() );
create policy "update own presence or admin" on public.guild_presence
for update using ( user_id = auth.uid() or public.is_admin() );
create policy "delete own presence or admin" on public.guild_presence
for delete using ( user_id = auth.uid() or public.is_admin() );
```
> ⚠️ **Contrainte progression** — seulement si `progression` est numérique et
> qu'aucune ligne ne viole `0..100` (`select count(*) from public.guild_objectives
> where progression < 0 or progression > 100;` doit valoir 0) :
```sql
alter table public.guild_objectives
  add constraint progression_range check (progression between 0 and 100);
```

## B9 — RPC `delete_user_completely` (garde admin)
> ⚠️ Remplace la fonction. **Garde la logique de suppression existante** entre
> les commentaires — ne la perds pas. N'ajoute QUE le garde-fou en tête.
```sql
create or replace function public.delete_user_completely(user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;

  -- >>> CONSERVE ICI TA LOGIQUE DE SUPPRESSION EXISTANTE <<<
  -- (delete from ... where id = user_id; etc.)
end $$;
```

---

# Rollback (si un bloc casse une fonctionnalité)
> ⚠️ Supprime une policy nommée (ne supprime PAS la table).
```sql
-- Retirer une policy précise :
drop policy "insert own order" on public.market_orders;

-- Voir les noms exacts à retirer :
select tablename, policyname from pg_policies where schemaname='public' order by tablename;

-- En dernier recours, revenir à l'état "ouvert" d'une table (⚠️ redevient exposée) :
-- alter table public.<table> disable row level security;
```
> Si tu as un backup, la restauration reste la voie la plus sûre en cas de doute.

---

# Ordre d'exécution résumé
1. **A1→A5** (diagnostic) — noter l'état.
2. **A6** — savoir tester comme un utilisateur.
3. **Backup.**
4. **B1** (`is_admin`) → **B2** (`user_profiles` + trigger) → **tester** l'échec
   de l'auto-promotion.
5. **B3 → B8** table par table, **tester après chacune**.
6. **B9** (RPC).
7. Storage (via l'UI, voir ACTION_PLAN / CHECKLIST).
8. Rejouer les 3 profils de tests + tests XSS via API.
