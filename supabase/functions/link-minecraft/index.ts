import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const MICROSOFT_AUTHORIZE_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const MICROSOFT_OAUTH_SCOPE = 'XboxLive.signin offline_access';
const EXPECTED_MICROSOFT_REDIRECT_URI = 'https://iwrvdntlrjnoqzbwbsfm.supabase.co/functions/v1/link-minecraft';

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
  if (!value) throw new PublicLinkError('missing_env', 500);
  return value;
}

function logSafe(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    event,
    ...details,
  }));
}

function maskId(value: string | null | undefined) {
  if (!value) return 'unknown';
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function sanitizeLogMessage(value: unknown) {
  if (value === null || value === undefined) return '';

  const message = value instanceof Error
    ? value.message
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

  return message
    .replace(/[A-Za-z0-9._~+/=-]{80,}/g, '[redacted]')
    .slice(0, 500);
}

async function responseSafeMessage(response: Response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.clone().json();
      return sanitizeLogMessage(data.error_description || data.error || data.message || data);
    }

    return sanitizeLogMessage(await response.clone().text());
  } catch (_error) {
    return '';
  }
}

function getMicrosoftRedirectUri() {
  const redirectUri = requiredEnv('MICROSOFT_REDIRECT_URI');
  if (redirectUri !== EXPECTED_MICROSOFT_REDIRECT_URI) {
    logSafe('microsoft_config_error', {
      error: 'invalid_redirect_uri_config',
      redirect_uri: redirectUri,
      expected_redirect_uri: EXPECTED_MICROSOFT_REDIRECT_URI,
    });
    throw new PublicLinkError('invalid_redirect_uri_config', 500);
  }

  return redirectUri;
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

function withMinecraftLinkState(returnTo: string, state: string, reason?: string) {
  const url = new URL(returnTo);
  url.searchParams.set('minecraft_link', state);
  if (reason) url.searchParams.set('reason', reason);
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

  if (!supabaseUrl || !serviceRoleKey) throw new PublicLinkError('missing_env', 500);

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

async function postJson(
  url: string,
  body: Record<string, unknown>,
  reason: string,
  failureEvent: string,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    logSafe(failureEvent, {
      status: 'network_error',
      message: sanitizeLogMessage(error),
    });
    throw new PublicLinkError(reason, 502);
  }

  if (!response.ok) {
    logSafe(failureEvent, {
      status: response.status,
      message: await responseSafeMessage(response),
    });
    throw new PublicLinkError(reason, response.status === 404 ? 404 : 502);
  }

  return response.json();
}

async function postForm(url: string, form: URLSearchParams, reason: string, failureEvent: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form,
    });
  } catch (error) {
    logSafe(failureEvent, {
      status: 'network_error',
      message: sanitizeLogMessage(error),
    });
    throw new PublicLinkError(reason, 502);
  }

  if (!response.ok) {
    logSafe(failureEvent, {
      status: response.status,
      message: await responseSafeMessage(response),
    });
    throw new PublicLinkError(reason, 502);
  }

  return response.json();
}

async function getJson(url: string, token: string, reason: string, failureEvent: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (error) {
    logSafe(failureEvent, {
      status: 'network_error',
      message: sanitizeLogMessage(error),
    });
    throw new PublicLinkError(reason, 502);
  }

  if (!response.ok) {
    logSafe(failureEvent, {
      status: response.status,
      message: await responseSafeMessage(response),
    });

    if (response.status === 404) throw new PublicLinkError('minecraft_not_owned', 404);
    if (response.status === 403) throw new PublicLinkError('missing_entitlements', 403);
    throw new PublicLinkError(reason, 502);
  }

  return response.json();
}

async function exchangeMicrosoftCode(code: string) {
  logSafe('microsoft_code_exchange_start');

  const form = new URLSearchParams({
    client_id: requiredEnv('MICROSOFT_CLIENT_ID'),
    client_secret: requiredEnv('MICROSOFT_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: getMicrosoftRedirectUri(),
  });

  const token = await postForm(
    MICROSOFT_TOKEN_ENDPOINT,
    form,
    'microsoft_token_failed',
    'microsoft_code_exchange_failed',
  );

  if (!token.access_token) {
    logSafe('microsoft_code_exchange_failed', {
      status: 200,
      message: 'missing_access_token',
    });
    throw new PublicLinkError('microsoft_token_failed', 502);
  }

  logSafe('microsoft_code_exchange_ok');
  return token.access_token as string;
}

async function authenticateXboxLive(microsoftAccessToken: string) {
  logSafe('xbox_live_auth_start');

  const result = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${microsoftAccessToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }, 'xbox_auth_failed', 'xbox_live_auth_failed');

  if (!result.Token) {
    logSafe('xbox_live_auth_failed', {
      status: 200,
      message: 'missing_xbox_token',
    });
    throw new PublicLinkError('xbox_auth_failed', 502);
  }

  logSafe('xbox_live_auth_ok');
  return result.Token as string;
}

async function authorizeXsts(xboxToken: string) {
  logSafe('xsts_auth_start');

  const result = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xboxToken],
    },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  }, 'xsts_failed', 'xsts_auth_failed');

  const userHash = result.DisplayClaims?.xui?.[0]?.uhs;
  if (!result.Token || !userHash) {
    logSafe('xsts_auth_failed', {
      status: 200,
      message: 'missing_xsts_token_or_user_hash',
    });
    throw new PublicLinkError('xsts_failed', 502);
  }

  logSafe('xsts_auth_ok');
  return {
    token: result.Token as string,
    userHash: userHash as string,
    xuid: result.DisplayClaims?.xui?.[0]?.xid ? String(result.DisplayClaims.xui[0].xid) : null,
  };
}

