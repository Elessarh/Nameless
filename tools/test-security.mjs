#!/usr/bin/env node
// Runs against an isolated PostgreSQL-compatible database, never production.
// NODE_PATH can point to a temporary installation of jsdom, typescript and
// @electric-sql/pglite. RLS and concurrent production behavior still need QA.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS ' + name); }

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const ADMIN = '44444444-4444-4444-8444-444444444444';
const PLAYER = '55555555-5555-4555-8555-555555555555';
const LEGACY_PLAYER = '66666666-6666-4666-8666-666666666666';
const privatePath = `chat/${A}/private.png`;
const publicPath = `chat/${A}/public.png`;
const storageOrigin = 'https://sampleproject.supabase.co';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://nameless-sao.fr/', runScripts: 'outside-only' });
const win = dom.window;
win.NamelessPublicConfig = { supabaseUrl: storageOrigin };
win.currentUser = { id: B };
win.eval(read('js/security-utils.js'));
let signatures = 0;
const client = { storage: { from(bucket) { assert.equal(bucket, 'iron-oath-storage'); return {
  async createSignedUrl(object, ttl) { signatures++; assert.equal(ttl, 600); return { data: { signedUrl: `${storageOrigin}/storage/v1/object/sign/iron-oath-storage/${object}?token=short` }, error: null }; },
  async upload(object) { return { data: { path: object }, error: null }; }
}; } } };
await test('media path validates own project, bucket and traversal', () => {
  assert.equal(win.NamelessSecurity.getStorageMediaPath(privatePath), privatePath);
  assert.equal(win.NamelessSecurity.getStorageMediaPath(`${storageOrigin}/storage/v1/object/sign/iron-oath-storage/${privatePath}?token=old`), privatePath);
  assert.equal(win.NamelessSecurity.getStorageMediaPath(`https://other.supabase.co/storage/v1/object/sign/iron-oath-storage/${privatePath}`), '');
  assert.equal(win.NamelessSecurity.getStorageMediaPath(`chat/${A}/../private.png`), '');
  assert.equal(win.NamelessSecurity.sanitizeImageUrl('javascript:alert(1)'), '');
});
await test('legacy bearer URL gets short signature, cache is cleared on logout', async () => {
  const old = `${storageOrigin}/storage/v1/object/sign/iron-oath-storage/${privatePath}?token=old`;
  const fresh = await win.NamelessSecurity.resolveMediaUrl(old, { client });
  assert.match(fresh, /token=short/);
  await win.NamelessSecurity.resolveMediaUrl(privatePath, { client });
  assert.equal(signatures, 1);
  win.NamelessSecurity.clearPrivateMediaCache();
  await win.NamelessSecurity.resolveMediaUrl(privatePath, { client });
  assert.equal(signatures, 2);
  win.currentUser = null;
  assert.equal(await win.NamelessSecurity.resolveMediaUrl(privatePath, { client }), '');
});
await test('uploads validate MIME, size and current account', async () => {
  win.currentUser = { id: B };
  const file = new win.File(['png'], 'picture.png', { type: 'image/png' });
  const object = await win.NamelessSecurity.uploadGuildMedia(file, { client, prefix: 'chat', userId: B });
  assert.match(object, new RegExp(`^chat/${B}/`));
  await assert.rejects(win.NamelessSecurity.uploadGuildMedia(new win.File(['html'], 'picture.png', { type: 'text/html' }), { client, userId: B }));
  await assert.rejects(win.NamelessSecurity.uploadGuildMedia(file, { client, userId: A }));
});
await test('SDK query builders remain intact beyond former throttle and depth', async () => {
  win.eval(read('js/db-guard.js'));
  const builder = { select() { return this; }, eq() { return this; }, order() { return this; }, then(resolve) { resolve({ data: ['ok'], error: null }); } };
  const raw = { from() { return builder; } };
  const guarded = win._initDbGuard(raw);
  for (let i = 0; i < 40; i++) {
    let query = guarded.from('guild_chat').select();
    for (let j = 0; j < 15; j++) query = query.eq('id', A);
    assert.deepEqual((await query).data, ['ok']);
  }
});

