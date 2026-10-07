// admin-user-actions — actions d'administration sécurisées.
//
// Le navigateur n'a jamais accès à SERVICE_ROLE_KEY : il appelle cette
// fonction avec le JWT de session Supabase de l'admin. La fonction vérifie
// elle-même le JWT et le rôle admin côté serveur avant toute action, même si
// elle est déployée avec --no-verify-jwt.
//
// Robustesse : aucun code top-level ne peut throw (pas de lecture env, pas de
// client) ; toute requête reçoit un JSON avec CORS, y compris quand une
// variable d'environnement manque.
//
// Actions :
// - update_role { target_user_id, role, confirm_self_demote? }
// - delete_user { target_user_id, confirm_self_delete? }
//
// set_minecraft_verified est retirée : il n'existe pas de vérification
// officielle Microsoft -> Minecraft (403 Invalid app registration). L'action
// renvoie action_disabled (410) pour les anciens clients.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsForRequest, readJsonObject, RequestError, secureResponse } from '../_shared/request-security.ts';

type AdminClient = ReturnType<typeof createClient>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ['joueur', 'membre', 'admin'];
const STORAGE_BUCKET = 'iron-oath-storage';
const STORAGE_PREFIXES = ['chat', 'guild-activities'];
const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SERVICE_ROLE_KEY'];

class ActionError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logSafe(event: string, details: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ event, ...details }));
  } catch (_error) {
    console.log(JSON.stringify({ event }));
  }
}

function maskId(value: string | null | undefined) {
  if (!value) return 'unknown';
  return `${value.slice(0, 8)}...`;
}

// Lecture env sans throw : renvoie la liste des variables manquantes.
function getMissingEnv() {
  const missing: string[] = [];
  for (const name of REQUIRED_ENV_VARS) {
    let value = '';
    try {
      value = Deno.env.get(name) || '';
    } catch (_error) {
      value = '';
    }
    if (!value) missing.push(name);
  }
  return missing;
}

let cachedAdminClient: AdminClient | null = null;

function adminClient(): AdminClient {
  if (cachedAdminClient) return cachedAdminClient;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new ActionError('missing_env', 500);

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedAdminClient;
}

async function getCaller(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  if (authorization.length > 16384 || !/^Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(authorization)) {
    throw new ActionError('missing_user_session', 401);
  }
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ActionError('missing_user_session', 401);

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new ActionError('invalid_user_session', 401);

  return data.user;
}

// Rôle effectif côté serveur : user_roles gagne, user_profiles.role en
// secours — même règle que public.current_user_role().
async function getEffectiveRole(client: AdminClient, userId: string) {
  const { data: roleRow, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (roleError) throw new ActionError('role_lookup_failed', 500);
  if (roleRow && roleRow.role) return String(roleRow.role);

  const { data: profileRow, error: profileError } = await client
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new ActionError('role_lookup_failed', 500);
  return String(profileRow?.role || 'joueur');
}

async function requireAdmin(client: AdminClient, userId: string) {
  const role = await getEffectiveRole(client, userId);
  if (role !== 'admin') {
    logSafe('admin_action_denied', { caller: maskId(userId), role });
    throw new ActionError('admin_required', 403);
  }
}

function requireTargetId(payload: Record<string, unknown>) {
  const targetId = typeof payload.target_user_id === 'string' ? payload.target_user_id : '';
  if (!UUID_PATTERN.test(targetId)) throw new ActionError('invalid_target_user_id');
  return targetId;
}

// Liste des admins effectifs (user_roles prioritaire, user_profiles en
// secours). Empêche de retirer/supprimer le dernier admin.
async function listEffectiveAdmins(client: AdminClient) {
  const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] = await Promise.all([
    client.from('user_roles').select('user_id, role'),
    client.from('user_profiles').select('id, role'),
  ]);

  if (rolesError || profilesError) throw new ActionError('role_lookup_failed', 500);

  const roleMap = new Map<string, string>();
  (roles || []).forEach((row) => roleMap.set(String(row.user_id), String(row.role)));

  const admins: string[] = [];
  (profiles || []).forEach((profile) => {
    const id = String(profile.id);
    const effective = roleMap.has(id) ? roleMap.get(id) : String(profile.role || 'joueur');
    if (effective === 'admin') admins.push(id);
  });

  // Un user_roles admin sans fiche profil compte aussi.
  roleMap.forEach((role, id) => {
    if (role === 'admin' && !admins.includes(id)) admins.push(id);
  });

  return admins;
}

