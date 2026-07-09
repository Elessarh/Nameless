# admin-user-actions Edge Function

Server-side admin actions for the Nameless dashboard. The browser only sends
the admin's Supabase session JWT; all authority lives here.

## Actions

| Action | Input | Effect |
|---|---|---|
| `set_minecraft_verified` | `target_user_id`, `verified` (boolean) | Sets `user_profiles.minecraft_verified`. Refuses `verified=true` when no `minecraft_uuid` is linked. |
| `update_role` | `target_user_id`, `role` (`joueur`\|`membre`\|`admin`), optional `confirm_self_demote` | Updates `user_profiles.role` AND upserts `user_roles`. Refuses removing the last admin; self-demotion requires `confirm_self_demote: true`. |
| `delete_user` | `target_user_id`, optional `confirm_self_delete` | Removes the player's Storage objects, then deletes the Supabase Auth user. Public data is removed by `on delete cascade`. Refuses deleting the last admin; self-deletion requires `confirm_self_delete: true`. |

Every action:

1. reads the JWT from the `Authorization` header;
2. resolves the caller with `auth.getUser(token)`;
3. checks the caller's effective role server-side (`user_roles` first,
   `user_profiles.role` fallback — same rule as `current_user_role()`);
4. refuses with `admin_required` if the caller is not admin;
5. writes an `admin_logs` entry (actor, action, target);
6. logs only safe fields (masked ids, error codes) — never tokens.

## Error codes returned to the browser

`missing_user_session`, `invalid_user_session`, `admin_required`,
`invalid_target_user_id`, `invalid_role`, `invalid_verified_flag`,
`minecraft_not_linked`, `target_not_found`, `self_demote_requires_confirmation`,
`self_delete_requires_confirmation`, `cannot_remove_last_admin`,
`cannot_delete_last_admin`, `auth_delete_blocked_by_storage`,
`update_failed`, `role_sync_failed`, `auth_delete_failed`, `missing_env`.

## Hard delete vs soft delete

`delete_user` is a **hard delete**: the Auth account and all cascading public
rows disappear. `admin_logs` survives as audit (actor/target become null via
`on delete set null`). If a reversible removal is wanted later, add a
`disabled` flag on `user_profiles` instead of calling this action.

## Required secrets (Supabase dashboard or `supabase secrets set`)

```text
SERVICE_ROLE_KEY=   # service role key — Edge Function ONLY, never in the front
```

`SUPABASE_URL` is provided automatically. Never commit real values.

## Deploy

```bash
npx supabase functions deploy admin-user-actions --no-verify-jwt --project-ref iwrvdntlrjnoqzbwbsfm
```

`--no-verify-jwt` only disables the gateway check; the function still verifies
the JWT and the admin role itself on every request.
