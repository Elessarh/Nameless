import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

class PublicLinkError extends Error {
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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: url,
    },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new PublicLinkError('missing_function_config', 500);
  return value;
}

function getSiteOrigin() {
  const configured = Deno.env.get('SITE_ORIGIN') || Deno.env.get('PUBLIC_SITE_URL') || 'https://nameless-sao.fr';
  return new URL(configured).origin;
}

function sanitizeReturnTo(rawReturnTo: unknown) {
  const fallback = `${getSiteOrigin()}/pages/profil.html`;
  if (typeof rawReturnTo !== 'string' || !rawReturnTo) return fallback;

  try {
    const returnTo = new URL(rawReturnTo);
    if (returnTo.origin !== getSiteOrigin()) return fallback;
    returnTo.hash = '';
    return returnTo.toString();
  } catch (_error) {
    return fallback;
  }
}

function withMinecraftLinkState(returnTo: string, state: string) {
  const url = new URL(returnTo);
  url.searchParams.set('minecraft_link', state);
  return url.toString();
}

function base64UrlEncode(input: Uint8Array) {
  let binary = '';
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}

async function createSignedState(payload: Record<string, unknown>) {
  const secret = requiredEnv('MINECRAFT_LINK_STATE_SECRET');
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySignedState(state: string) {
  const secret = requiredEnv('MINECRAFT_LINK_STATE_SECRET');
  const parts = state.split('.');
  if (parts.length !== 2) throw new PublicLinkError('invalid_state');

  const expectedSignature = await hmacSha256(parts[0], secret);
  if (!timingSafeEqual(parts[1], expectedSignature)) throw new PublicLinkError('invalid_state');

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as {
    sub: string;
    returnTo: string;
    exp: number;
  };

  if (!payload.sub || !payload.returnTo || !payload.exp || Date.now() > payload.exp) {
    throw new PublicLinkError('expired_state');
  }

  return payload;
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) throw new PublicLinkError('missing_function_config', 500);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new PublicLinkError('missing_user_session', 401);

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new PublicLinkError('invalid_user_session', 401);

  return data.user;
}

async function postJson(url: string, body: Record<string, unknown>, label: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new PublicLinkError(`${label}_failed`, response.status === 404 ? 404 : 502);
  return response.json();
}

async function postForm(url: string, form: URLSearchParams, label: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form,
  });

  if (!response.ok) throw new PublicLinkError(`${label}_failed`, 502);
  return response.json();
}

async function getJson(url: string, token: string, label: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (response.status === 404) throw new PublicLinkError('not_found', 404);
  if (!response.ok) throw new PublicLinkError(`${label}_failed`, 502);
  return response.json();
}

async function exchangeMicrosoftCode(code: string) {
  const tenant = Deno.env.get('MICROSOFT_TENANT') || 'consumers';
  const form = new URLSearchParams({
    client_id: requiredEnv('MICROSOFT_CLIENT_ID'),
    client_secret: requiredEnv('MICROSOFT_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: requiredEnv('MICROSOFT_REDIRECT_URI'),
  });

  const token = await postForm(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, form, 'microsoft_token');
  if (!token.access_token) throw new PublicLinkError('microsoft_token_failed', 502);
  return token.access_token as string;
}

async function authenticateXboxLive(microsoftAccessToken: string) {
  const result = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${microsoftAccessToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }, 'xbox_live');

  if (!result.Token) throw new PublicLinkError('xbox_live_failed', 502);
  return result.Token as string;
}

async function authorizeXsts(xboxToken: string) {
  const result = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xboxToken],
    },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  }, 'xsts');

  const userHash = result.DisplayClaims?.xui?.[0]?.uhs;
  if (!result.Token || !userHash) throw new PublicLinkError('xsts_failed', 502);

  return {
    token: result.Token as string,
    userHash: userHash as string,
    xuid: result.DisplayClaims?.xui?.[0]?.xid ? String(result.DisplayClaims.xui[0].xid) : null,
  };
}

async function authenticateMinecraft(userHash: string, xstsToken: string) {
  const result = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
  }, 'minecraft_auth');

  if (!result.access_token) throw new PublicLinkError('minecraft_auth_failed', 502);
  return result.access_token as string;
}