async function writeAdminLog(
  client: AdminClient,
  actorId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown> = {},
  required = false,
) {
  const { error } = await client.from('admin_logs').insert({
    actor_id: actorId,
    action,
    target_table: 'user_profiles',
    target_id: targetId,
    details,
  });

  if (error) {
    // Le log ne doit pas bloquer l'action : trace safe seulement.
    logSafe('admin_log_write_failed', { code: error.code || null });
    if (required) throw new ActionError('admin_audit_unavailable', 503);
  }
}

async function handleUpdateRole(
  client: AdminClient,
  caller: { id: string },
  payload: Record<string, unknown>,
) {
  const targetId = requireTargetId(payload);
  const role = typeof payload.role === 'string' ? payload.role : '';
  if (!VALID_ROLES.includes(role)) throw new ActionError('invalid_role');

  // Auto-rétrogradation : confirmation explicite exigée.
  if (targetId === caller.id && role !== 'admin' && payload.confirm_self_demote !== true) {
    throw new ActionError('self_downgrade_confirmation_required');
  }

  // Jamais retirer le dernier admin.
  if (role !== 'admin') {
    const admins = await listEffectiveAdmins(client);
    if (admins.includes(targetId) && admins.length <= 1) {
      throw new ActionError('cannot_remove_last_admin');
    }
  }

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('id')
    .eq('id', targetId)
    .maybeSingle();

  if (profileError) throw new ActionError('profile_lookup_failed', 500);
  if (!profile) throw new ActionError('target_user_not_found', 404);

  await writeAdminLog(client, caller.id, 'update_role_requested', targetId, { role }, true);

  const { error: updateError } = await client
    .from('user_profiles')
    .update({ role })
    .eq('id', targetId);

  if (updateError) {
    logSafe('role_update_failed', { step: 'user_profiles', code: updateError.code || null });
    if (/cannot_remove_last_admin/.test(updateError.message || '')) throw new ActionError('cannot_remove_last_admin', 409);
    throw new ActionError('role_update_failed', 500);
  }

  const { error: upsertError } = await client
    .from('user_roles')
    .upsert(
      { user_id: targetId, role, assigned_by: caller.id },
      { onConflict: 'user_id' },
    );

  if (upsertError) {
    logSafe('role_update_failed', { step: 'user_roles', code: upsertError.code || null });
    throw new ActionError('role_update_failed', 500);
  }

  await writeAdminLog(client, caller.id, 'update_role', targetId, { role });
  logSafe('role_updated', { target: maskId(targetId), role });

  return json({ success: true, role });
}

async function removeUserStorageObjects(client: AdminClient, targetId: string) {
  for (const prefix of STORAGE_PREFIXES) {
    const folder = `${prefix}/${targetId}`;

    try {
      const { data: objects, error } = await client.storage.from(STORAGE_BUCKET).list(folder, { limit: 1000 });

      if (error) {
        logSafe('storage_list_failed', { folder: prefix });
        continue;
      }

      const paths = (objects || [])
        .filter((object) => object.name)
        .map((object) => `${folder}/${object.name}`);

      if (paths.length > 0) {
        const { error: removeError } = await client.storage.from(STORAGE_BUCKET).remove(paths);
        if (removeError) {
          logSafe('storage_remove_failed', { folder: prefix });
        }
      }
    } catch (_error) {
      logSafe('storage_cleanup_failed', { folder: prefix });
    }
  }
}