const boundary = { exports: {}, Request, Response, Headers, TextDecoder, Uint8Array, Deno: { env: { get: () => undefined } } };
vm.runInNewContext(ts.transpileModule(read('supabase/functions/_shared/request-security.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, boundary);
await test('Edge rejects unknown origins, non-object JSON and oversized bodies', async () => {
  assert.throws(() => boundary.exports.corsForRequest(new Request('https://api.example', { headers: { Origin: 'https://attacker.example' } })), /origin_not_allowed/);
  assert.equal(boundary.exports.corsForRequest(new Request('https://api.example', { headers: { Origin: 'https://nameless-sao.fr' } }))['Access-Control-Allow-Origin'], 'https://nameless-sao.fr');
  await assert.rejects(boundary.exports.readJsonObject(new Request('https://api.example', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' })), /invalid_json_object/);
  await assert.rejects(boundary.exports.readJsonObject(new Request('https://api.example', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'a'.repeat(8192) }) })), /payload_too_large/);
  const secured = boundary.exports.secureResponse(new Response('{}'), {});
  assert.equal(secured.headers.get('Cache-Control'), 'no-store');
});

await test('auth callback returns synchronously and logout purges private caches', async () => {
  const authDom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://nameless-sao.fr/', runScripts: 'outside-only' });
  const authWin = authDom.window;
  await new Promise(resolve => authWin.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  let callback;
  let insideCallback = false;
  let reads = 0;
  let cleared = 0;
  const raw = {
    auth: {
      async getUser() { return { data: { user: null }, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
      onAuthStateChange(handler) { callback = handler; },
      async signOut() { callback('SIGNED_OUT', null); return { error: null }; }
    },
    from() { assert.equal(insideCallback, false); reads++; return { select() { return this; }, eq() { return this; }, async single() { return { data: { id: B, username: 'Bob', role: 'membre' }, error: null }; } }; }
  };
  authWin.supabase = { createClient: () => raw };
  authWin.NamelessPublicConfig = { supabaseUrl: storageOrigin, supabasePublishableKey: 'public-test-key' };
  authWin.cacheManager = { clear() { cleared++; } };
  authWin.NamelessSecurity = { clearPrivateMediaCache() { cleared++; } };
  authWin.eval(read('js/auth-supabase.js'));
  authWin.document.dispatchEvent(new authWin.Event('DOMContentLoaded'));
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(typeof callback, 'function');
  insideCallback = true;
  assert.equal(callback('SIGNED_IN', { user: { id: B } }), undefined);
  assert.equal(reads, 0);
  insideCallback = false;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(reads, 1);
  assert.equal(authWin.currentUser.id, B);
  callback('SIGNED_OUT', null);
  assert.equal(authWin.currentUser, null);
  assert.equal(authWin.userProfile, null);
  assert.ok(cleared >= 2);
  authDom.window.close();
});

await test('chat shows the latest 100 and remounting does not duplicate controls', async () => {
  const chatDom = new JSDOM(read('pages/espace-guilde.html'), { url: 'https://nameless-sao.fr/pages/espace-guilde.html', runScripts: 'outside-only' });
  const chatWin = chatDom.window;
  await new Promise(resolve => chatWin.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  chatWin.currentUser = { id: A };
  const rows = Array.from({ length: 105 }, (_, index) => ({ id: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`, user_id: A, content: 'Message ' + (index + 1), created_at: new Date(1700000000000 + index * 1000).toISOString() }));
  chatWin.supabase = {
    async rpc() { return { data: 'membre', error: null }; },
    from(table) {
      let descending = false, limit = 100;
      return { select() { return this; }, eq() { return this; }, in() { return this; }, order(column, options) { if (column === 'created_at') descending = options.ascending === false; return this; }, limit(value) { limit = value; return this; },
        then(resolve) { resolve({ data: table === 'guild_chat' ? (descending ? [...rows].reverse() : rows).slice(0, limit) : [{ id: A, username: 'Alice' }], error: null }); }
      };
    },
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
    removeChannel() {}
  };
  chatWin.eval(read('js/guild-chat.js'));
  chatWin.initializeChat();
  await new Promise(resolve => setTimeout(resolve, 5));
  const contents = [...chatWin.document.querySelectorAll('.message-content')].map(node => node.textContent);
  assert.equal(contents.length, 100);
  assert.equal(contents[0], 'Message 6');
  assert.equal(contents.at(-1), 'Message 105');
  chatWin.NamelessGuildChat.destroy();
  chatWin.initializeChat();
  chatWin.document.getElementById('chat-toggle-btn').click();
  assert.equal(chatWin.document.getElementById('guild-chat').classList.contains('open'), true);
  chatWin.NamelessGuildChat.destroy();
  await new Promise(resolve => setTimeout(resolve, 5));
  chatDom.window.close();
});

await test('chat and DM uploads share validated paths without global helper collision', async () => {
  const uploadDom = new JSDOM('<main></main>', { url: 'https://nameless-sao.fr/', runScripts: 'outside-only' });
  const w = uploadDom.window;
  const calls = [];
  w.currentUser = { id: A };
  w.supabase = {};
  w.NamelessSecurity = { async uploadGuildMedia(file, options) {
    calls.push({ file, ...options });
    return `chat/${options.userId}/sample.png`;
  } };
  w.eval(read('js/guild-chat.js'));
  w.eval(read('js/guild-dm.js'));
  const file = new w.File(['image'], 'sample.png', { type: 'image/png' });
  assert.equal(await w.uploadChatImage(file), `chat/${A}/sample.png`);
  assert.equal(await w.uploadDmImage(file), `chat/${A}/sample.png`);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.prefix === 'chat' && call.userId === A && call.client === w.supabase));
  assert.ok(!read('js/guild-dm.js').includes('createSignedUrl'), 'DM uploads cannot mint long-lived bearer URLs');
  uploadDom.window.close();
});

await test('admin Edge verifies JWT and role before body/actions and enforces rate limit', async () => {
  let handler;
  let role = 'joueur';
  let permit = true;
  let mutations = 0;
  const fake = {
    auth: { async getUser(token) { return token === 'valid.token.signature' ? { data: { user: { id: ADMIN } }, error: null } : { data: { user: null }, error: { code: 'bad_jwt' } }; } },
    from(table) { return {
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: table === 'user_roles' ? { role } : { id: A, role }, error: null }; },
      insert() { mutations++; return Promise.resolve({ error: null }); },
      update() { mutations++; return this; },
      then(resolve) { resolve({ data: [], error: null }); }
    }; },
    async rpc() { return { data: permit, error: null }; }
  };
  const runtime = { exports: {}, console: { log() {} }, Request, Response, Headers,
    Deno: { env: { get(key) { return key === 'SUPABASE_URL' ? storageOrigin : key === 'SERVICE_ROLE_KEY' ? 'test-server-only' : undefined; } }, serve(callback) { handler = callback; } },
    require(module) { return module === 'npm:@supabase/supabase-js@2' ? { createClient: () => fake } : boundary.exports; }
  };
  vm.runInNewContext(ts.transpileModule(read('supabase/functions/admin-user-actions/index.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, runtime);
  const request = (token, body) => new Request('https://api.example', { method: 'POST', headers: { Origin: 'https://nameless-sao.fr', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await handler(request('expired.token.signature', {}))).status, 401);
  assert.equal((await handler(request('valid.token.signature', { action: 'delete_user', target_user_id: A }))).status, 403);
  assert.equal(mutations, 0);
  role = 'admin';
  assert.equal((await handler(request('valid.token.signature', { action: 'update_role', target_user_id: A, role: 'membre', confirm_self_demote: 'yes' }))).status, 400);
  permit = false;
  const limited = await handler(request('valid.token.signature', { action: 'update_role', target_user_id: A, role: 'membre' }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Cache-Control'), 'no-store');
  assert.equal(limited.headers.get('Access-Control-Allow-Origin'), 'https://nameless-sao.fr');
  assert.equal(mutations, 0);
});

const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, storage to authenticated, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, created_at timestamptz default now());
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  `);
  await db.exec(read('docs/supabase/SAO_NAMELESS_SCHEMA.sql').replace('create extension if not exists pgcrypto;', ''));
  for (const file of ['SAO_NAMELESS_RLS_PATCH_003.sql', 'SAO_NAMELESS_SECURITY_PATCH_002.sql', 'SAO_NAMELESS_MINECRAFT_PUBLIC_LINK_PATCH.sql', 'SAO_NAMELESS_ADMIN_ACTIONS_PATCH.sql']) await db.exec(read('docs/supabase/' + file));
  // A real pre-migration value must survive hardening and unrelated edits.
  await db.query('insert into auth.users(id,email) values($1,$2)', [LEGACY_PLAYER, 'legacy@example.test']);
  await db.query('update public.user_profiles set classe=$1 where id=$2', ['Paladin', LEGACY_PLAYER]);
  await db.exec(read('docs/supabase/SAO_NAMELESS_HARDENING_004.sql'));
  await test('migration is parseable and idempotent', async () => { await db.exec(read('docs/supabase/SAO_NAMELESS_HARDENING_004.sql')); });
  for (const [id, username, role] of [[A,'Alice','membre'], [B,'Bob','membre'], [C,'Charlie','membre'], [ADMIN,'Admin','admin'], [PLAYER,'Player','joueur']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, username + '@example.test']);
    await db.query('update public.user_profiles set role=$1 where id=$2', [role, id]);
  }
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)', ['iron-oath-storage', privatePath, publicPath]);
  const dm = (await db.query('insert into public.guild_chat(user_id,recipient_id,is_private,content,image_url) values($1,$2,true,$3,$4) returning id', [A,B,'private',privatePath])).rows[0].id;
  await db.query('insert into public.guild_chat(user_id,content,image_url) values($1,$2,$3)', [A,'public',publicPath]);
  const pm = (await db.query('insert into public.private_messages(sender_id,recipient_id,content) values($1,$2,$3) returning id', [A,B,'private'])).rows[0].id;
  async function asUser(id, run) {
    await db.exec('begin; set local role authenticated;');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    try { return await run(); } finally { await db.exec('rollback;'); }
  }
  await test('player cannot escalate role; browser admin cannot bypass Edge', async () => {
    for (const id of [PLAYER, ADMIN]) await assert.rejects(asUser(id, () => db.query('update public.user_profiles set role=$1 where id=$2', ['membre', id])), /role_changes_require_admin_edge_function|profile role cannot be changed/);
  });
  await test('server rejects invalid profile classes and levels; permits all five game classes', async () => {
    for (const invalid of ['Paladin', 'mage', null]) {
      await assert.rejects(asUser(PLAYER, () => db.query('update public.user_profiles set classe=$1 where id=$2', [invalid, PLAYER])), /invalid_profile_class/);
    }
    for (const niveau of [0, 101]) {
      await assert.rejects(asUser(PLAYER, () => db.query('update public.user_profiles set niveau=$1 where id=$2', [niveau, PLAYER])), /user_profiles_level_check/);
    }
    for (const classe of ['Shaman', 'Mage', 'Assassin', 'Guerrier', 'Archer']) {
      await asUser(PLAYER, async () => {
        const row = (await db.query('update public.user_profiles set classe=$1,niveau=100 where id=$2 returning classe,niveau', [classe, PLAYER])).rows[0];
        assert.deepEqual(row, { classe, niveau: 100 });
      });
    }
  });
  await test('unchanged legacy class survives migration and unrelated profile edits', async () => {
    await asUser(LEGACY_PLAYER, async () => {
      assert.equal((await db.query('update public.user_profiles set niveau=42 where id=$1 returning classe', [LEGACY_PLAYER])).rows[0].classe, 'Paladin');
      assert.equal((await db.query('update public.user_profiles set classe=classe,niveau=43 where id=$1 returning classe', [LEGACY_PLAYER])).rows[0].classe, 'Paladin');
    });
    await assert.rejects(asUser(LEGACY_PLAYER, () => db.query('update public.user_profiles set classe=$1 where id=$2', ['Chevalier', LEGACY_PLAYER])), /invalid_profile_class/);
  });
  await test('new profile insert validates class on the server', async () => {
    // Leave Auth in place while exercising the authenticated missing-profile path.
    await db.query('delete from public.user_profiles where id=$1', [LEGACY_PLAYER]);
    await assert.rejects(asUser(LEGACY_PLAYER, () => db.query('insert into public.user_profiles(id,username,classe) values($1,$2,$3)', [LEGACY_PLAYER, 'Legacy', 'Paladin'])), /invalid_profile_class/);
    await asUser(LEGACY_PLAYER, async () => {
      const row = (await db.query('insert into public.user_profiles(id,username,classe,niveau) values($1,$2,$3,1) returning classe,niveau', [LEGACY_PLAYER, 'Legacy', 'Mage'])).rows[0];
      assert.deepEqual(row, { classe: 'Mage', niveau: 1 });
    });
    await db.query('delete from auth.users where id=$1', [LEGACY_PLAYER]);
  });
  await test('private guild messages remain hidden from third parties', async () => {
    await asUser(C, async () => assert.equal((await db.query('select id from public.guild_chat where id=$1', [dm])).rows.length, 0));
    await asUser(B, async () => assert.equal((await db.query('select id from public.guild_chat where id=$1', [dm])).rows.length, 1));
  });
  await test('author cannot redirect or publish an existing DM', async () => {
    await assert.rejects(asUser(A, () => db.query('update public.guild_chat set is_private=false,recipient_id=null where id=$1', [dm])), /message_participants_are_immutable/);
  });
  await test('private message recipient can update read_at, never sender or content', async () => {
    await assert.rejects(asUser(B, () => db.query('update public.private_messages set content=$1 where id=$2', ['forged',pm])), /only_read_at_can_be_updated/);
    await asUser(B, async () => assert.equal((await db.query('update public.private_messages set read_at=now() where id=$1 returning id', [pm])).rows.length, 1));
  });
  await test('Storage permits public guild images and DM recipient, excludes third parties', async () => {
    await asUser(C, async () => assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(row => row.name), [publicPath]));
    await asUser(B, async () => assert.equal((await db.query('select name from storage.objects')).rows.length, 2));
    await asUser(PLAYER, async () => assert.equal((await db.query('select name from storage.objects')).rows.length, 0));
  });
  await test('forged references to another author media are refused', async () => {
    await assert.rejects(asUser(C, () => db.query('insert into public.guild_chat(user_id,content,image_url) values($1,$2,$3)', [C,'leak',privatePath])), /message_media_must_be_owned/);
  });
  await test('database enforces send bursts despite spoofed timestamps', async () => {
    await assert.rejects(asUser(C, async () => {
      for (let i = 0; i < 7; i++) await db.query("insert into public.guild_chat(user_id,content,created_at) values($1,$2,'2000-01-01')", [C,'spam']);
    }), /message_rate_limited/);
  });
  await test('deleting messages cannot reset the server send budget', async () => {
    await assert.rejects(asUser(C, async () => {
      for (let i = 0; i < 7; i++) {
        const sent = (await db.query('insert into public.guild_chat(user_id,content) values($1,$2) returning id', [C,'spam'])).rows[0].id;
        await db.query('delete from public.guild_chat where id=$1', [sent]);
      }
    }), /message_rate_limited/);
  });
  await test('deleting uploads cannot reset the server upload budget', async () => {
    await assert.rejects(asUser(C, async () => {
      for (let i = 0; i < 11; i++) {
        const object = `chat/${C}/upload-${i}.png`;
        await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['iron-oath-storage',object]);
        await db.query('delete from storage.objects where name=$1', [object]);
      }
    }), /row-level security/);
  });
  await test('editing an existing guild message cannot evade the send budget', async () => {
    await assert.rejects(asUser(A, async () => {
      for (let i = 0; i < 7; i++) await db.query('update public.guild_chat set content=$1 where user_id=$2 and is_private=false', ['edit ' + i,A]);
    }), /message_rate_limited/);
  });
  await test('last administrator cannot be demoted or deleted through Auth cascade', async () => {
    await assert.rejects(db.query('update public.user_profiles set role=$1 where id=$2', ['joueur',ADMIN]), /cannot_remove_last_admin/);
    await assert.rejects(db.query('delete from auth.users where id=$1', [ADMIN]), /cannot_remove_last_admin/);
    assert.equal((await db.query('select id from auth.users')).rows.length, 5);
  });
  await test('Edge rate counters enforce atomic limit and deny browser RPC', async () => {
    for (let i = 1; i <= 6; i++) assert.equal((await db.query('select public.consume_admin_action_limit($1,$2) permitted', [ADMIN,'delete_user'])).rows[0].permitted, i <= 5);
    await assert.rejects(asUser(ADMIN, () => db.query('select public.consume_admin_action_limit($1,$2)', [ADMIN,'delete_user'])), /permission denied/);
  });
  await db.query('update public.user_profiles set role=$1 where id=$2', ['joueur',B]);
  await test('revoking guild membership denies both messages and media', async () => {
    await asUser(B, async () => {
      assert.equal((await db.query('select id from public.guild_chat where id=$1', [dm])).rows.length, 0);
      assert.equal((await db.query('select name from storage.objects')).rows.length, 0);
    });
  });
} finally { await db.close(); dom.window.close(); }
console.log(`${passed} security checks passed (isolated database; production RLS not exercised).`);