async function authenticateMinecraft(userHash: string, xstsToken: string) {
  logSafe('minecraft_services_auth_start');

  const result = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
  }, 'minecraft_auth_failed', 'minecraft_services_auth_failed');

  if (!result.access_token) {
    logSafe('minecraft_services_auth_failed', {
      status: 200,
      message: 'missing_minecraft_access_token',
    });
    throw new PublicLinkError('minecraft_auth_failed', 502);
  }

  logSafe('minecraft_services_auth_ok');
  return result.access_token as string;
}

async function fetchMinecraftProfile(minecraftAccessToken: string) {
  logSafe('minecraft_profile_start');

  const profile = await getJson(
    'https://api.minecraftservices.com/minecraft/profile',
    minecraftAccessToken,
    'minecraft_profile',
    'minecraft_profile_failed',
  );

  if (!profile.id || !profile.name) {
    logSafe('minecraft_profile_failed', {
      status: 200,
      message: 'missing_profile_id_or_name',
    });
    throw new PublicLinkError('minecraft_profile_failed', 502);
  }

  logSafe('minecraft_profile_received', {
    uuid: profile.id,
    username: profile.name,
  });

  return profile as {
    id: string;
    name: string;
    skins?: Array<{ url?: string }>;
  };
}

async function updateMinecraftProfile(userId: string, profile: { id: string; name: string }) {
  logSafe('user_profiles_update_start', {
    user_id: maskId(userId),
  });

  const { error } = await adminClient()
    .from('user_profiles')
    .update({
      minecraft_username: profile.name,
      minecraft_uuid: profile.id,
      minecraft_verified: true,
      minecraft_linked_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    logSafe('user_profiles_update_failed', {
      status: error.code || 'supabase_error',
      message: sanitizeLogMessage(error.message || error.details || error),
    });
    throw new PublicLinkError('profile_update_failed', 500);
  }

  logSafe('user_profiles_update_ok');
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

  const redirectUri = getMicrosoftRedirectUri();
  const authorizeUrl = new URL(MICROSOFT_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set('client_id', requiredEnv('MICROSOFT_CLIENT_ID'));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('scope', MICROSOFT_OAUTH_SCOPE);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('prompt', 'select_account');

  logSafe('microsoft_authorize_start', {
    authorize_endpoint: MICROSOFT_AUTHORIZE_ENDPOINT,
    scope: MICROSOFT_OAUTH_SCOPE,
    redirect_uri: redirectUri,
  });

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

function getRedirectReason(error: unknown) {
  if (!(error instanceof PublicLinkError)) return 'minecraft_profile_failed';

  switch (error.code) {
    case 'microsoft_token_failed':
    case 'xbox_auth_failed':
    case 'xsts_failed':
    case 'minecraft_auth_failed':
    case 'minecraft_profile_failed':
    case 'minecraft_not_owned':
    case 'missing_entitlements':
    case 'profile_update_failed':
    case 'missing_env':
    case 'invalid_state':
      return error.code;
    case 'expired_state':
      return 'invalid_state';
    case 'invalid_redirect_uri_config':
      return 'missing_env';
    default:
      return 'minecraft_profile_failed';
  }
}

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const rawState = url.searchParams.get('state');
  const hasCode = url.searchParams.has('code');
  const providerError = url.searchParams.get('error');
  const providerErrorDescription = url.searchParams.get('error_description');
  const providerErrorUri = url.searchParams.get('error_uri');
  let returnTo = `${getSiteOrigin()}/pages/profil.html`;

  logSafe('microsoft_callback_received', {
    has_code: hasCode,
    has_error: !!providerError,
  });

  if (providerError) {
    returnTo = await getReturnToFromState(rawState);
    logSafe('microsoft_callback_error', {
      error: providerError,
      error_description: providerErrorDescription,
      error_uri: providerErrorUri,
    });

    return redirect(withMinecraftLinkState(returnTo, 'error', 'microsoft_oauth_error'));
  }

  try {
    if (!rawState) throw new PublicLinkError('invalid_state');
    const state = await verifySignedState(rawState);
    returnTo = sanitizeReturnTo(state.returnTo);
    logSafe('state_verified', {
      user_id: maskId(state.sub),
    });

    const code = url.searchParams.get('code');
    if (!code) {
      logSafe('microsoft_callback_error', {
        error: 'missing_code',
      });
      throw new PublicLinkError('microsoft_token_failed', 400);
    }

    const microsoftAccessToken = await exchangeMicrosoftCode(code);
    const xboxToken = await authenticateXboxLive(microsoftAccessToken);
    const xsts = await authorizeXsts(xboxToken);
    const minecraftAccessToken = await authenticateMinecraft(xsts.userHash, xsts.token);
    const profile = await fetchMinecraftProfile(minecraftAccessToken);

    await updateMinecraftProfile(state.sub, profile);

    return redirect(withMinecraftLinkState(state.returnTo, 'success'));
  } catch (error) {
    return redirect(withMinecraftLinkState(returnTo, 'error', getRedirectReason(error)));
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
