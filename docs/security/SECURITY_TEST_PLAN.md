# Security Test Plan

Objectif: valider que le front, Supabase, Storage et les routes sensibles restent fermes par defaut.

## Prerequis

- Executer `docs/supabase/SAO_NAMELESS_SCHEMA.sql` dans le projet `SAO-Nameless`.
- Creer trois comptes:
  - `joueur_normal`
  - `membre_guilde`
  - `admin`
- Promouvoir `admin` via SQL Editor uniquement.
- Promouvoir `membre_guilde` via SQL Editor ou dashboard admin apres validation RLS.
- Garder HDV hors navigation/SPA.

## Secrets

1. Rechercher dans le repo:
   ```txt
   service_role
   SUPABASE_SERVICE_ROLE_KEY
   postgres://
   postgresql://
   database password
   ```
   Attendu: aucun secret reel dans HTML/JS/CSS.

2. Inspecter le navigateur:
   - Option A: la cle publishable/anon peut etre visible.
   - Option B: aucune URL/cle Supabase ne doit etre visible.

3. Verifier `localStorage` / `sessionStorage`.
   Attendu: aucune session custom sensible, aucun role admin, aucun token applicatif maison.

## XSS front

Tester ces payloads dans pseudo, chat, MP, activite, profil et admin:

```html
<img src=x onerror=alert(1)>
"><script>alert(1)</script>
javascript:alert(1)
data:text/html,<script>alert(1)</script>
<svg onload=alert(1)>
```

Attendu:

- affiche comme texte ou refuse;
- aucun `alert`;
- aucun handler inline ajoute;
- aucune URL dangereuse acceptee.

## Chat public

Compte `membre_guilde`:

1. Envoyer texte avec payload XSS.
2. Envoyer message vide sans image.
3. Envoyer contenu > 4000 caracteres.
4. Tenter image URL `javascript:alert(1)`.
5. Tenter image URL `data:image/svg+xml,...`.

Attendu:

- XSS affiche comme texte;
- message vide refuse;
- contenu trop long refuse;
- URL image dangereuse refusee.

## MP / DM

1. Envoyer MP de `membre_guilde` vers `admin`.
2. Lire avec sender.
3. Lire avec recipient.
4. Lire avec `joueur_normal`.
5. Modifier `recipient_id` depuis DevTools/Supabase client.

Attendu:

- sender/recipient seulement;
- tiers ne lit rien;
- modification non autorisee refusee par RLS.

## Activite guilde

1. `membre_guilde` tente creation activite.
2. `admin` cree activite.
3. `joueur_normal` lit activite.
4. Injecter payload dans titre/contenu/image_url.

Attendu:

- ecriture admin seulement selon schema actuel;
- membre lit si role membre/admin;
- joueur normal refuse;
- URL image non https/png-jpg-jpeg-webp refusee.

## Profil et roles

1. `joueur_normal` modifie `classe` et `niveau`.
2. `joueur_normal` tente `niveau = 999`.
3. `joueur_normal` tente `role = admin`.
4. `joueur_normal` tente update profil d'un autre user.
5. `joueur_normal` tente insert dans `user_roles`.
6. `admin` modifie role d'un utilisateur.

Attendu:

- classe/niveau valides acceptes;
- niveau hors borne refuse;
- auto-promotion refusee;
- profil autre user refuse;
- `user_roles` refuse au non-admin;
- admin autorise.

## Planning / objectifs

1. `membre_guilde` lit planning/objectifs.
2. `membre_guilde` tente insert/update/delete.
3. `admin` cree objectif `progression = 101`.
4. `admin` cree objectif `progression = 50`.

Attendu:

- lecture membre OK;
- ecriture membre refusee;
- progression > 100 refusee;
- progression valide acceptee.

## Presence

1. `membre_guilde` marque sa presence.
2. `membre_guilde` modifie presence d'un autre user.
3. `joueur_normal` lit presence.
4. `admin` modifie presence.

Attendu:

- own presence OK;
- autre user refuse;
- joueur normal refuse;
- admin OK.

## Admin

1. `joueur_normal` appelle `delete_user_completely`.
2. `membre_guilde` appelle `delete_user_completely`.
3. `admin` appelle `delete_user_completely` sur autre user.
4. `admin` appelle `delete_user_completely` sur lui-meme.
5. Verifier `admin_logs`.

Attendu:

- non-admin refuse;
- admin autre user supprime donnees publiques;
- auto-suppression admin refusee;
- log admin cree.

## Storage

Uploads a tester:

- `payload.svg`
- `payload.html`
- `payload.js`
- `payload.xml`
- `image.png` > 5 MB
- `image.jpg` dans `chat/<autre-user-id>/image.jpg`
- `image.webp` dans `chat/<auth.uid()>/image.webp`

Attendu:

- SVG/HTML/JS/XML refuses;
- > 5 MB refuse;
- prefixe autre user refuse;
- prefixe own user accepte;
- objet prive non accessible par URL publique.

## Carte / Leaflet

1. Injecter HTML dans un nom de marker si la source devient dynamique.
2. Injecter HTML dans popup.
3. Cliquer le bouton "Voir toutes les quetes".

Attendu:

- contenu dynamique echappe ou DOM textContent;
- aucun `onclick` inline;
- navigation via listener JS.

## Audio

1. Verifier que la playlist vient d'assets locaux.
2. Tenter de fournir une URL audio externe.
3. Verifier localStorage audio.

Attendu:

- aucune URL utilisateur;
- pas d'autoplay force;
- preferences audio non sensibles seulement.

## Regression CSP

1. Charger accueil, map, bestiaire, items, quetes, wiki, connexion, profil.
2. Lire console.
3. Verifier Leaflet, fonts, Supabase, audio.

Attendu:

- pas d'erreur bloquante;
- aucun besoin d'ajouter des domaines larges;
- aucune dependance a `unsafe-inline` hors legacy a supprimer.
