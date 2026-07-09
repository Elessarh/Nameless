# link-minecraft Edge Function

This function performs the real Minecraft linking flow server-side.

The SQL patch only prepares storage and RLS/triggers. It cannot fetch a Minecraft profile by itself. This function must be deployed and configured before automatic linking can work.

## Frontend behavior

When a connected profile has no `minecraft_username`, `pages/profil.html` starts the linking flow automatically through:

```js
supabase.functions.invoke('link-minecraft', {
  body: {
    action: 'start',
    returnTo: window.location.origin + '/pages/profil.html?minecraft_link=return'
  }
})
```

No manual Minecraft button is required.

## Flow

1. The profile page invokes `link-minecraft` with `action: "start"`.
2. The function validates the Supabase user session from the `Authorization` header.
3. The function creates a signed, short-lived OAuth `state`.
4. The function returns a Microsoft OAuth URL to the browser.
5. Microsoft redirects back to `MICROSOFT_REDIRECT_URI`.
6. The function exchanges the code server-side.
7. The function authenticates through Xbox Live, XSTS, then Minecraft Services.
8. The function fetches the verified Minecraft profile.
9. The function updates `public.user_profiles` with verified Minecraft fields.
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

Optional:

```text
MICROSOFT_TENANT=consumers
MICROSOFT_OAUTH_SCOPES=XboxLive.signin offline_access
```

`SERVICE_ROLE_KEY` must contain the Supabase service role key and is allowed only inside this deployed function. It must never appear in HTML, CSS, browser JavaScript, GitHub Pages settings, or public config files.

## Required Microsoft redirect URI

Add this redirect URI in the Microsoft app registration used for Minecraft linking:

```text
https://iwrvdntlrjnoqzbwbsfm.supabase.co/functions/v1/link-minecraft
```

This is separate from the Supabase Auth Azure callback used for site login.

## Deploy

```bash
supabase functions deploy link-minecraft
```

Then push the frontend changes to GitHub Pages.

## Security rules

- Do not store Xbox, XSTS, or Minecraft tokens in `localStorage`.
- Do not return provider tokens to the browser.
- Do not trust a manually entered Minecraft username.
- Do not trust Microsoft `user_metadata` as Minecraft proof.
- Only this backend flow, after successful verification, may set `minecraft_verified = true`.
- Keep browser-facing errors generic.