async function handleDeleteUser(
  client: AdminClient,
  caller: { id: string },
  payload: Record<string, unknown>,
) {
  const targetId = requireTargetId(payload);

  // Auto-suppression : confirmation explicite exigée.
  if (targetId === caller.id && payload.confirm_self_delete !== true) {
    throw new ActionError('self_delete_requires_confirmation');
  }

  // Jamais supprimer le dernier admin.
  const admins = await listEffectiveAdmins(client);
  if (admins.includes(targetId) && admins.length <= 1) {
    throw new ActionError('cannot_delete_last_admin');
  }

  // Journaliser avant la suppression (l'acteur reste, la cible disparaît).
  await writeAdminLog(client, caller.id, 'delete_user_requested', targetId, { hard_delete: true }, true);

  // La suppression auth.users cascade sur user_profiles (FK on delete
  // cascade), qui cascade sur user_roles, guild_chat, guild_presence,
  // messages, private_messages, market_orders. admin_logs garde l'audit
  // (actor_id/target passent à null via on delete set null).
  const { error } = await client.auth.admin.deleteUser(targetId);

  if (error) {
    const message = String(error.message || '');
    logSafe('auth_delete_failed', { target: maskId(targetId), code: error.code || null });

    if (/cannot_remove_last_admin/.test(message)) throw new ActionError('cannot_delete_last_admin', 409);

    if (/storage|object|foreign key/i.test(message)) {
      throw new ActionError('auth_delete_blocked_by_storage', 409);
    }
    if (/not.*found/i.test(message)) {
      throw new ActionError('target_user_not_found', 404);
    }
    throw new ActionError('auth_delete_failed', 500);
  }

  // Only clean up after Auth confirms deletion. A concurrent last-admin
  // guard or other Auth failure must never destroy the player's images.
  // If Auth refuses Storage ownership, leave all data intact and report 409.
  await removeUserStorageObjects(client, targetId);

  logSafe('user_deleted', { target: maskId(targetId) });
  return json({ success: true, deleted: true });
}

async function handleRequest(req: Request) {
  logSafe('admin_user_actions_request_start', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'not_found' }, 404);
  }

  // Env d'abord : réponse claire plutôt qu'un crash générique.
  const missingEnv = getMissingEnv();
  if (missingEnv.length > 0) {
    logSafe('admin_user_actions_missing_env', { missing: missingEnv.join(',') });
    return json({ error: 'missing_env', missing: missingEnv.join(',') }, 500);
  }

  const caller = await getCaller(req);
  const client = adminClient();
  await requireAdmin(client, caller.id);
  const payload = await readJsonObject(req);
  const action = typeof payload.action === 'string' ? payload.action : '';
  if (!['update_role', 'delete_user', 'set_minecraft_verified'].includes(action)) throw new ActionError('unknown_action');
  const allowedKeys = ['action', 'target_user_id', 'role', 'confirm_self_demote', 'confirm_self_delete'];
  if (Object.keys(payload).some(key => !allowedKeys.includes(key))) throw new ActionError('unexpected_field');
  for (const key of ['confirm_self_demote', 'confirm_self_delete']) {
    if (payload[key] !== undefined && typeof payload[key] !== 'boolean') throw new ActionError('invalid_confirmation');
  }
  if (action !== 'set_minecraft_verified') {
    const { data: permitted, error: rateError } = await client.rpc('consume_admin_action_limit', { subject_id: caller.id, action_name: action });
    if (rateError) throw new ActionError('security_patch_required', 503);
    if (permitted !== true) throw new ActionError('admin_action_rate_limited', 429);
  }

  logSafe('admin_action_authorized', { action, caller: maskId(caller.id) });

  switch (action) {
    case 'update_role':
      return await handleUpdateRole(client, caller, payload);
    case 'delete_user':
      return await handleDeleteUser(client, caller, payload);
    case 'set_minecraft_verified':
      // Retirée : plus de vérification Minecraft. Réponse propre, pas de 500.
      return json({ error: 'action_disabled' }, 410);
    default:
      return json({ error: 'unknown_action' }, 400);
  }
}

Deno.serve(async (req) => {
  // Try/catch global : la fonction répond TOUJOURS un JSON avec CORS,
  // jamais un crash silencieux.
  let cors: Record<string, string> = { Vary: 'Origin' };
  try {
    cors = corsForRequest(req);
    return secureResponse(await handleRequest(req), cors);
  } catch (error) {
    if (error instanceof ActionError || error instanceof RequestError) {
      return secureResponse(json({ error: error.code }, error.status), cors);
    }

    logSafe('admin_action_unexpected_error', {
      code: 'unexpected_error',
    });
    return secureResponse(json({ error: 'internal_error' }, 500), cors);
  }
});
