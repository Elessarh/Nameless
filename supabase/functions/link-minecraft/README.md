# link-minecraft Edge Function

This function performs the real Minecraft linking flow server-side.

Current status: the function is kept for diagnostics and a future official verification flow, but it is not launched automatically from the profile page anymore.

Minecraft Services currently rejects the Microsoft app registration with:

```text
403 Forbidden
Invalid app registration
```

That means Nameless cannot honestly claim a Microsoft -> Minecraft verified ownership check yet. The profile page now uses public Minecraft identity detection instead: the player enters a Minecraft username, the browser resolves public UUID/name data through PlayerDB, and `minecraft_verified` remains `false` until an admin validates it.

Apply `docs/supabase/SAO_NAMELESS_MINECRAFT_PUBLIC_LINK_PATCH.sql` so authenticated players may save only public detected fields while admins/backend remain the only actors allowed to set `minecraft_verified = true`.

## Frontend behavior

When a connected profile has no `minecraft_username`/`minecraft_uuid`, `pages/profil.html` shows a public Minecraft username form.

The profile page no longer calls this function automatically:

```js
supabase.functions.invoke('link-minecraft', {
  body: {
    action: 'start',
    returnTo: window.location.origin + '/pages/profil.html?minecraft_link=return'
  }
})
```

Keep that flow disabled unless the Microsoft app registration becomes accepted by Minecraft Services.

## Flow

1. A trusted caller invokes `link-minecraft` with `action: "start"`.
2. The function validates the Supabase user session from the `Authorization` header.
3. The function creates a signed, short-lived OAuth `state`.
4. The function returns a Microsoft OAuth URL to the browser.
5. Microsoft redirects back to `MICROSOFT_REDIRECT_URI`.
6. The function exchanges the code server-side.
7. The function authenticates through Xbox Live, XSTS, then Minecraft Services.
8. Minecraft Services currently rejects the app registration before a verified profile can be fetched.
9. If this becomes available later, the function updates `public.user_profiles` with verified Minecraft fields.
10. The function redirects back to `/pages/profil.html?minecraft_link=success`.

## Required Supabase function secrets

Set these with `supabase secrets set` or in the Supabase dashboard.

Never commit real values.

```text
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://iwrvdntlrjnoqzbwbsfm.supabase.co/functions/v1/link-minecraft
MINECRAFT_LINK_STATE_SECRET=
SERVICE_ROLE_KEY=
SITE_ORIGIN=https://nameless-sao.fr
```

Do not set `SUPABASE_URL` with `supabase secrets set`; Supabase provides it automatically to Edge Functions.

`SERVICE_ROLE_KEY` must contain the Supabase service role key and is allowed only inside this deployed function. It must never appear in HTML, CSS, browser JavaScript, GitHub Pages settings, or public config files.

## Microsoft OAuth parameters

The function intentionally uses the personal Microsoft account endpoint for Minecraft linking:

```text
authorize_endpoint=https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize
token_endpoint=https://login.microsoftonline.com/consumers/oauth2/v2.0/token
scope=XboxLive.signin offline_access
prompt=select_account
response_type=code
response_mode=query
```

## Required Microsoft redirect URI

Add this redirect URI in the Microsoft app registration used for Minecraft linking:

```text
https://iwrvdntlrjnoqzbwbsfm.supabase.co/functions/v1/link-minecraft
```

This is separate from the Supabase Auth Azure callback used for site login.

The Microsoft app registration must allow personal Microsoft accounts. In Microsoft Entra, use an account type equivalent to:

```text
Accounts in any organizational directory and personal Microsoft accounts
```

## Deploy

```bash
supabase functions deploy link-minecraft
```

Then push the frontend changes to GitHub Pages.

## Security rules

- Do not store Xbox, XSTS, or Minecraft tokens in `localStorage`.
- Do not return provider tokens to the browser.
- Do not treat a manually entered Minecraft username as verified ownership.
- Do not trust Microsoft `user_metadata` as Minecraft proof.
- Only this backend flow, after successful verification, may set `minecraft_verified = true`.
- Keep browser-facing errors generic.