async function fetchMinecraftProfile(minecraftAccessToken: string) {
  const profile = await getJson(
    'https://api.minecraftservices.com/minecraft/profile',
    minecraftAccessToken,
    'minecraft_profile',
  );

  if (!profile.id || !profile.name) throw new PublicLinkError('not_found', 404);
  return profile as {
    id: string;
    name: string;
    skins?: Array<{ url?: string }>;
  };
}

function normalizeHttpsUrl(rawUrl: unknown) {
  if (typeof rawUrl !== 'string' || !rawUrl) return null;
  if (rawUrl.startsWith('https://')) return rawUrl;
  if (rawUrl.startsWith('http://textures.minecraft.net/')) return rawUrl.replace('http://', 'https://');
  return null;
}

async function updateMinecraftProfile(userId: string, profile: { id: string; name: string; skins?: Array<{ url?: string }> }, xuid: string | null) {
  const skinUrl = normalizeHttpsUrl(profile.skins?.[0]?.url);
  const { error } = await adminClient()
    .from('user_profiles')
    .update({
      username: profile.name,
      minecraft_username: profile.name,
      minecraft_uuid: profile.id,
      minecraft_verified: true,
      minecraft_avatar_url: `https://mc-heads.net/avatar/${profile.id}/128`,
      minecraft_skin_url: skinUrl,
      minecraft_linked_at: new Date().toISOString(),
      microsoft_provider_id: xuid,
    })
    .eq('id', userId);

  if (error) throw new PublicLinkError('profile_update_failed', 500);
}

async function handleStart(req: Request) {
  const body = await req.json().catch(() => ({})) as { returnTo?: string };
  const user = await getAuthenticatedUser(req);
  const returnTo = sanitizeReturnTo(body.returnTo);
  const state = await createSignedState({
    sub: user.id,
    returnTo,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomUUID(),
  });

  const tenant = Deno.env.get('MICROSOFT_TENANT') || 'consumers';
  const scopes = Deno.env.get('MICROSOFT_OAUTH_SCOPES') || 'XboxLive.signin offline_access';
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set('client_id', requiredEnv('MICROSOFT_CLIENT_ID'));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('redirect_uri', requiredEnv('MICROSOFT_REDIRECT_URI'));
  authorizeUrl.searchParams.set('scope', scopes);
  authorizeUrl.searchParams.set('state', state);

  return json({ url: authorizeUrl.toString() });
}

async function getReturnToFromState(rawState: string | null) {
  if (!rawState) return `${getSiteOrigin()}/pages/profil.html`;

  try {
    const payload = await verifySignedState(rawState);
    return sanitizeReturnTo(payload.returnTo);
  } catch (_error) {
    return `${getSiteOrigin()}/pages/profil.html`;
  }
}

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const rawState = url.searchParams.get('state');
  const providerError = url.searchParams.get('error');
  const returnTo = await getReturnToFromState(rawState);

  if (providerError) {
    return redirect(withMinecraftLinkState(returnTo, providerError === 'access_denied' ? 'denied' : 'error'));
  }

  try {
    if (!rawState) throw new PublicLinkError('invalid_state');
    const state = await verifySignedState(rawState);
    const code = url.searchParams.get('code');
    if (!code) throw new PublicLinkError('missing_code');

    const microsoftAccessToken = await exchangeMicrosoftCode(code);
    const xboxToken = await authenticateXboxLive(microsoftAccessToken);
    const xsts = await authorizeXsts(xboxToken);
    const minecraftAccessToken = await authenticateMinecraft(xsts.userHash, xsts.token);
    const profile = await fetchMinecraftProfile(minecraftAccessToken);

    await updateMinecraftProfile(state.sub, profile, xsts.xuid);

    return redirect(withMinecraftLinkState(state.returnTo, 'success'));
  } catch (error) {
    const publicError = error instanceof PublicLinkError ? error : new PublicLinkError('error', 500);
    const linkState = publicError.code === 'not_found' ? 'not_found' : 'error';
    return redirect(withMinecraftLinkState(returnTo, linkState));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && (url.searchParams.has('code') || url.searchParams.has('error'))) {
      return await handleCallback(req);
    }

    if (req.method === 'POST') {
      const body = await req.clone().json().catch(() => ({})) as { action?: string };
      if (body.action === 'start') return await handleStart(req);
    }

    return json({ error: 'not_found' }, 404);
  } catch (error) {
    const publicError = error instanceof PublicLinkError ? error : new PublicLinkError('error', 500);
    return json({ error: publicError.code }, publicError.status);
  }
});
