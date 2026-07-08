# Microsoft Only Auth Setup

Nameless utilise uniquement Microsoft OAuth via le provider Azure de Supabase.

Configuration attendue dans Supabase Dashboard:

- Activer le provider Azure/Microsoft.
- Conserver la valeur confidentielle OAuth Microsoft uniquement dans Supabase Dashboard.
- Ajouter la Redirect URI cote Microsoft Entra:
  `https://iwrvdntlrjnoqzbwbsfm.supabase.co/auth/v1/callback`
- Desactiver le provider Email si l'inscription email/password ne doit plus etre possible.

Le front ne contient pas de `service_role`, database password, connection string ou valeur confidentielle Microsoft.
