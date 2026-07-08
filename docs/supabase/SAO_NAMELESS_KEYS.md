# SAO-Nameless Client Keys

Cette phase documente les cles a utiliser plus tard. Elle ne modifie pas `js/crypto-keys.js`.

## Valeurs a recuperer dans Supabase

Dans le projet `SAO-Nameless`, ouvrir:

`Project Settings` -> `API`

Noter uniquement:

```txt
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...ANON_PUBLIC_KEY...
```

Ne jamais utiliser dans le frontend:

```txt
SUPABASE_SERVICE_ROLE_KEY=NE_JAMAIS_METTRE_DANS_LE_FRONT
DATABASE_PASSWORD=NE_JAMAIS_METTRE_DANS_LE_FRONT
JWT_SECRET=NE_JAMAIS_METTRE_DANS_LE_FRONT
```

## Regle importante

La cle anon est publique par nature dans un site statique GitHub Pages. La securite doit donc venir de:

- RLS activee sur les tables.
- Policies strictes.
- RPC sensibles verifiees cote base.
- Aucun role admin deduit uniquement du client.
- Aucun secret serveur dans HTML/CSS/JS.

## Integration future dans le site

Le fichier existant `js/crypto-keys.js` expose:

- `window._getSecureUrl()`
- `window._getSecureKey()`

`js/auth-supabase.js` consomme ces deux fonctions pour initialiser Supabase.

Quand la bascule sera validee, remplacer uniquement les valeurs obfusquees de `js/crypto-keys.js` par:

```txt
SAO_NAMELESS_SUPABASE_URL=<SUPABASE_URL>
SAO_NAMELESS_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
```

Cette modification doit etre faite dans un commit separe, apres validation du schema et des tests RLS.

## Checklist avant remplacement des cles

1. Le SQL `SAO_NAMELESS_SCHEMA.sql` a ete execute sans erreur.
2. Le premier compte admin existe.
3. Un compte joueur ne peut pas changer son propre `role`.
4. Un membre peut lire/ecrire le chat guilde selon son role.
5. Un joueur non membre ne peut pas acceder aux tables guilde.
6. Les DM ne sont visibles que par les deux participants.
7. Le bucket `iron-oath-storage` existe.
8. Aucune cle `service_role` n'est presente dans le repo.

## Placeholders de travail

```txt
SAO_NAMELESS_SUPABASE_URL=
SAO_NAMELESS_SUPABASE_ANON_KEY=
```

Laisser ces champs vides tant que les vraies valeurs ne sont pas fournies explicitement.
