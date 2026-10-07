// Small shared boundary for JSON Edge endpoints. No secrets are logged.
export class RequestError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export function corsForRequest(req: Request) {
  const origin = req.headers.get('Origin');
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || 'https://nameless-sao.fr,https://www.nameless-sao.fr')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (origin && !configured.includes(origin)) throw new RequestError('origin_not_allowed', 403);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export async function readJsonObject(req: Request, maxBytes = 8192): Promise<Record<string, unknown>> {
  if (!(req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    throw new RequestError('json_content_type_required', 415);
  }
  if (Number(req.headers.get('Content-Length')) > maxBytes) throw new RequestError('payload_too_large', 413);
  if (!req.body) throw new RequestError('invalid_json');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RequestError('payload_too_large', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (_error) { throw new RequestError('invalid_json'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new RequestError('invalid_json_object');
  return payload as Record<string, unknown>;
}

export function secureResponse(response: Response, cors: Record<string, string>) {
  const headers = new Headers(response.headers);
  headers.delete('Access-Control-Allow-Origin');
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(response.body, { status: response.status, headers });
}
