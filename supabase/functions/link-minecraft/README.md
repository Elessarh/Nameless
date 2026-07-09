# link-minecraft Edge Function - placeholder

This directory intentionally contains documentation only for now.

The current GitHub Pages frontend must not perform the Minecraft linking flow directly because it cannot safely hold Microsoft client secrets, Supabase service-role keys, Xbox tokens, XSTS tokens, or Minecraft Services tokens.

## Intended endpoints

- `GET /link-minecraft/start`
  - Requires a valid Supabase user session.
  - Creates and stores an anti-CSRF `state` server-side.
  - Redirects to Microsoft OAuth with the Xbox/Minecraft linking scopes.

- `GET /link-minecraft/callback`
  - Validates the `state`.
  - Exchanges the Microsoft authorization code server-side.
  - Performs Xbox Live authentication.
  - Requests an XSTS token.
  - Authenticates with Minecraft Services.
  - Retrieves the verified Minecraft profile.
  - Updates `public.user_profiles` with verified Minecraft fields.

## Required environment variables

Set these in Supabase function secrets, never in HTML, CSS, browser JavaScript, committed files, or GitHub Pages configuration:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Security rules

- Do not store Xbox, XSTS, or Minecraft tokens in `localStorage`.
- Do not return provider tokens to the browser.
- Do not trust a manually entered Minecraft username.
- Do not trust Microsoft `user_metadata` as Minecraft proof.
- Only this backend flow, after successful verification, may set `minecraft_verified = true`.
- Use generic browser-facing errors and keep sensitive details in server-side logs only.

## Frontend behavior until implementation

The profile page should keep showing:

- `Compte Microsoft connecté`
- `Minecraft non lié`
- `Lier mon compte Minecraft`

Clicking the button can show a clean "coming soon" message until this function is implemented and configured.
