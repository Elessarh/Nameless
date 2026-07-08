# Storage Security

## Decision

Les uploads utilisateur doivent aller dans un bucket **prive**. La lecture doit passer par signed URLs courtes ou par un endpoint backend.

Le SQL strict garde le nom de bucket existant:

```txt
iron-oath-storage
```

Mais il le configure avec:

```txt
public = false
file_size_limit = 5242880
allowed_mime_types = image/png, image/jpeg, image/webp
```

## Regles bucket

- Pas de bucket public pour uploads utilisateur.
- Pas de SVG.
- Pas de HTML.
- Pas de JS.
- Pas de XML.
- Pas de `data:` URL.
- Pas de `javascript:` URL.
- Pas de fichier audio upload utilisateur pour le lecteur Nameless.
- Images autorisees seulement: `png`, `jpg`, `jpeg`, `webp`.
- Taille max recommandee: 5 MB.

## Chemins autorises

Le chemin doit inclure `auth.uid()`:

```txt
chat/<auth.uid()>/<uuid>.png
chat/<auth.uid()>/<uuid>.jpg
chat/<auth.uid()>/<uuid>.jpeg
chat/<auth.uid()>/<uuid>.webp

guild-activities/<auth.uid()>/<uuid>.png
guild-activities/<auth.uid()>/<uuid>.jpg
guild-activities/<auth.uid()>/<uuid>.jpeg
guild-activities/<auth.uid()>/<uuid>.webp
```

Tout autre chemin doit etre refuse.

## Policies Storage

Le schema applique:

- read: utilisateur proprietaire du prefixe `auth.uid()` ou admin;
- insert: utilisateur authentifie dans son propre prefixe;
- update: proprietaire du prefixe ou admin;
- delete: proprietaire du prefixe ou admin;
- bucket prive.

## Signed URLs

Recommandation:

- Signed URL courte: 5 a 15 minutes.
- Generation cote backend en Option B.
- En Option A, generation directe possible mais moins forte; RLS Storage doit rester stricte.

Ne jamais stocker une signed URL longue duree en base si elle donne acces a un objet prive.

## Impact sur le code actuel

Le code actuel utilise encore:

- `supabase.storage.from('iron-oath-storage').upload('chat/<file>')`
- `getPublicUrl(...)`

Ce modele est moins strict. Avec le schema durci, il faut migrer vers:

- chemin `chat/<auth.uid()>/<file>`;
- signed URL au lieu de public URL;
- validation extension/MIME avant upload;
- refus SVG/HTML/JS/XML.

Si cette migration n'est pas faite, l'upload peut etre bloque. C'est prefere a un bucket public dangereux.

## Tests malveillants

Tester que les uploads suivants echouent:

- `payload.svg`
- `payload.html`
- `payload.js`
- `payload.xml`
- `payload.php`
- `payload.png.svg`
- `payload.jpg` avec MIME `image/svg+xml`
- image > 5 MB
- upload vers `chat/<uuid-autre-user>/x.png`
- upload vers `guild-activities/x.png` sans prefixe user

Tester que les lectures suivantes echouent:

- objet d'un autre user;
- objet sans session;
- objet depuis URL publique non signee.
