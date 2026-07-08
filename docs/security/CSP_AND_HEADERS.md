# CSP And Headers

## GitHub Pages

GitHub Pages ne permet pas facilement de definir des headers HTTP personnalises avances. Une balise meta CSP peut aider, mais elle a des limites:

- elle ne remplace pas `X-Frame-Options` / `frame-ancestors` HTTP dans tous les cas;
- elle arrive avec le HTML, pas avant;
- elle ne permet pas toutes les protections header modernes;
- elle reste moins robuste qu'une configuration headers cote hebergeur.

## Recommandation hebergement

Pour securite plus forte, utiliser:

- Cloudflare Pages;
- Netlify;
- Vercel;
- backend separe avec reverse proxy.

Ces plateformes permettent des headers HTTP stricts.

## CSP cible

Base recommandee:

```txt
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net https://unpkg.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' https://mc-heads.net https://*.supabase.co;
media-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://playerdb.co;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

## Domaines necessaires aujourd'hui

- `https://cdn.jsdelivr.net`: Supabase UMD.
- `https://unpkg.com`: Leaflet.
- `https://fonts.googleapis.com`: Google Fonts CSS.
- `https://fonts.gstatic.com`: fichiers fonts.
- `https://mc-heads.net`: avatars Minecraft.
- `https://*.supabase.co`: API/Storage Supabase en Option A.
- `wss://*.supabase.co`: realtime Supabase en Option A.
- `https://playerdb.co`: verification pseudo Minecraft.

## Option B

En Zero Secret Front, remplacer `connect-src` Supabase par le backend:

```txt
connect-src 'self' https://api.example.com;
```

Le front ne doit plus appeler directement `https://*.supabase.co`.

## Points a eviter

- Eviter `script-src 'unsafe-inline'`.
- Eviter `img-src data:` sauf besoin prouve.
- Eviter `blob:` persistant.
- Eviter `media-src https:` large.
- Ne pas autoriser `object-src`.
- Ne jamais autoriser `javascript:` ou `data:` comme URL utilisateur.

## Migration CSP

1. Garder la meta CSP actuelle tant que GitHub Pages est utilise.
2. Retirer les handlers inline restants.
3. Supprimer `script-src 'unsafe-inline'` quand il n'y a plus d'inline script/handler.
4. Migrer vers hebergeur avec headers pour `frame-ancestors 'none'`.
5. En Option B, retirer Supabase de `connect-src` frontend.
